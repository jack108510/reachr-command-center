import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./private.html',import.meta.url),'utf8');
test('Messenger reading view shows stored conversations and refreshes without a composer',()=>{
 for(const id of ['inboxSearch','inboxFilter','inboxSummary','threadHeader','openMessenger','refreshInbox']) assert.match(source,new RegExp(`id="${id}"`));
 assert.match(source,/Open in Messenger/);
 assert.match(source,/Stored history may be incomplete/);
 assert.match(source,/\.tabs\.hidden\{display:none\}/);
 assert.match(source,/Read only · Replies cannot be sent/);
 assert.match(source,/<option value="all">All conversations<\/option>/);
 assert.match(source,/setInterval\(\(\)=>\{if\(!document\.hidden/);
 for(const table of ['reachr_conversations','reachr_messages']) assert.match(source,new RegExp(`from\\('${table}'\\)`));
 assert.doesNotMatch(source,/id="draft"|id="saveDraft"|from\('reachr_reply_jobs'\)/);
 for(const route of ['conversations','messages','jobs','drafts']) assert.ok(!source.includes(`call('/${route}`));
});
