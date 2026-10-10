import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./reply-triage.js', import.meta.url), 'utf8');
const context = vm.createContext({ window: {}, Date });
vm.runInContext(source, context);
const { latestMessages, loadMessages } = context.window.reachrReplyTriage;

test('latest inbound is flagged and a later outbound clears it', () => {
  const latest = latestMessages([
    { conversation_id: 'answered', direction: 'inbound', observed_at: '2026-10-01T10:00:00Z' },
    { conversation_id: 'waiting', direction: 'outbound', observed_at: '2026-10-01T09:00:00Z' },
    { conversation_id: 'answered', direction: 'outbound', observed_at: '2026-10-01T11:00:00Z' },
    { conversation_id: 'waiting', direction: 'inbound', observed_at: '2026-10-01T12:00:00Z' },
  ]);
  assert.equal(latest.get('answered').direction, 'outbound');
  assert.equal(latest.get('waiting').direction, 'inbound');
});

test('message loader pages past the first thousand rows', async () => {
  const calls = [];
  const client = { from(table) {
    assert.equal(table, 'reachr_messages');
    return { select() { return this; }, order() { return this; }, async range(start, end) {
      calls.push([start, end]);
      return { data: start ? [{ conversation_id: 'last' }] : Array.from({ length: 1000 }, () => ({ conversation_id: 'first' })), error: null };
    } };
  } };
  assert.equal((await loadMessages(client)).length, 1001);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
});
