import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./private.html',import.meta.url),'utf8');
test('Messenger desk exposes review, search and exact thread handoff without a fake send button',()=>{
 for(const id of ['inboxSearch','inboxFilter','inboxSummary','threadHeader','openMessenger','draftHistory']) assert.match(source,new RegExp(`id="${id}"`));
 assert.match(source,/Review in Messenger/);
 assert.match(source,/Unverified preview/);
 assert.match(source,/Saved draft/);
 assert.match(source,/No automatic sending/);
});
