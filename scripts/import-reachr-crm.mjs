#!/usr/bin/env node
// One-way migration from the operator's verified local CRM. Dry-run by default.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const PROJECT='https://xacehhtgvubcqdoltazg.supabase.co';
const DEFAULT_DB='/Users/jackserver/jsw/keys/reachr-inbox.sqlite';
const DEFAULT_PLAN='/Users/jackserver/jsw/keys/reachr-inbox-import.json';
const DEFAULT_ENV='/Users/jackserver/jsw/keys/reachr-supabase.env';
const sameName=x=>String(x||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
const route=value=>{try{const u=new URL(value);if(u.protocol!=='https:'||!['m.me','www.messenger.com','messenger.com'].includes(u.hostname)||!/^(\/t\/[\w-]+|\/[\w.-]+)\/?$/.test(u.pathname))return null;return `${u.hostname.replace(/^www\./,'')}${u.pathname.replace(/\/+$/,'')}`}catch{return null}};
export function planCrm(contacts,events,conversations){
 const byRoute=new Map(conversations.map(c=>[route(c.messenger_url),c]));
 const payload=[],eventPayload=[];
 if(!Array.isArray(contacts)||!Array.isArray(events)||!Array.isArray(conversations))throw Error('invalid_crm_source');
 if(new Set(contacts.map(c=>c.id)).size!==contacts.length)throw Error('duplicate_contact_id');
 for(const c of contacts){
  const matched=byRoute.get(route(c.messenger_url));
  if(!matched||sameName(matched.business_name)!==sameName(c.business_name)||!c.id||!c.business_name||!c.no_send||c.consent_status!=='unknown')throw Error('contact_not_verified_in_import');
  const own=events.filter(e=>e.contact_id===c.id),verified=own.filter(e=>e.type==='verified_messenger_evidence');
  if(verified.length!==1||!verified[0].summary?.trim()||!verified[0].source?.startsWith('live_messenger_thread_review_'))throw Error('contact_evidence_missing');
  if(c.email&&c.email_source!=='prospect_provided_in_messenger'||!c.email&&c.email_source)throw Error('email_provenance_invalid');
  if(!['prospect','interested','email_provided','waiting','closed_declined','client'].includes(c.stage)||c.stage==='email_provided'&&!c.email)throw Error('stage_invalid');
  payload.push({id:c.id,business_name:c.business_name,recipient_name:c.recipient_name||null,messenger_url:c.messenger_url,email:c.email||null,email_source:c.email?'prospect_provided_in_messenger':'none',stage:c.stage,evidence:verified[0].summary,note:c.note||'',source:verified[0].source,consent_status:'unknown',no_send:true,created_at:c.created_at,updated_at:c.updated_at});
  for(const e of own){if(!e.id||!e.summary?.trim()||!e.source||!e.occurred_at||!['verified_messenger_evidence','operator_update'].includes(e.type))throw Error('invalid_crm_event');eventPayload.push({id:e.id,contact_id:c.id,type:e.type,summary:e.summary,source:e.source,occurred_at:e.occurred_at})}
 }
 if(new Set(eventPayload.map(e=>e.id)).size!==eventPayload.length)throw Error('duplicate_event_id');
 if(eventPayload.length!==events.length)throw Error('orphan_crm_event');
 return {contacts:payload,events:eventPayload};
}
export async function applyCrm(plan,{base,key,fetchImpl=fetch}={}){
 if(new URL(base).origin!==PROJECT)throw Error('wrong_supabase_project');
 if(!key)throw Error('missing_supabase_access');
 const root=PROJECT+'/rest/v1/',headers={apikey:key,Authorization:`Bearer ${key}`};
 const get=async (table,query)=>{const r=await fetchImpl(root+table+query,{method:'GET',headers});if(!r.ok)throw Error(`schema_or_read_failed:${table}:${r.status}`);return r.json()};
 const existing=await get('reachr_contacts','?select=id,messenger_url,business_name,email&limit=1000');
 await get('reachr_contact_events','?select=id&limit=1');
 if(existing.length>=1000)throw Error('existing_contacts_exceed_preflight');
 for(const local of plan.contacts)for(const stored of existing)if(stored.id===local.id||route(stored.messenger_url)===route(local.messenger_url)){
  if(stored.id!==local.id||sameName(stored.business_name)!==sameName(local.business_name)||(stored.email||null)!==local.email)throw Error('existing_contact_conflict');
 }
 const post=async (table,items)=>{if(!items.length)return;const r=await fetchImpl(root+table+'?on_conflict=id',{method:'POST',headers:{...headers,'content-type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(items)});if(!r.ok)throw Error(`import_failed:${table}:${r.status}`)};
 for(const contact of plan.contacts)await post('reachr_contacts',[contact]);
 await post('reachr_contact_events',plan.events);
 return {contacts:plan.contacts.length,historicalEvents:plan.events.length};
}
function env(pathname){return Object.fromEntries(fs.readFileSync(pathname,'utf8').split('\n').filter(x=>x.includes('=')).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1).trim().replace(/^[\x27\"]|[\x27\"]$/g,'')]}))}
async function main(args){const option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]},dbPath=option('--db')||DEFAULT_DB,planPath=option('--plan')||DEFAULT_PLAN;
 if(fs.statSync(dbPath).mode&0o077||fs.statSync(planPath).mode&0o077)throw Error('private_source_not_private');
 const db=new DatabaseSync(dbPath,{readOnly:true});let contacts,events;try{contacts=db.prepare('select * from crm_contacts').all();events=db.prepare('select * from crm_events').all()}finally{db.close()}
 const p=planCrm(contacts,events,JSON.parse(fs.readFileSync(planPath,'utf8')).conversations);
 if(!args.includes('--apply'))return console.log(JSON.stringify({mode:'dry-run',contacts:p.contacts.length,historicalEvents:p.events.length,noMessagesSent:true}));
 const config=env(option('--env')||DEFAULT_ENV),result=await applyCrm(p,{base:config.SUPABASE_URL,key:config.SUPABASE_SECRET_KEY});console.log(JSON.stringify({mode:'apply',...result,noMessagesSent:true}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error('crm_import_failed:',e.message);process.exitCode=1});
