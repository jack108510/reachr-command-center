(() => {
  const apiBase = 'https://n8n.wildeautomations.com/reachr-command-center/api';
  const nav = document.querySelector('.reachr-nav');
  const tab = document.createElement('button');
  tab.id = 'operationsTab';
  tab.className = 'reachr-tab';
  tab.type = 'button';
  tab.textContent = 'Messenger';
  tab.setAttribute('aria-selected', 'false');
  nav.insertBefore(tab, document.getElementById('overviewTab'));

  const panel = document.createElement('section');
  panel.id = 'operationsPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Messenger communication</div><h2>Conversation desk</h2><p class="caption">See the latest captured messages, review replies worth answering, and open the live thread for full context.</p></div><button class="reachr-tab" id="refreshOperations" type="button">Refresh</button></div><p class="caption" id="operationsStatus">Checking connected sender accounts…</p><section id="clientDetail" class="operations-client-detail" hidden></section><div id="operationsContent"></div></div>';
  document.getElementById('metaPanel').after(panel);

  const style = document.createElement('style');
  style.textContent = '.operations-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.operations-card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:16px;min-width:0}.operations-card h3{margin:0 0 8px;font-size:15px}.operations-card p{margin:5px 0;color:var(--muted);font-size:12px;line-height:1.5}.operations-card .warning{color:var(--positive)}.operations-section{margin-top:22px}.operations-section h3{font-size:17px}.operations-row{border-top:1px solid var(--line);padding:11px 0;font-size:12px;line-height:1.5}.operations-row small{display:block;color:var(--muted);margin-top:4px}.operations-row a{color:var(--reply);margin-right:14px}.operations-totals{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0}.operations-total{border:1px solid var(--line);border-radius:10px;padding:12px;min-width:140px;font-size:11px;color:var(--muted)}.operations-total strong{display:block;font-size:24px;color:var(--text)}.operations-tools{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.operations-tools input,.operations-tools select{background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--text);font:inherit;padding:9px 11px}.operations-tools input{flex:1;min-width:180px}.operations-tools select{min-width:160px}.operations-details{margin-top:24px}.operations-details summary{cursor:pointer;color:var(--muted);font-weight:700}@media(max-width:720px){.operations-grid{grid-template-columns:1fr}.operations-total{flex:1}}';
  style.textContent += '.operations-row button,.operations-client-detail button{background:#263744;border:1px solid #426078;border-radius:8px;color:var(--text);cursor:pointer;font:600 12px Manrope,sans-serif;padding:8px 11px;margin:7px 12px 0 0}.operations-client-detail{margin-top:26px;padding:20px;border:1px solid #526c60;border-radius:14px;background:#101d1b}.operations-client-detail[hidden]{display:none}.operations-client-detail h3{margin:0 0 7px}.operations-client-detail label{display:block;margin-top:16px;font-size:12px;font-weight:700}.operations-client-detail textarea,.operations-client-detail select{display:block;width:100%;margin-top:6px;padding:10px;background:#0d141a;color:var(--text);border:1px solid var(--line);border-radius:8px;font:inherit}.operations-client-detail textarea{min-height:100px;resize:vertical}.operations-client-detail button:disabled{opacity:.55;cursor:not-allowed}.operations-message{padding:12px;border-top:1px solid var(--line);font-size:13px;white-space:pre-wrap}.operations-message.outbound{background:#17231f}.operations-message small{display:block;color:var(--muted);margin-bottom:5px}.operations-preview{border-left:3px solid var(--positive);padding:9px 12px;margin:9px 0;color:var(--muted)}.operations-client-detail .warning{color:var(--positive)}';
  style.textContent += '#clientRows{max-height:480px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:0 12px}.operations-client-detail{scroll-margin-top:18px}';
  document.head.append(style);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const number = value => Number(value || 0).toLocaleString('en-CA');
  const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
  const recentWindowMs = 72 * 60 * 60 * 1000;
  const timestamp = value => Date.parse(value || '') || 0;
  const replyTime = (reply, conversation) => Math.max(timestamp(reply?.detectedAt), timestamp(conversation?.lastVerifiedInboundAt));
  const replyText = (reply, conversation) => timestamp(conversation?.lastVerifiedInboundAt) >= timestamp(reply?.detectedAt)
    ? conversation?.lastVerifiedInboundText || reply?.preview || '' : reply?.preview || conversation?.lastVerifiedInboundText || '';
  function replyCategory(text) {
    const body = String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (/^(no|no thanks|no thank you|not interested)[.!\s]*$/.test(body) || /\b(no thank you|not interested|not at this time|we already have|we have a solution in place|do not need|don't need|please leave me alone|we will hold off|we'll hold off)\b/.test(body)) return 'decline';
    if (/\b(thanks for (contacting|messaging|reaching out)|thank you for (contacting|messaging|reaching out)|we['’]?(ve| have) received your message|we['’]?(ll| will) get back to you|not here right now|away right now|outside (of )?business hours|one of our sales reps will be with you|you['’]?re no longer chatting with an ai agent)\b/.test(body)) return 'automatic';
    return 'review';
  }
  function triageReplies(data) {
    const conversations = new Map((data.conversations || []).map(item => [item.id, item]));
    const now = timestamp(data.checkedAt) || Date.now();
    const seen = new Set();
    const replyRecords = [...(data.replyInbox || [])];
    for (const conversation of data.conversations || []) {
      if (conversation.replyPending && !replyRecords.some(reply => reply.conversationId === conversation.id)) replyRecords.push({
        conversationId: conversation.id,
        businessName: conversation.businessName,
        sender: (conversation.accounts || []).join(', ') || 'Sender unknown',
        preview: conversation.lastVerifiedInboundText,
        detectedAt: conversation.lastVerifiedInboundAt,
      });
    }
    const entries = replyRecords.filter(reply => {
      if (seen.has(reply.conversationId)) return false;
      seen.add(reply.conversationId);
      return true;
    }).map(reply => {
      const conversation = conversations.get(reply.conversationId);
      const observedAt = replyTime(reply, conversation);
      const preview = replyText(reply, conversation);
      return { ...reply, observedAt, preview, category: replyCategory(preview), recent: observedAt > 0 && observedAt >= now - recentWindowMs };
    }).sort((left, right) => right.observedAt - left.observedAt);
    return { entries, actionable: entries.filter(reply => reply.recent && reply.category === 'review'), otherRecent: entries.filter(reply => reply.recent && reply.category !== 'review'), older: entries.filter(reply => !reply.recent) };
  }
  const safeMessenger = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['m.me', 'www.messenger.com', 'messenger.com', 'www.facebook.com', 'facebook.com'].includes(url.hostname) ? url.href : null;
    } catch { return null; }
  };
  let lastLoaded = 0;
  let currentData = null;
  let currentTriage = null;
  let clientQuery = '';
  let clientFilter = 'replies';
  let senderFilter = 'all';
  let visibleCount = 100;
  let selectedClientId = null;
  let detailBusy = false;

  async function apiRequest(path, options = {}) {
    const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
    if (error || !session?.access_token) {
      const failure = Error('Sign in again to manage conversations.');
      failure.authRequired = true;
      throw failure;
    }
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      cache: 'no-store',
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const failure = Error(response.status === 401 || response.status === 403 ? 'Sign in again to manage conversations.' : result.error || `Command Center request failed (${response.status}).`);
      failure.authRequired = response.status === 401 || response.status === 403;
      throw failure;
    }
    return response.json();
  }

  function renderDetail(conversation) {
    const detail = document.getElementById('clientDetail');
    detail.dataset.dirty = 'false';
    const messengerUrl = safeMessenger(conversation.messengerUrl);
    const previews = (conversation.candidatePreviews || []).map(preview => `<div class="operations-preview">Unverified preview · ${escapeHtml(date(preview.observedAt))}<br>${escapeHtml(preview.body)}</div>`).join('');
    const messages = (conversation.messages || []).map(message => `<div class="operations-message ${message.direction === 'outbound' ? 'outbound' : ''}"><small>${message.direction === 'outbound' ? 'Recorded outbound' : 'Verified inbound'} · ${escapeHtml(date(message.observedAt))}</small>${escapeHtml(message.body)}</div>`).join('') || '<p class="caption">No recorded messages. Check Messenger for the full thread.</p>';
    const pendingEntry = currentTriage?.entries.find(reply => reply.conversationId === conversation.id);
    const replyNeedsReview = Boolean(conversation.replyPending && pendingEntry?.recent && pendingEntry.category === 'review');
    const senders = replyNeedsReview ? conversation.replySenders || [] : [];
    const statuses = { needs_review: 'Needs review', awaiting_reply: 'Awaiting reply', interested: 'Interested', waiting: 'Waiting', closed: 'Closed' };
    const directSendNote = senders.length ? 'Open the live Messenger thread and check its latest message before sending.' : pendingEntry && !pendingEntry.recent ? 'This stored reply is over 72 hours old. Check the live Messenger thread; direct sending is paused here.' : pendingEntry?.category === 'decline' ? 'This looks like a decline. No reply is suggested; check the live thread if context differs.' : pendingEntry?.category === 'automatic' ? 'This looks like an automatic response. No reply is suggested; check the live thread if context differs.' : conversation.replyPending ? 'Direct sending is unavailable until the owning Facebook account passes its identity and inbox checks. Check the live thread first.' : 'No verified inbound reply is waiting. Use Messenger for any new message.';
    const composer = `<div class="operations-section operations-composer"><h3>Reply workspace</h3><p class="caption">${escapeHtml(directSendNote)}</p>${senders.length ? `<label for="clientReplySender">Facebook account</label><select id="clientReplySender">${senders.map(sender => `<option value="${escapeHtml(sender.key)}">${escapeHtml(sender.name)}</option>`).join('')}</select>` : ''}<label for="clientReplyText">Your message</label><textarea id="clientReplyText" maxlength="2000" placeholder="Write a specific reply for this conversation"></textarea>${senders.length ? '<label class="operations-live-check"><input id="clientLiveChecked" type="checkbox"> I checked the latest message in the live Messenger thread</label>' : ''}<div class="operations-composer-actions">${conversation.replyDraft ? '<button id="clientUseDraft" type="button">Use suggested starter</button>' : ''}<button id="clientCopy" type="button">Copy for Messenger</button>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}${senders.length ? '<button id="clientSend" type="button">Review and send</button>' : ''}</div><p id="clientSendState" class="caption" role="status">A copied message is not sent. Confirm delivery in Messenger.</p></div>`;
    detail.innerHTML = `<div class="chart-header"><div><div class="label">Client conversation</div><h3>${escapeHtml(conversation.businessName)}</h3><p class="caption">${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · ${number(conversation.verifiedReplyCount)} verified inbound</p></div><div><button id="reloadClient" type="button">Reload thread</button><button id="closeClient" type="button">Back to queue</button></div></div>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open full Messenger thread ↗</a>` : ''}<p class="warning">Stored history may be incomplete. Check Messenger before sending.</p>${previews}${messages}${composer}<div class="operations-section"><h3>Follow-up status</h3><label for="clientStatus">Status</label><select id="clientStatus">${Object.entries(statuses).map(([value, label]) => `<option value="${value}" ${conversation.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="clientNote">Private note</label><textarea id="clientNote" maxlength="2000" placeholder="Next action and context">${escapeHtml(conversation.note || '')}</textarea><button id="saveClient" type="button">Save status and note</button><p id="clientSaveState" class="caption" role="status">Changes stay private until saved.</p></div>`;
    for (const id of ['clientStatus', 'clientNote', 'clientReplyText']) document.getElementById(id)?.addEventListener('input', () => { detail.dataset.dirty = 'true'; });
    document.getElementById('reloadClient').addEventListener('click', () => openClient(conversation.id));
    document.getElementById('closeClient').addEventListener('click', () => {
      if (detailBusy) return;
      if (detail.dataset.dirty === 'true' && !window.confirm('Discard unsaved status, note, or reply text?')) return;
      selectedClientId = null;
      detail.hidden = true;
    });
    document.getElementById('saveClient').addEventListener('click', async () => {
      if (detailBusy) return;
      detailBusy = true;
      const button = document.getElementById('saveClient');
      const status = document.getElementById('clientStatus').value;
      const note = document.getElementById('clientNote').value;
      button.disabled = true;
      document.getElementById('clientSaveState').textContent = 'Saving…';
      try {
        await apiRequest(`/github-conversations/${conversation.id}`, { method: 'PATCH', body: JSON.stringify({ status, note }) });
        conversation.status = status;
        conversation.note = note;
        const summary = currentData?.conversations?.find(item => item.id === conversation.id);
        if (summary) { summary.status = status; summary.note = note; }
        if (currentData) renderClients();
        detail.dataset.dirty = document.getElementById('clientReplyText')?.value.trim() ? 'true' : 'false';
        document.getElementById('clientSaveState').textContent = 'Saved to the private Command Center.';
      } catch (error) { document.getElementById('clientSaveState').textContent = error.message; }
      finally { detailBusy = false; button.disabled = false; }
    });
    if (conversation.replyDraft) document.getElementById('clientUseDraft').addEventListener('click', () => { document.getElementById('clientReplyText').value = conversation.replyDraft; detail.dataset.dirty = 'true'; });
    document.getElementById('clientCopy').addEventListener('click', async () => {
      const text = document.getElementById('clientReplyText').value.trim();
      const state = document.getElementById('clientSendState');
      if (!text || /\[[^\]]+\]/.test(text)) { state.textContent = 'Write a complete reply and replace every placeholder.'; return; }
      try {
        await navigator.clipboard.writeText(text);
        state.textContent = 'Copied. Paste it in the live Messenger thread, send there, and confirm delivery there.';
      } catch (_) { state.textContent = 'Clipboard unavailable. Select and copy the text, then send it in Messenger.'; }
    });
    if (senders.length) document.getElementById('clientSend').addEventListener('click', async () => {
      if (detailBusy) return;
      const text = document.getElementById('clientReplyText').value.trim();
      const senderKey = document.getElementById('clientReplySender').value;
      const sender = senders.find(item => item.key === senderKey);
      const state = document.getElementById('clientSendState');
      if (!text || /\[[^\]]+\]/.test(text)) { state.textContent = 'Write a complete reply and replace every placeholder.'; return; }
      if (!document.getElementById('clientLiveChecked').checked) { state.textContent = 'Open the live Messenger thread and confirm its latest message before sending.'; return; }
      if (!window.confirm(`Send this exact reply to ${conversation.businessName} from ${sender?.name || 'the selected account'}?\n\n${text}\n\nCheck the Messenger thread before confirming.`)) return;
      detailBusy = true;
      document.getElementById('clientSend').disabled = true;
      document.getElementById('saveClient').disabled = true;
      state.textContent = 'Sending and verifying in Messenger…';
      try {
        const result = await apiRequest(`/github-conversations/${conversation.id}/reply`, { method: 'POST', body: JSON.stringify({ senderKey, text }) });
        if (result.status !== 'confirmed') throw Error('Delivery is uncertain. Check Messenger before trying again.');
        state.textContent = 'Reply confirmed in Messenger and recorded.';
        document.getElementById('clientReplyText').value = '';
        detail.dataset.dirty = 'false';
        await load(true);
        detailBusy = false;
        await openClient(conversation.id);
      } catch (error) { state.textContent = `${error.message} Check Messenger before trying again; do not resend blindly.`; }
      finally { detailBusy = false; if (currentData) document.getElementById('saveClient').disabled = false; }
    });
  }

  async function openClient(conversationId) {
    if (detailBusy) return;
    const existing = document.getElementById('clientDetail');
    if (selectedClientId && existing.dataset.dirty === 'true' && !window.confirm('Discard unsaved status, note, or reply text?')) return;
    selectedClientId = conversationId;
    const detail = existing;
    detail.hidden = false;
    detail.dataset.dirty = 'false';
    detail.textContent = 'Loading private conversation…';
    try {
      const conversation = await apiRequest(`/github-conversations/${encodeURIComponent(conversationId)}`);
      if (selectedClientId !== conversationId) return;
      renderDetail(conversation);
      detail.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    } catch (error) { if (selectedClientId === conversationId) detail.textContent = error.message; }
  }

  function renderClients() {
    const all = currentData?.conversations || [];
    const replyById = new Map((currentTriage?.entries || []).map(reply => [reply.conversationId, reply]));
    const query = clientQuery.trim().toLowerCase();
    const rows = all.filter(conversation => {
      const reply = replyById.get(conversation.id);
      if (clientFilter === 'action' && !(reply?.recent && reply.category === 'review')) return false;
      if (clientFilter === 'replies' && !reply?.recent) return false;
      if (clientFilter === 'review' && conversation.status !== 'needs_review') return false;
      if (['interested', 'waiting', 'closed'].includes(clientFilter) && conversation.status !== clientFilter) return false;
      if (senderFilter !== 'all' && !(conversation.accounts || []).includes(senderFilter)) return false;
      return !query || [conversation.businessName, conversation.recipientName, conversation.lastVerifiedInboundText, conversation.note, ...(conversation.accounts || [])].join(' ').toLowerCase().includes(query);
    }).sort((left, right) => Math.max(timestamp(right.lastVerifiedInboundAt), timestamp(right.updatedAt)) - Math.max(timestamp(left.lastVerifiedInboundAt), timestamp(left.updatedAt)));
    document.getElementById('clientCount').textContent = `${number(rows.length)} conversations in this view · ${number(Math.min(rows.length, visibleCount))} shown`;
    for (const button of document.getElementById('operationsContent').querySelectorAll('[data-inbox-filter]')) {
      const active = button.dataset.inboxFilter === clientFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    document.getElementById('clientRows').innerHTML = rows.slice(0, visibleCount).map(conversation => {
      const privateUrl = `https://n8n.wildeautomations.com/reachr-command-center/#conversation=${encodeURIComponent(conversation.id)}`;
      const messengerUrl = safeMessenger(conversation.messengerUrl);
      const reply = replyById.get(conversation.id);
      const urgent = reply?.recent && reply.category === 'review';
      const state = urgent ? 'Recent reply to review' : reply?.recent && reply.category === 'decline' ? 'Likely decline' : reply?.recent && reply.category === 'automatic' ? 'Likely auto-reply' : reply ? 'Older stored reply' : conversation.status === 'needs_review' ? 'Needs review' : conversation.status === 'interested' ? 'Interested' : conversation.status === 'waiting' ? 'Waiting' : conversation.status === 'closed' ? 'Closed' : 'Awaiting reply';
      return `<article class="operations-row ${urgent ? 'operations-row-urgent' : ''}"><div class="operations-row-head"><strong>${escapeHtml(conversation.businessName)}</strong><span class="operations-state ${urgent ? 'operations-state-urgent' : ''}">${escapeHtml(state)}</span></div><small>${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · Last activity ${escapeHtml(date(conversation.updatedAt))}</small>${reply ? `<small class="operations-reply-preview">${escapeHtml(reply.preview || 'Stored inbound message')} · Captured ${escapeHtml(date(reply.observedAt))}</small>` : ''}${conversation.candidateCount ? `<small>${number(conversation.candidateCount)} unverified preview(s) need checking in Messenger.</small>` : ''}<div class="operations-row-actions"><button type="button" data-client-id="${escapeHtml(conversation.id)}">Review conversation</button><a href="${escapeHtml(privateUrl)}" target="_blank" rel="noopener noreferrer">Private fallback ↗</a>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div></article>`;
    }).join('') || '<p class="caption">No conversations match this view.</p>';
    document.getElementById('showMoreClients').hidden = rows.length <= visibleCount;
  }

  function render(data) {
    tab.textContent = 'Messenger';
    document.getElementById('operationsStatus').textContent = `Feed checked ${date(data.checkedAt)} · newest captured message may differ from live Messenger`;
    currentData = data;
    currentTriage = triageReplies(data);
    const conversations = new Map((data.conversations || []).map(item => [item.id, item]));
    const latestCaptured = currentTriage.entries[0]?.observedAt;
    const totals = `<div class="operations-totals"><div class="operations-total">Recent replies to review<strong>${number(currentTriage.actionable.length)}</strong></div><div class="operations-total">Likely auto / decline<strong>${number(currentTriage.otherRecent.length)}</strong></div><div class="operations-total">Newest captured inbound<strong class="operations-latest-time">${escapeHtml(latestCaptured ? date(latestCaptured) : 'None')}</strong></div></div>`;
    const jackReplyStatus = data.senders.find(sender => sender.name === 'Jack Sereda')?.replyStatus;
    const jackSyncNotice = jackReplyStatus && jackReplyStatus !== 'current'
      ? `<div class="operations-offline" role="status"><strong>Jack Messenger sync: ${escapeHtml(jackReplyStatus.replaceAll('_', ' '))}</strong><p>Some Jack conversations may have newer messages than this feed. Open the live Messenger thread before replying; the checker is still working through his recorded chats.</p></div>`
      : '';
    const senderHealth = `<section class="operations-section" aria-label="Messenger connection health"><h3>Messenger connection health</h3><p class="caption">These checks cover recorded sender accounts. Personal Messenger inboxes may contain additional conversations.</p>${data.senders.map(sender => `<div class="operations-row"><strong>${escapeHtml(sender.name)}</strong><small>Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)} · Window: ${escapeHtml(sender.campaignState)}</small>${sender.blockers.length ? `<small class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</small>` : ''}</div>`).join('') || '<p class="warning">No sender accounts were reported by the live service.</p>'}</section>`;
    const senders = `<section class="operations-section"><h3>Messenger senders</h3><div class="operations-grid">${data.senders.map(sender => `<article class="operations-card"><h3>${escapeHtml(sender.name)}</h3><p>${number(sender.confirmedToday)} confirmed today · ${number(sender.totalConfirmed)} total · ${number(sender.eligible)} eligible</p><p>Window: ${escapeHtml(sender.campaignState)} · Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)}</p><p>Last confirmed: ${escapeHtml(date(sender.lastConfirmedAt))}</p>${sender.blockers.length ? `<p class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</p>` : ''}</article>`).join('')}</div></section>`;
    const replyRow = (reply, urgent) => { const conversation = conversations.get(reply.conversationId); const url = safeMessenger(conversation?.messengerUrl); const label = urgent ? 'Review latest message' : reply.category === 'decline' ? 'Likely decline · no reply suggested' : reply.category === 'automatic' ? 'Likely auto-reply · no reply suggested' : 'Older stored reply'; return `<article class="operations-row ${urgent ? 'operations-row-urgent' : ''}"><div class="operations-row-head"><strong>${escapeHtml(reply.businessName)}</strong><span class="operations-state ${urgent ? 'operations-state-urgent' : ''}">${label}</span></div><small>${escapeHtml(reply.sender)} · Captured ${escapeHtml(date(reply.observedAt))}</small><small class="operations-reply-preview">${escapeHtml(reply.preview)}</small><div class="operations-row-actions"><button type="button" data-client-id="${escapeHtml(reply.conversationId)}">Review conversation</button>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div></article>`; };
    const recentEntries = currentTriage.entries.filter(reply => reply.recent);
    const replies = `<section class="operations-section"><h3>Latest captured inbound</h3><p class="caption">Newest messages first · past 72 hours. Labels help triage; check the live Messenger thread for anything newer before responding.</p>${recentEntries.length ? recentEntries.slice(0, 5).map(reply => replyRow(reply, reply.category === 'review')).join('') : '<p class="caption">No inbound messages captured in the past 72 hours.</p>'}${recentEntries.length > 5 ? `<details class="operations-details"><summary>Show ${number(recentEntries.length - 5)} more recent messages</summary>${recentEntries.slice(5).map(reply => replyRow(reply, reply.category === 'review')).join('')}</details>` : ''}${currentTriage.older.length ? `<details class="operations-details"><summary>${number(currentTriage.older.length)} older stored reply flags · historical review only</summary><p class="caption">These are over 72 hours old. The live Messenger conversation may have changed.</p>${currentTriage.older.map(reply => replyRow(reply, false)).join('')}</details>` : ''}</section>`;
    const accountNames = [...new Set((data.conversations || []).flatMap(conversation => conversation.accounts || []))].sort();
    const senderOptions = accountNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    const clients = `<section class="operations-section"><h3>Conversation queue</h3><p class="caption">Recent captured replies are shown first. All recorded chats are available for historical review; personal Messenger inboxes may contain newer messages.</p><div class="operations-quick-filters" aria-label="Conversation views"><button type="button" data-inbox-filter="action">Recent to review</button><button type="button" data-inbox-filter="replies">All recent inbound</button><button type="button" data-inbox-filter="interested">Interested</button><button type="button" data-inbox-filter="waiting">Waiting</button><button type="button" data-inbox-filter="all">All history</button></div><div class="operations-tools"><input id="clientSearch" type="search" aria-label="Search Messenger conversations" placeholder="Search business, person, reply, or note" value="${escapeHtml(clientQuery)}"><select id="senderFilter" aria-label="Filter by Facebook account"><option value="all">All sender accounts</option>${senderOptions}</select><select id="clientFilter" aria-label="Filter conversations"><option value="action">Recent to review</option><option value="replies">All recent inbound</option><option value="all">All recorded chats</option><option value="review">Needs review status</option><option value="interested">Interested</option><option value="waiting">Waiting</option><option value="closed">Closed</option></select></div><p id="clientCount" class="caption"></p><div id="clientRows"></div><button id="showMoreClients" type="button" class="reachr-tab" hidden>Show more conversations</button></section>`;
    const actions = `<section class="operations-section"><h3>Needs action</h3>${data.actions.length ? data.actions.map(action => `<div class="operations-row"><strong>${escapeHtml(action.title)}</strong>${action.detail ? `<small>${escapeHtml(action.detail)}</small>` : ''}</div>`).join('') : '<p class="caption">No active issues recorded.</p>'}</section>`;
    const pages = `<section class="operations-section"><h3>Page posting</h3><div class="operations-grid">${data.pages.map(page => `<article class="operations-card"><h3>${escapeHtml(page.name)}</h3><p>Connection: ${escapeHtml(page.connection)} · Posting: ${escapeHtml(page.postingStatus)}</p></article>`).join('')}</div></section>`;
    document.getElementById('operationsContent').innerHTML = jackSyncNotice + totals + replies + clients + `<details class="operations-details"><summary>Sender and Page operations</summary>${senderHealth}${actions}${senders}${pages}</details>`;
    document.getElementById('clientFilter').value = clientFilter;
    document.getElementById('senderFilter').value = accountNames.includes(senderFilter) ? senderFilter : 'all';
    if (!accountNames.includes(senderFilter)) senderFilter = 'all';
    document.getElementById('clientSearch').addEventListener('input', event => { clientQuery = event.target.value; renderClients(); });
    document.getElementById('clientFilter').addEventListener('change', event => { clientFilter = event.target.value; renderClients(); });
    document.getElementById('senderFilter').addEventListener('change', event => { senderFilter = event.target.value; visibleCount = 100; renderClients(); });
    document.getElementById('showMoreClients').addEventListener('click', () => { visibleCount += 100; renderClients(); });
    renderClients();
  }

  async function showStoredArchiveFallback(error) {
    const content = document.getElementById('operationsContent');
    const client = window.reachrSupabaseClient;
    if (!client) throw error;
    const { data, error: archiveError } = await client.from('reachr_conversations')
      .select('id,business_name,recipient_name,sender_actor_name,messenger_url,updated_at')
      .eq('marketplace_excluded', false).order('updated_at', { ascending: false }).limit(1000);
    if (archiveError) throw archiveError;
    const rows = data || [];
    let needsReply = new Set();
    let triageAvailable = true;
    try {
      const latest = window.reachrReplyTriage.latestMessages(await window.reachrReplyTriage.loadMessages(client));
      needsReply = new Set([...latest].filter(([, message]) => message.direction === 'inbound').map(([id]) => id));
    } catch (_) { triageAvailable = false; }
    tab.textContent = 'Messenger archive';
    document.getElementById('operationsStatus').textContent = 'Live outreach connection unavailable · showing stored outreach archive';
    content.innerHTML = `<div class="operations-offline"><strong>Live outreach connection unavailable.</strong><p>The archive can flag potential unanswered replies, but it cannot guarantee that new messages are captured. Verify each flagged thread in Messenger. Reply sending and follow-up changes require the live connection.</p><button type="button" id="openStoredInbox">Open stored inbox</button></div><section class="operations-section"><h3>Stored conversations</h3><p id="archivePriority" class="operations-priority"></p><p id="archiveCount" class="caption"></p><div class="operations-archive-tools"><input id="archiveSearch" type="search" aria-label="Search stored conversations" placeholder="Search business, contact, or sender"><select id="archiveFilter" aria-label="Filter stored conversations"><option value="needs">Potential replies to check</option><option value="all">All stored chats</option></select></div><div id="archiveRows"></div><button id="showMoreArchive" type="button" class="reachr-tab" hidden>Show more archived chats</button></section>`;
    if (!triageAvailable || !rows.some(row => needsReply.has(row.id))) document.getElementById('archiveFilter').value = 'all';
    const priorityCount = rows.filter(row => needsReply.has(row.id)).length;
    document.getElementById('archivePriority').textContent = triageAvailable ? `${number(priorityCount)} archived ${priorityCount === 1 ? 'chat' : 'chats'} may need a reply · check in Messenger` : 'Reply check unavailable · open Messenger to review new messages';
    let archiveVisibleCount = 100;
    const renderRows = () => {
      const query = document.getElementById('archiveSearch').value.trim().toLowerCase();
      const filter = document.getElementById('archiveFilter').value;
      const matching = rows.filter(row => (filter !== 'needs' || needsReply.has(row.id)) && (!query || [row.business_name, row.recipient_name, row.sender_actor_name].join(' ').toLowerCase().includes(query)));
      document.getElementById('archiveCount').textContent = `${number(matching.length)} archived records match · ${number(Math.min(matching.length, archiveVisibleCount))} shown · sender names appear when recorded`;
      document.getElementById('archiveRows').innerHTML = matching.slice(0, archiveVisibleCount).map(row => {
        const url = safeMessenger(row.messenger_url);
        return `<div class="operations-row"><strong>${escapeHtml(row.business_name)}</strong>${needsReply.has(row.id) ? '<span class="operations-reply-flag">Potential reply · verify in Messenger</span>' : ''}<small>${escapeHtml(row.recipient_name || 'Recipient unconfirmed')} · ${escapeHtml(row.sender_actor_name || 'Sender not recorded')} · Archive updated ${escapeHtml(date(row.updated_at))}</small>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div>`;
      }).join('') || '<p class="caption">No stored conversations match this search.</p>';
      document.getElementById('showMoreArchive').hidden = matching.length <= archiveVisibleCount;
    };
    document.getElementById('archiveSearch').addEventListener('input', () => { archiveVisibleCount = 100; renderRows(); });
    document.getElementById('archiveFilter').addEventListener('change', () => { archiveVisibleCount = 100; renderRows(); });
    document.getElementById('showMoreArchive').addEventListener('click', () => { archiveVisibleCount += 100; renderRows(); });
    document.getElementById('openStoredInbox').addEventListener('click', () => document.getElementById('inboxTab').click());
    renderRows();
  }

  async function load(force = false) {
    if (panel.hidden || document.querySelector('main').hidden || !force && (Date.now() - lastLoaded < 60000 || document.activeElement?.matches('#clientSearch,#clientFilter,#senderFilter,#archiveSearch,#clientStatus,#clientNote,#clientReplyText'))) return;
    document.getElementById('operationsStatus').textContent = 'Checking live outreach records…';
    try {
      render(await apiRequest('/github-operations'));
      lastLoaded = Date.now();
    } catch (error) {
      currentData = null;
      currentTriage = null;
      document.getElementById('operationsContent').textContent = '';
      if (error.authRequired) {
        document.getElementById('operationsStatus').textContent = 'Session expired · sign in again to view Messenger outreach.';
        document.getElementById('clientDetail').hidden = true;
        return;
      }
      document.getElementById('operationsStatus').textContent = `${error.message} Checking stored archive…`;
      try { await showStoredArchiveFallback(error); }
      catch (archiveError) { document.getElementById('operationsStatus').textContent = `${error.message} Stored archive unavailable: ${archiveError.message}`; }
      const detail = document.getElementById('clientDetail');
      if (!detail.hidden) {
        document.getElementById('clientSend')?.setAttribute('disabled', '');
        document.getElementById('saveClient')?.setAttribute('disabled', '');
        const state = document.getElementById('clientSaveState');
        if (state) state.textContent = 'Connection unavailable. Reopen this conversation after it returns; unsaved text remains here.';
      }
    }
  }

  tab.addEventListener('click', () => {
    document.getElementById('overviewPanel').hidden = true;
    document.getElementById('inboxPanel').hidden = true;
    document.getElementById('metaPanel').hidden = true;
    panel.hidden = false;
    for (const button of nav.querySelectorAll('button')) { button.classList.remove('active'); button.setAttribute('aria-selected', 'false'); }
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    history.replaceState(null, '', '#operations');
    load();
  });
  for (const id of ['overviewTab', 'inboxTab']) document.getElementById(id).addEventListener('click', () => {
    panel.hidden = true;
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  document.getElementById('refreshOperations').addEventListener('click', () => load(true));
  document.getElementById('operationsContent').addEventListener('click', event => {
    const filter = event.target.closest('[data-inbox-filter]');
    if (filter) {
      clientFilter = filter.dataset.inboxFilter;
      document.getElementById('clientFilter').value = clientFilter;
      visibleCount = 100;
      renderClients();
      return;
    }
    const button = event.target.closest('[data-client-id]');
    if (button) openClient(button.dataset.clientId);
  });
  window.addEventListener('focus', () => load());
  window.addEventListener('reachr-auth-open', () => load());
  setInterval(load, 60000);
  if (!window.wildroseInitialSection || window.wildroseInitialSection === '#operations') tab.click();
})();
