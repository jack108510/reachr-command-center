import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./operations.js', import.meta.url), 'utf8');

test('client communications prioritizes verified replies and requires confirmation to send', async () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML: '', textContent: '', value: '', hidden: false, listeners: {}, dataset: {},
      classList: { add() {}, remove() {} },
      addEventListener(type, callback) { this.listeners[type] = callback; }, click() { this.listeners.click?.(); },
      setAttribute() {}, insertBefore() {}, after() {}, querySelectorAll() { return []; }, scrollIntoView() {},
    });
    return elements.get(id);
  }
  const document = {
    head: { append() {} },
    createElement: () => element(`created-${elements.size}`),
    getElementById: element,
    querySelector: selector => selector === '.reachr-nav' ? element('nav') : element('main'),
  };
  let confirmed = false;
  const requests = [];
  const conversation = {
    id: 'a'.repeat(24), businessName: '<Client>', recipientName: 'Sam', accounts: ['Jack'],
    status: 'interested', note: '', replyPending: true, verifiedReplyCount: 1,
    messages: [{ direction: 'inbound', body: 'Can we talk?', observedAt: '2026-10-06T11:00:00Z' }],
    candidatePreviews: [], replySenders: [{ key: 'verified-jack', name: 'Jack' }],
    replyDraft: 'Thanks for replying.',
  };
  const context = vm.createContext({
    document,
    window: {
      addEventListener() {}, wildroseInitialSection: '#overview', confirm: () => confirmed,
      reachrSupabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-owner' } } }) } },
    },
    history: { replaceState() {} },
    location: { hash: '' },
    setInterval() {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => url.endsWith('/reply') ? { status: 'confirmed' } : conversation };
    },
    URL,
    Date,
  });
  const instrumented = source.replace(/\}\)\(\);\s*$/, 'globalThis.renderForTest = render;globalThis.renderDetailForTest = renderDetail;globalThis.showStoredArchiveFallbackForTest = showStoredArchiveFallback;})();');
  assert.notEqual(instrumented, source);
  vm.runInContext(instrumented, context);

  const replyId = 'a'.repeat(24);
  const reviewId = 'b'.repeat(24);
  context.renderForTest({
    checkedAt: '2026-10-06T12:00:00Z',
    overview: { confirmedToday: 1, repliesWaiting: 1, needsAction: 1 },
    conversations: [
      { id: reviewId, businessName: 'Review Co', recipientName: 'Pat', accounts: ['Jack'], status: 'needs_review', updatedAt: '2026-10-06T12:00:00Z', candidateCount: 1 },
      { id: replyId, businessName: '<Client>', recipientName: 'Sam', accounts: ['Jack'], status: 'interested', replyPending: true, lastVerifiedInboundText: 'Can we talk?', lastVerifiedInboundAt: '2026-10-06T11:00:00Z', updatedAt: '2026-10-06T11:00:00Z', messengerUrl: 'https://www.messenger.com/t/123' },
    ],
    replyInbox: [{ conversationId: replyId, businessName: '<Client>', sender: 'Jack', preview: 'Can we talk?', detectedAt: '2026-10-06T11:00:00Z' }],
    senders: [], actions: [], pages: [],
  });

  assert.match(element('operationsContent').innerHTML, /Recorded conversations/);
  assert.match(element('operationsContent').innerHTML, /All sender accounts/);
  assert.match(element('operationsContent').innerHTML, /Sender and Page operations/);
  assert.match(element('clientRows').innerHTML, /#conversation=aaaaaaaaaaaaaaaaaaaaaaaa/);
  assert.match(element('clientRows').innerHTML, /Open here/);
  assert.match(element('operationsContent').innerHTML, /Open and reply here/);
  assert.match(element('clientRows').innerHTML, /Verified reply waiting/);
  assert.match(element('clientRows').innerHTML, /&lt;Client&gt;/);
  assert.doesNotMatch(element('clientRows').innerHTML, /<Client>/);
  assert.ok(element('clientRows').innerHTML.indexOf('Verified reply waiting') < element('clientRows').innerHTML.indexOf('Review Co'));

  element('senderFilter').listeners.change({ target: { value: 'Other sender' } });
  assert.match(element('clientRows').innerHTML, /No conversations match/);
  element('senderFilter').listeners.change({ target: { value: 'Jack' } });
  assert.match(element('clientRows').innerHTML, /Review Co/);

  element('clientFilter').listeners.change({ target: { value: 'review' } });
  assert.match(element('clientRows').innerHTML, /Review Co/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Verified reply waiting/);
  element('clientSearch').listeners.input({ target: { value: 'missing' } });
  assert.match(element('clientRows').innerHTML, /No conversations match/);

  context.renderDetailForTest(conversation);
  assert.match(element('clientDetail').innerHTML, /Verified inbound/);
  assert.match(element('clientDetail').innerHTML, /Review and send/);
  element('clientStatus').value = 'waiting';
  element('clientNote').value = 'Follow up on Tuesday';
  await element('saveClient').listeners.click();
  const save = requests.find(request => request.options.method === 'PATCH');
  assert(save);
  assert.deepEqual(JSON.parse(save.options.body), { status: 'waiting', note: 'Follow up on Tuesday' });
  requests.length = 0;
  element('clientReplyText').value = 'An exact reply';
  element('clientReplySender').value = 'verified-jack';
  await element('clientSend').listeners.click();
  assert.equal(requests.length, 0, 'declining confirmation must not contact the server');

  confirmed = true;
  await element('clientSend').listeners.click();
  const send = requests.find(request => request.url.endsWith('/reply'));
  assert(send);
  assert.equal(send.options.method, 'POST');
  assert.deepEqual(JSON.parse(send.options.body), { senderKey: 'verified-jack', text: 'An exact reply' });
  assert.equal(send.options.headers.Authorization, 'Bearer test-owner');
  assert.equal(element('clientReplyText').value, '');
  context.renderDetailForTest({ ...conversation, replyPending: false, replySenders: [] });
  assert.doesNotMatch(element('clientDetail').innerHTML, /id="clientSend"/);

  context.window.reachrSupabaseClient.from = table => {
    assert.equal(table, 'reachr_conversations');
    return { select() { return this; }, eq() { return this; }, order() { return this; }, async limit() { return { data: [{ business_name: 'Archived Co', recipient_name: 'Pat', sender_actor_name: 'Jack', messenger_url: 'https://www.messenger.com/t/123', updated_at: '2026-10-06T11:00:00Z' }], error: null }; } };
  };
  await context.showStoredArchiveFallbackForTest(new Error('offline'));
  assert.match(element('operationsContent').innerHTML, /Live sender accounts are offline/);
  assert.match(element('archiveRows').innerHTML, /Archived Co/);
  assert.doesNotMatch(element('operationsContent').innerHTML, /Review and send/);
});
