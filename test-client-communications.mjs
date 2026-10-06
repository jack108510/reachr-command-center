import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./operations.js', import.meta.url), 'utf8');

test('client communications prioritizes verified replies and links to exact private threads', () => {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML: '', textContent: '', value: '', hidden: false, listeners: {},
      classList: { add() {}, remove() {} },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute() {}, insertBefore() {}, after() {}, querySelectorAll() { return []; },
    });
    return elements.get(id);
  }
  const document = {
    head: { append() {} },
    createElement: () => element(`created-${elements.size}`),
    getElementById: element,
    querySelector: selector => selector === '.reachr-nav' ? element('nav') : element('main'),
  };
  const context = vm.createContext({
    document,
    window: { addEventListener() {}, wildroseInitialSection: '' },
    history: { replaceState() {} },
    location: { hash: '' },
    setInterval() {},
    URL,
    Date,
  });
  const instrumented = source.replace(/\}\)\(\);\s*$/, 'globalThis.renderForTest = render;})();');
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

  assert.match(element('operationsContent').innerHTML, /Client follow-ups/);
  assert.match(element('operationsContent').innerHTML, /Sender and Page operations/);
  assert.match(element('clientRows').innerHTML, /#conversation=aaaaaaaaaaaaaaaaaaaaaaaa/);
  assert.match(element('clientRows').innerHTML, /Verified reply waiting/);
  assert.match(element('clientRows').innerHTML, /&lt;Client&gt;/);
  assert.doesNotMatch(element('clientRows').innerHTML, /<Client>/);
  assert.ok(element('clientRows').innerHTML.indexOf('Verified reply waiting') < element('clientRows').innerHTML.indexOf('Review Co'));

  element('clientFilter').listeners.change({ target: { value: 'review' } });
  assert.match(element('clientRows').innerHTML, /Review Co/);
  assert.doesNotMatch(element('clientRows').innerHTML, /Verified reply waiting/);
  element('clientSearch').listeners.input({ target: { value: 'missing' } });
  assert.match(element('clientRows').innerHTML, /No conversations match/);
});
