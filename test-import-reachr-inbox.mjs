import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {planImport,applyImport} from './scripts/import-reachr-inbox.mjs';
const url='https://www.messenger.com/t/12345/';
const ledger={prospects:[{businessName:'Atlas Books',recipientName:'Atlas Books',messengerUrl:url,delivery:'messenger_confirmed',sentAt:'2026-09-10T10:00:00Z',sourceUrl:'https://www.facebook.com/groups/local'}]};
const message={direction:'inbound',speaker:'Atlas Books',body:'Can you send details?',observedAt:'2026-09-12T12:30:00Z',provenance:'messenger_aria_label'};
test('plans one September Reachr thread and deduplicates identical rendered labels',()=>{
 const plan=planImport({threads:[{messengerUrl:url,messages:[message,message]}]},ledger);
 assert.equal(plan.conversations.length,1);assert.equal(plan.messages.length,1);
 assert.equal(plan.messages[0].body,message.body);
 assert.equal(plan.messages[0].direction,'inbound');assert.equal(plan.messages[0].provenance.startsWith('messenger_aria_label:'),true);
});
test('rejects unconfirmed or Marketplace threads and messages outside September',()=>{
 const archive={threads:[{messengerUrl:url,messages:[message,{...message,body:'October note',observedAt:'2026-10-01T12:00:00Z'}]}]};
 assert.equal(planImport(archive,{prospects:[{...ledger.prospects[0],sourceUrl:'https://www.facebook.com/marketplace/item/12'}]}).messages.length,0);
 assert.equal(planImport(archive,ledger).messages.length,1);
});
test('adapts rendered-label archive only with independently verified browser timezone',()=>{
 const flat={messages:[{sourceUrl:url,timestamp:'September 12, 2026, 9:30 AM',speaker:'Atlas Books',body:'Live inbound',direction:'inbound',timezone:'unverified-browser-local',timestampPrecision:'minute',provenance:{kind:'messenger-rendered-aria-label'}}]};
 assert.equal(planImport(flat,ledger).messages.length,0);
 const plan=planImport(flat,ledger,{sourceTimezone:'America/Halifax'});
 assert.equal(plan.messages.length,1);assert.equal(plan.messages[0].body,'Live inbound');assert.match(plan.messages[0].provenance,/^messenger_aria_label:/);
});
test('retains ledger-confirmed September send when live thread history is unavailable',()=>{
 const record={...ledger.prospects[0],sentMessage:'A verified outreach note'};
 const plan=planImport({threads:[]},{prospects:[record]});
 assert.equal(plan.messages.length,1);assert.equal(plan.messages[0].direction,'outbound');
 assert.match(plan.messages[0].provenance,/^ledger_confirmed:/);
});
test('retains confirmed outbound ledger evidence at unique m.me shortlinks without treating them as inspected inbound',()=>{
 const short='https://m.me/AtlasBooks';const record={...ledger.prospects[0],messengerUrl:short,sentMessage:'A verified outreach note'};
 const plan=planImport({threads:[{messengerUrl:short,messages:[message]}]},{prospects:[record]});
 assert.equal(plan.messages.length,1);assert.equal(plan.messages[0].direction,'outbound');
 assert.match(plan.messages[0].provenance,/^ledger_confirmed:/);
});
test('does not duplicate the same outbound text from live history and ledger',()=>{
 const record={...ledger.prospects[0],sentMessage:'A verified outreach note'};
 const live={...message,direction:'outbound',speaker:'You',body:record.sentMessage,observedAt:record.sentAt};
 const plan=planImport({threads:[{messengerUrl:url,messages:[live]}]},{prospects:[record]});
 assert.equal(plan.messages.length,1);
});
test('September window is evaluated in the verified Messenger browser timezone, not UTC',()=>{
 const archive={threads:[{messengerUrl:url,messages:[{...message,observedAt:'2026-09-01T00:30:00Z',body:'August local'},{...message,observedAt:'2026-10-01T01:30:00Z',body:'September local'}]}]};
 const plan=planImport(archive,ledger);assert.deepEqual(plan.messages.map(x=>x.body),['September local']);
});
test('refuses to send the Reachr project secret to another Supabase project',async()=>{
 const plan=planImport({threads:[{messengerUrl:url,messages:[message]}]},ledger);
 await assert.rejects(applyImport(plan,{base:'https://other.supabase.co',key:'test-secret',fetchImpl:async()=>{throw Error('must not call network')}}),/wrong_supabase_project/);
});
test('preflights every required table and never writes when schema is absent',async()=>{
 const plan=planImport({threads:[{messengerUrl:url,messages:[message]}]},ledger),calls=[];
 const fetchImpl=async (input,options)=>{calls.push({url:String(input),method:options.method||'GET'});return {ok:false,status:404,json:async()=>({code:'PGRST205'})}};
 await assert.rejects(applyImport(plan,{base:'https://xacehhtgvubcqdoltazg.supabase.co',key:'test-secret',fetchImpl}),/schema_not_ready/);
 assert.equal(calls.some(x=>x.method!=='GET'),false);
});
test('writes each conversation before its id-linked messages and does not change reply jobs',async()=>{
 const plan=planImport({threads:[{messengerUrl:url,messages:[message]}]},ledger),calls=[];
 const fetchImpl=async (input,options)=>{calls.push({url:String(input),method:options.method||'GET',body:options.body&&JSON.parse(options.body)});return {ok:true,status:options.method==='POST'?201:200,json:async()=>String(input).includes('reachr_conversations?on_conflict=')?[{id:'db-conversation-id'}]:[]}};
 const result=await applyImport(plan,{base:'https://xacehhtgvubcqdoltazg.supabase.co',key:'test-secret',fetchImpl});
 assert.deepEqual(result,{conversations:1,messages:1});
 assert.deepEqual(calls.map(x=>x.method),['GET','GET','GET','POST','POST']);
 assert.equal(calls[4].body[0].conversation_id,'db-conversation-id');
 assert.equal(calls.some(x=>x.method==='POST'&&x.url.includes('reachr_reply_jobs')),false);
});
test('CLI dry run reports counts without printing private message body or requiring credentials',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reachr-import-test-'));
 try{const archive=path.join(dir,'archive.json'),ledgerPath=path.join(dir,'ledger.json');fs.writeFileSync(archive,JSON.stringify({threads:[{messengerUrl:url,messages:[message]}]}));fs.writeFileSync(ledgerPath,JSON.stringify(ledger));const proc=spawnSync(process.execPath,[new URL('./scripts/import-reachr-inbox.mjs',import.meta.url).pathname,'--archive',archive,'--ledger',ledgerPath],{encoding:'utf8'});assert.equal(proc.status,0,proc.stderr);assert.match(proc.stdout,/"messages":1/);assert.doesNotMatch(proc.stdout,/Can you send details\?/)}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('quarantines ambiguous inbound speakers, undated text, and other routes',()=>{
 const archive={threads:[{messengerUrl:url,messages:[{...message,speaker:'Someone else'},{...message,observedAt:null},{...message,body:'',speaker:'Atlas Books'}]},{messengerUrl:'https://www.messenger.com/t/other',messages:[message]}]};
 const plan=planImport(archive,ledger);assert.equal(plan.messages.length,0);assert.equal(plan.rejected.length,4);
});
