import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const normalized=value=>String(value||'').trim().toLocaleLowerCase('en-US');
const browserMonth=new Intl.DateTimeFormat('en-US',{timeZone:'America/Halifax',year:'numeric',month:'2-digit'});
const localMonth=date=>{const parts=Object.fromEntries(browserMonth.formatToParts(date).map(x=>[x.type,x.value]));return `${parts.year}-${parts.month}`};
function route(value){try{const url=new URL(value);if(url.protocol!=='https:')return null;if(url.hostname==='m.me'&&/^\/[\w.-]+\/?$/.test(url.pathname))return `https://m.me${url.pathname.replace(/\/$/,'')}`;if(!['www.messenger.com','messenger.com'].includes(url.hostname)||!/^\/t\/[\w-]+\/?$/.test(url.pathname))return null;return `https://www.messenger.com${url.pathname.replace(/\/$/,'')}/`}catch{return null}}
function eligible(record){return ['messenger_confirmed','messenger_ui_confirmed'].includes(record.delivery)&&![record.sourceUrl,record.channel,record.source,record.surface,record.messagingSource].some(x=>/marketplace/i.test(String(x||'')))}
export async function applyImport(plan,{base,key,fetchImpl=fetch}={}){
 if(!base||!key)throw Error('missing_supabase_access');
 const origin=new URL(base);if(origin.origin!=='https://xacehhtgvubcqdoltazg.supabase.co')throw Error('wrong_supabase_project');
 const root=origin.origin+'/rest/v1';
 const headers={apikey:key,Authorization:`Bearer ${key}`};
 for(const table of ['reachr_conversations','reachr_messages','reachr_reply_jobs']){
  const response=await fetchImpl(`${root}/${table}?select=id&limit=1`,{method:'GET',headers});
  if(!response.ok)throw Error(`schema_not_ready:${table}:${response.status}`);
 }
 let conversationCount=0,messageCount=0;
 for(const conversation of plan.conversations){
  const response=await fetchImpl(`${root}/reachr_conversations?on_conflict=external_key`,{method:'POST',headers:{...headers,'content-type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([conversation])});
  if(!response.ok)throw Error(`conversation_upsert_failed:${response.status}`);
  const [saved]=await response.json();if(!saved?.id)throw Error('conversation_id_missing');conversationCount++;
  const items=plan.messages.filter(item=>item.external_key===conversation.external_key).map(({external_key,...message})=>({conversation_id:saved.id,...message}));
  if(!items.length)continue;
  const written=await fetchImpl(`${root}/reachr_messages?on_conflict=conversation_id,provenance`,{method:'POST',headers:{...headers,'content-type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(items)});
  if(!written.ok)throw Error(`message_upsert_failed:${written.status}`);
  messageCount+=items.length;
 }
 return {conversations:conversationCount,messages:messageCount};
}

export function planImport(archive,ledger,{month='2026-09',sourceTimezone=null}={}){
 if(!/^\d{4}-\d{2}$/.test(month))throw Error('invalid month');
 if(sourceTimezone&&sourceTimezone!==Intl.DateTimeFormat().resolvedOptions().timeZone)throw Error('browser_timezone_mismatch');
 const flatGroups=new Map();
 if(!Array.isArray(archive.threads)&&Array.isArray(archive.messages)&&sourceTimezone){
  for(const m of archive.messages){if(m?.provenance?.kind!=='messenger-rendered-aria-label'||m.timezone!=='unverified-browser-local'||m.timestampPrecision!=='minute')continue;
   const date=Date.parse(String(m.timestamp||'').replace(/\u202f/g,' '));if(!Number.isFinite(date))continue;
   const group=flatGroups.get(m.sourceUrl)||[];group.push({observedAt:new Date(date).toISOString(),speaker:m.speaker,body:m.body,direction:m.direction,provenance:'messenger_aria_label'});flatGroups.set(m.sourceUrl,group)
  }
 }
 const threads=Array.isArray(archive.threads)?archive.threads:[...flatGroups].map(([messengerUrl,messages])=>({messengerUrl,messages}));
 const records=(ledger.prospects||[]).filter(eligible),byRoute=new Map(),conversations=[],messages=[],rejected=[],fingerprints=new Set();
 for(const record of records){const key=route(record.messengerUrl);if(!key)continue;const group=byRoute.get(key)||[];group.push(record);byRoute.set(key,group)}
 for(const thread of threads){const key=route(thread.messengerUrl),matches=byRoute.get(key)||[];if(!key||matches.length!==1||key.startsWith('https://m.me/')){rejected.push({route:key,reason:'unconfirmed_or_ambiguous_route'});continue}const record=matches[0],aliases=[normalized(record.businessName),normalized(record.recipientName)],external_key='messenger:'+hash(key),accepted=[];
  for(const item of thread.messages||[]){const date=Date.parse(item.observedAt||''),direction=item.direction,speaker=normalized(item.speaker),body=String(item.body||'').trim(),iso=Number.isFinite(date)?new Date(date).toISOString():'';
   if(!body||!iso||localMonth(new Date(date))!==month||item.provenance!=='messenger_aria_label'||!['inbound','outbound'].includes(direction)||direction==='inbound'&&!aliases.includes(speaker)||direction==='outbound'&&speaker!=='you'){rejected.push({route:key,reason:'invalid_or_unverified_message'});continue}
   const provenance='messenger_aria_label:'+hash(JSON.stringify([key,iso,direction,speaker,body]));if(fingerprints.has(provenance))continue;fingerprints.add(provenance);accepted.push({external_key,direction,body,observed_at:iso,provenance});
  }
  if(!accepted.length)continue;
  conversations.push({external_key,business_name:record.businessName,recipient_name:record.recipientName||null,messenger_url:key,source:'reachr_messenger_ledger_or_live',marketplace_excluded:false});messages.push(...accepted)
 }
 // Ledger-confirmed sends are explicitly labeled as ledger evidence, never as
 // a live thread capture or proof of recipient-side delivery.
 const keys=new Set(conversations.map(x=>x.external_key));
 for(const record of records){if(record.falseConfirmationAt)continue;const key=route(record.messengerUrl);if(!key||(byRoute.get(key)||[]).length!==1)continue;const external_key='messenger:'+hash(key);
  for(const [bodyValue,timeValue,tag] of [[record.sentMessage,record.sentAt,'initial'],[record.lastReplySentMessage,record.lastReplySentAt,'followup']]){
   const body=String(bodyValue||'').trim(),date=Date.parse(timeValue||'');if(!body||!Number.isFinite(date)||localMonth(new Date(date))!==month)continue;
   if(messages.some(x=>x.external_key===external_key&&x.direction==='outbound'&&x.body===body))continue;
   const iso=new Date(date).toISOString();messages.push({external_key,direction:'outbound',body,observed_at:iso,provenance:'ledger_confirmed:'+hash(JSON.stringify([key,iso,tag,body]))});
   if(!keys.has(external_key)){conversations.push({external_key,business_name:record.businessName,recipient_name:record.recipientName||null,messenger_url:key,source:'reachr_messenger_ledger_or_live',marketplace_excluded:false});keys.add(external_key)}
  }
 }
 return {conversations,messages,rejected};
}

async function main(args){const option=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]},archivePath=option('--archive')||'/Users/jackserver/jsw/keys/reachr-september-messages.json',ledgerPath=option('--ledger')||'/Users/jackserver/wildrose-automations/reachr-outreach/prospects.json';
 const archive=JSON.parse(fs.readFileSync(archivePath,'utf8'));
 const plan=planImport(archive,JSON.parse(fs.readFileSync(ledgerPath,'utf8')),{month:option('--month')||'2026-09',sourceTimezone:option('--browser-timezone')||null});
 const summary={mode:args.includes('--apply')?'apply':'dry-run',conversations:plan.conversations.length,messages:plan.messages.length,verifiedLive:plan.messages.filter(x=>x.provenance.startsWith('messenger_aria_label:')).length,ledgerOnly:plan.messages.filter(x=>x.provenance.startsWith('ledger_confirmed:')).length,rejected:plan.rejected.length,sourceCoverage:archive.candidateThreads==null?null:{candidateThreads:archive.candidateThreads,inspectedThreads:archive.inspectedThreads,historyExhausted:(archive.coverage||[]).filter(x=>x.historyExhausted).length,sourceErrors:archive.errors?.length||0,sourceQuarantine:archive.quarantine?.length||0}};
 if(!args.includes('--apply')){console.log(JSON.stringify(summary));return}
 if(fs.statSync(archivePath).mode&0o077)throw Error('archive_not_private');
 const env=Object.fromEntries(fs.readFileSync('/Users/jackserver/jsw/keys/reachr-supabase.env','utf8').split('\n').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1).trim().replace(/^['\"]|['\"]$/g,'')]}));
 const result=await applyImport(plan,{base:env.SUPABASE_URL,key:env.SUPABASE_SECRET_KEY});console.log(JSON.stringify({...summary,...result}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error('import_failed:',error.message);process.exitCode=1});
