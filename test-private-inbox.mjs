import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./private.html',import.meta.url),'utf8');
test('Messenger inbox lists replied-to threads and shows their full stored exchange',()=>{
 for(const id of ['inboxSearch','inboxSummary','threadHeader','openMessenger','refreshInbox']) assert.match(source,new RegExp(`id="${id}"`));
 assert.match(source,/Open in Messenger/);
 assert.match(source,/full exchange stored in Supabase/);
 assert.match(source,/\.tabs\.hidden\{display:none\}/);
 assert.match(source,/Read only · Replies cannot be sent/);
 assert.match(source,/\.eq\('direction','inbound'\)/);
 assert.match(source,/\.in\('id',\[\.\.\.replyCounts\.keys\(\)\]\)/);
 assert.match(source,/selectedMessages\.map\(m=>/);
 assert.doesNotMatch(source,/id="inboxFilter"|id="toggleSent"/);
 assert.match(source,/setInterval\(\(\)=>\{if\(!document\.hidden/);
 for(const table of ['reachr_conversations','reachr_messages']) assert.match(source,new RegExp(`from\\('${table}'\\)`));
 assert.doesNotMatch(source,/id="draft"|id="saveDraft"|from\('reachr_reply_jobs'\)/);
 for(const route of ['conversations','messages','jobs','drafts']) assert.ok(!source.includes(`call('/${route}`));
});
