import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./operations.js', import.meta.url), 'utf8');
const triageSource = fs.readFileSync(new URL('./reply-triage.js', import.meta.url), 'utf8');

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
  let authRejected = false;
  let copied = '';
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
    navigator: { clipboard: { writeText: async text => { copied = text; } } },
    history: { replaceState() {} },
    location: { hash: '' },
    setInterval() {},
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (authRejected) return { ok: false, status: 401, json: async () => ({ error: 'expired' }) };
      return { ok: true, json: async () => url.endsWith('/reply') ? { status: 'confirmed' } : conversation };
    },
    URL,
    Date,
  });
  vm.runInContext(triageSource, context);
  const instrumented = source.replace(/\}\)\(\);\s*$/, 'globalThis.renderForTest = render;globalThis.renderDetailForTest = renderDetail;globalThis.showStoredArchiveFallbackForTest = showStoredArchiveFallback;globalThis.loadForTest = load;})();');
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

  assert.match(element('operationsContent').innerHTML, /Conversation queue/);
  assert.match(element('operationsContent').innerHTML, /Recent replies to review/);
  assert.match(element('operationsContent').innerHTML, /All sender accounts/);
  assert.match(element('operationsContent').innerHTML, /Sender and Page operations/);
  assert.match(element('operationsContent').innerHTML, /Messenger connection health/);
  assert.match(element('clientRows').innerHTML, /#conversation=aaaaaaaaaaaaaaaaaaaaaaaa/);
  assert.match(element('clientRows').innerHTML, /Review conversation/);
  assert.match(element('operationsContent').innerHTML, /Recent inbound to review/);
  assert.match(element('clientRows').innerHTML, /Recent reply to review/);
  assert.match(element('clientRows').innerHTML, /&lt;Client&gt;/);
  assert.doesNotMatch(element('clientRows').innerHTML, /<Client>/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Review Co/, 'older status flags are not in the default action queue');

  element('operationsContent').listeners.click({ target: { closest: selector => selector === '[data-inbox-filter]' ? { dataset: { inboxFilter: 'replies' } } : null } });
  assert.match(element('clientRows').innerHTML, /Recent reply to review/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Review Co/);
  element('operationsContent').listeners.click({ target: { closest: selector => selector === '[data-inbox-filter]' ? { dataset: { inboxFilter: 'all' } } : null } });

  element('senderFilter').listeners.change({ target: { value: 'Other sender' } });
  assert.match(element('clientRows').innerHTML, /No conversations match/);
  element('senderFilter').listeners.change({ target: { value: 'Jack' } });
  assert.match(element('clientRows').innerHTML, /Review Co/);

  element('clientFilter').listeners.change({ target: { value: 'review' } });
  assert.match(element('clientRows').innerHTML, /Review Co/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Recent reply to review/);
  element('clientSearch').listeners.input({ target: { value: 'missing' } });
  assert.match(element('clientRows').innerHTML, /No conversations match/);

  context.renderDetailForTest(conversation);
  assert.match(element('clientDetail').innerHTML, /Verified inbound/);
  assert.match(element('clientDetail').innerHTML, /Review and send/);
  assert.match(element('clientDetail').innerHTML, /checked the latest message/);
  assert.match(element('clientDetail').innerHTML, /Copy for Messenger/);
  element('clientStatus').value = 'waiting';
  element('clientNote').value = 'Follow up on Tuesday';
  await element('saveClient').listeners.click();
  const save = requests.find(request => request.options.method === 'PATCH');
  assert(save);
  assert.deepEqual(JSON.parse(save.options.body), { status: 'waiting', note: 'Follow up on Tuesday' });
  requests.length = 0;
  element('clientReplyText').value = 'An exact reply';
  element('clientReplySender').value = 'verified-jack';
  await element('clientCopy').listeners.click();
  assert.equal(copied, 'An exact reply');
  assert.match(element('clientSendState').textContent, /not sent|send there/i);
  await element('clientSend').listeners.click();
  assert.equal(requests.length, 0, 'declining confirmation must not contact the server');

  confirmed = true;
  await element('clientSend').listeners.click();
  assert.equal(requests.length, 0, 'unverified live thread must not send');
  element('clientLiveChecked').checked = true;
  await element('clientSend').listeners.click();
  const send = requests.find(request => request.url.endsWith('/reply'));
  assert(send);
  assert.equal(send.options.method, 'POST');
  assert.deepEqual(JSON.parse(send.options.body), { senderKey: 'verified-jack', text: 'An exact reply' });
  assert.equal(send.options.headers.Authorization, 'Bearer test-owner');
  assert.equal(element('clientReplyText').value, '');
  context.renderDetailForTest({ ...conversation, replyPending: false, replySenders: [] });
  assert.doesNotMatch(element('clientDetail').innerHTML, /id="clientSend"/);
  assert.match(element('clientDetail').innerHTML, /Copy for Messenger/);

  const oldId = 'c'.repeat(24);
  const autoId = 'd'.repeat(24);
  context.renderForTest({
    checkedAt: '2026-10-14T18:10:00Z',
    overview: { repliesWaiting: 3, needsAction: 3 },
    conversations: [
      { id: oldId, businessName: 'Old lead', accounts: ['Jack'], replyPending: true, status: 'awaiting_reply', lastVerifiedInboundText: 'Details please', lastVerifiedInboundAt: '2026-10-03T12:00:00Z', updatedAt: '2026-10-03T12:00:00Z' },
      { id: autoId, businessName: 'Auto lead', accounts: ['Jack'], replyPending: true, status: 'awaiting_reply', lastVerifiedInboundText: 'Thanks for contacting us. We received your message.', lastVerifiedInboundAt: '2026-10-14T18:05:00Z', updatedAt: '2026-10-14T18:05:00Z' },
      { id: replyId, businessName: 'Fresh question', accounts: ['Jack'], replyPending: true, status: 'awaiting_reply', lastVerifiedInboundText: 'Can we talk tomorrow?', lastVerifiedInboundAt: '2026-10-14T18:08:00Z', updatedAt: '2026-10-14T18:08:00Z' },
    ],
    replyInbox: [
      { conversationId: oldId, businessName: 'Old lead', sender: 'Jack', preview: 'Details please', detectedAt: '2026-10-03T12:00:00Z' },
      { conversationId: autoId, businessName: 'Auto lead', sender: 'Jack', preview: 'Thanks for contacting us. We received your message.', detectedAt: '2026-10-14T18:05:00Z' },
      { conversationId: replyId, businessName: 'Fresh question', sender: 'Jack', preview: 'Can we talk tomorrow?', detectedAt: '2026-10-14T18:08:00Z' },
    ],
    senders: [], actions: [], pages: [],
  });
  element('clientSearch').listeners.input({ target: { value: '' } });
  element('clientFilter').listeners.change({ target: { value: 'action' } });
  assert.match(element('operationsContent').innerHTML, /1 older stored reply flag/);
  assert.match(element('operationsContent').innerHTML, /1 recent likely auto-replies or declines/);
  assert.ok(element('operationsContent').innerHTML.indexOf('Fresh question') < element('operationsContent').innerHTML.indexOf('Old lead'), 'newest reply appears before historical flags');
  assert.match(element('clientRows').innerHTML, /Fresh question/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Old lead|Auto lead/);
  context.renderDetailForTest({ ...conversation, id: oldId, replyPending: true, replySenders: [{ key: 'verified-jack', name: 'Jack' }] });
  assert.doesNotMatch(element('clientDetail').innerHTML, /id="clientSend"/, 'old replies cannot be sent directly');
  context.renderDetailForTest({ ...conversation, id: autoId, replyPending: true, replySenders: [{ key: 'verified-jack', name: 'Jack' }] });
  assert.doesNotMatch(element('clientDetail').innerHTML, /id="clientSend"/, 'likely auto replies cannot be sent directly');

  context.window.reachrSupabaseClient.from = table => {
    return { select() { return this; }, eq() { return this; }, order() { return this; },
      async limit() { assert.equal(table, 'reachr_conversations'); return { data: [{ id: 'archived', business_name: 'Archived Co', recipient_name: 'Pat', sender_actor_name: 'Jack', messenger_url: 'https://www.messenger.com/t/123', updated_at: '2026-10-06T11:00:00Z' }], error: null }; },
      async range() { assert.equal(table, 'reachr_messages'); return { data: [{ conversation_id: 'archived', direction: 'inbound', body: 'Hello', observed_at: '2026-10-06T11:00:00Z', created_at: '2026-10-06T11:01:00Z' }], error: null }; },
    };
  };
  await context.showStoredArchiveFallbackForTest(new Error('offline'));
  assert.match(element('operationsContent').innerHTML, /Live outreach connection unavailable/);
  assert.match(element('archiveRows').innerHTML, /Archived Co/);
  assert.match(element('archiveRows').innerHTML, /Archive updated/);
  assert.match(element('archiveRows').innerHTML, /Potential reply/);
  assert.match(element('archivePriority').textContent, /1 archived chat/);
  assert.equal(element('showMoreArchive').hidden, true);
  assert.doesNotMatch(element('operationsContent').innerHTML, /Review and send/);

  authRejected = true;
  [...elements.values()].find(item => item.id === 'operationsPanel').hidden = false;
  await context.loadForTest(true);
  assert.match(element('operationsStatus').textContent, /Session expired/);
  assert.equal(element('operationsContent').textContent, '');
  assert.equal(element('clientDetail').hidden, true);
});
