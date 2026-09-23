import test from 'node:test';
import assert from 'node:assert/strict';
import {planCrm,applyCrm} from './scripts/import-reachr-crm.mjs';
const url='https://www.messenger.com/t/12345/';
const contact={id:'21b95ef4-0033-4d22-ab10-f87ecf8fb63e',business_name:'Atlas Books',recipient_name:'Atlas Books',messenger_url:url,email:'',email_source:'',stage:'interested',note:'Follow up manually',consent_status:'unknown',no_send:1,created_at:'2026-09-22T10:00:00Z',updated_at:'2026-09-22T11:00:00Z'};
const evidence={id:'7990760b-0e9f-4ef5-bd1f-e0a657d19727',contact_id:contact.id,type:'verified_messenger_evidence',summary:'Verified interest',source:'live_messenger_thread_review_2026-09-22',occurred_at:'2026-09-22T10:00:00Z'};
const update={id:'34ba6c74-8c96-4aa8-b72b-805eddb2c6bc',contact_id:contact.id,type:'operator_update',summary:'stage updated',source:'private_crm',occurred_at:'2026-09-22T11:00:00Z'};
const conversations=[{business_name:'Atlas Books',messenger_url:url}];
test('plans verified local contact and original audit events without enabling sends',()=>{
 const plan=planCrm([contact],[evidence,update],conversations);
 assert.equal(plan.contacts.length,1);assert.equal(plan.events.length,2);assert.equal(plan.contacts[0].evidence,evidence.summary);assert.equal(plan.contacts[0].no_send,true);assert.equal(plan.contacts[0].email,null);assert.equal(plan.contacts[0].email_source,'none');
});
test('quarantines mismatched route, missing exact evidence, unverified email and unsafe contact',()=>{
 for(const [contacts,events,source] of [[[{...contact,messenger_url:'https://www.messenger.com/t/other'}],[evidence],conversations],[[contact],[],conversations],[[{...contact,email:'private@example.org'}],[evidence],conversations],[[{...contact,no_send:0}],[evidence],conversations]])assert.throws(()=>planCrm(contacts,events,source));
});
test('preflights tables and rejects conflicting existing contact before writing',async()=>{
 const plan=planCrm([contact],[evidence],conversations),calls=[];
 const fetchImpl=async (reqUrl,opts)=>{calls.push(opts.method);return {ok:true,status:200,json:async()=>String(reqUrl).includes('reachr_contacts')?[{id:'other',business_name:'Atlas Books',messenger_url:url,email:null}]:[]}};
 await assert.rejects(applyCrm(plan,{base:'https://xacehhtgvubcqdoltazg.supabase.co',key:'test',fetchImpl}),/existing_contact_conflict/);
 assert.equal(calls.every(x=>x==='GET'),true);
});
test('inserts contact before original events, ignoring duplicates on rerun',async()=>{
 const plan=planCrm([contact],[evidence,update],conversations),calls=[];
 const fetchImpl=async (url,opts)=>{calls.push({url:String(url),method:opts.method,body:opts.body&&JSON.parse(opts.body),prefer:opts.headers.Prefer});return {ok:true,status:opts.method==='POST'?201:200,json:async()=>[]}};
 assert.deepEqual(await applyCrm(plan,{base:'https://xacehhtgvubcqdoltazg.supabase.co',key:'test',fetchImpl}),{contacts:1,historicalEvents:2});
 assert.deepEqual(calls.map(c=>c.method),['GET','GET','POST','POST']);
 assert.equal(calls[2].body[0].no_send,true);assert.equal(calls[3].body.length,2);assert.match(calls[2].prefer,/ignore-duplicates/);
});
test('refuses wrong Supabase project before any network call',async()=>{
 await assert.rejects(applyCrm(planCrm([contact],[evidence],conversations),{base:'https://other.supabase.co',key:'test',fetchImpl:()=>{throw Error('called')}}),/wrong_supabase_project/);
});
