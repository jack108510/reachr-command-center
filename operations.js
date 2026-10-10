(() => {
  const apiBase = 'https://n8n.wildeautomations.com/reachr-command-center/api';
  const nav = document.querySelector('.reachr-nav');
  const tab = document.createElement('button');
  tab.id = 'operationsTab';
  tab.className = 'reachr-tab';
  tab.type = 'button';
  tab.textContent = 'Messenger hub';
  tab.setAttribute('aria-selected', 'false');
  nav.insertBefore(tab, document.getElementById('overviewTab'));

  const panel = document.createElement('section');
  panel.id = 'operationsPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Sender accounts · one workspace</div><h2>Messenger hub</h2><p class="caption">Search recorded chats, review replies, manage follow-ups, and open the exact Messenger thread.</p></div><button class="reachr-tab" id="refreshOperations" type="button">Refresh</button></div><p class="caption" id="operationsStatus">Checking connected sender accounts…</p><section id="clientDetail" class="operations-client-detail" hidden></section><div id="operationsContent"></div></div>';
  document.getElementById('metaPanel').after(panel);

  const style = document.createElement('style');
  style.textContent = '.operations-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.operations-card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:16px;min-width:0}.operations-card h3{margin:0 0 8px;font-size:15px}.operations-card p{margin:5px 0;color:var(--muted);font-size:12px;line-height:1.5}.operations-card .warning{color:var(--positive)}.operations-section{margin-top:22px}.operations-section h3{font-size:17px}.operations-row{border-top:1px solid var(--line);padding:11px 0;font-size:12px;line-height:1.5}.operations-row small{display:block;color:var(--muted);margin-top:4px}.operations-row a{color:var(--reply);margin-right:14px}.operations-totals{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0}.operations-total{border:1px solid var(--line);border-radius:10px;padding:12px;min-width:140px;font-size:11px;color:var(--muted)}.operations-total strong{display:block;font-size:24px;color:var(--text)}.operations-tools{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.operations-tools input,.operations-tools select{background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--text);font:inherit;padding:9px 11px}.operations-tools input{flex:1;min-width:180px}.operations-tools select{min-width:160px}.operations-details{margin-top:24px}.operations-details summary{cursor:pointer;color:var(--muted);font-weight:700}@media(max-width:720px){.operations-grid{grid-template-columns:1fr}.operations-total{flex:1}}';
  style.textContent += '.operations-row button,.operations-client-detail button{background:#263744;border:1px solid #426078;border-radius:8px;color:var(--text);cursor:pointer;font:600 12px Manrope,sans-serif;padding:8px 11px;margin:7px 12px 0 0}.operations-client-detail{margin-top:26px;padding:20px;border:1px solid #526c60;border-radius:14px;background:#101d1b}.operations-client-detail[hidden]{display:none}.operations-client-detail h3{margin:0 0 7px}.operations-client-detail label{display:block;margin-top:16px;font-size:12px;font-weight:700}.operations-client-detail textarea,.operations-client-detail select{display:block;width:100%;margin-top:6px;padding:10px;background:#0d141a;color:var(--text);border:1px solid var(--line);border-radius:8px;font:inherit}.operations-client-detail textarea{min-height:100px;resize:vertical}.operations-client-detail button:disabled{opacity:.55;cursor:not-allowed}.operations-message{padding:12px;border-top:1px solid var(--line);font-size:13px;white-space:pre-wrap}.operations-message.outbound{background:#17231f}.operations-message small{display:block;color:var(--muted);margin-bottom:5px}.operations-preview{border-left:3px solid var(--positive);padding:9px 12px;margin:9px 0;color:var(--muted)}.operations-client-detail .warning{color:var(--positive)}';
  style.textContent += '#clientRows{max-height:480px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:0 12px}.operations-client-detail{scroll-margin-top:18px}';
  document.head.append(style);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const number = value => Number(value || 0).toLocaleString('en-CA');
  const date = value => value ? new Date(value).toLocaleString() : 'Not recorded';
  const safeMessenger = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && ['m.me', 'www.messenger.com', 'messenger.com', 'www.facebook.com', 'facebook.com'].includes(url.hostname) ? url.href : null;
    } catch { return null; }
  };
  let lastLoaded = 0;
  let currentData = null;
  let clientQuery = '';
  let clientFilter = 'all';
  let senderFilter = 'all';
  let visibleCount = 100;
  let selectedClientId = null;
  let detailBusy = false;

  async function apiRequest(path, options = {}) {
    const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
    if (error || !session?.access_token) throw Error('Sign in again to manage conversations.');
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      cache: 'no-store',
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw Error(response.status === 401 ? 'Sign in again to manage conversations.' : result.error || `Command Center request failed (${response.status}).`);
    }
    return response.json();
  }

  function renderDetail(conversation) {
    const detail = document.getElementById('clientDetail');
    detail.dataset.dirty = 'false';
    const messengerUrl = safeMessenger(conversation.messengerUrl);
    const previews = (conversation.candidatePreviews || []).map(preview => `<div class="operations-preview">Unverified preview · ${escapeHtml(date(preview.observedAt))}<br>${escapeHtml(preview.body)}</div>`).join('');
    const messages = (conversation.messages || []).map(message => `<div class="operations-message ${message.direction === 'outbound' ? 'outbound' : ''}"><small>${message.direction === 'outbound' ? 'Recorded outbound' : 'Verified inbound'} · ${escapeHtml(date(message.observedAt))}</small>${escapeHtml(message.body)}</div>`).join('') || '<p class="caption">No recorded messages. Check Messenger for the full thread.</p>';
    const senders = conversation.replyPending ? conversation.replySenders || [] : [];
    const statuses = { needs_review: 'Needs review', awaiting_reply: 'Awaiting reply', interested: 'Interested', waiting: 'Waiting', closed: 'Closed' };
    const composer = senders.length ? `<div class="operations-section"><h3>Send a reply</h3><p class="caption">Review the live Messenger thread first. Sending is manual and the server rechecks the exact sender, recipient, and verified inbound reply.</p><label for="clientReplySender">Facebook account</label><select id="clientReplySender">${senders.map(sender => `<option value="${escapeHtml(sender.key)}">${escapeHtml(sender.name)}</option>`).join('')}</select><label for="clientReplyText">Exact message</label><textarea id="clientReplyText" maxlength="2000" placeholder="Write your reply"></textarea>${conversation.replyDraft ? '<button id="clientUseDraft" type="button">Use suggested starter</button>' : ''}<button id="clientSend" type="button">Review and send</button><p id="clientSendState" class="caption" role="status">Nothing sends until you confirm.</p></div>` : `<p class="warning">${conversation.replyPending ? 'Sending is unavailable until the owning Facebook account passes its identity and inbox checks.' : 'No verified inbound reply is waiting. Sending from this view is disabled.'}</p>`;
    detail.innerHTML = `<div class="chart-header"><div><div class="label">Client conversation</div><h3>${escapeHtml(conversation.businessName)}</h3><p class="caption">${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · ${number(conversation.verifiedReplyCount)} verified inbound</p></div><div><button id="reloadClient" type="button">Reload thread</button><button id="closeClient" type="button">Close</button></div></div>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open full Messenger thread ↗</a>` : ''}<p class="warning">Stored history may be incomplete. Check Messenger before sending.</p>${previews}${messages}<div class="operations-section"><h3>Follow-up status</h3><label for="clientStatus">Status</label><select id="clientStatus">${Object.entries(statuses).map(([value, label]) => `<option value="${value}" ${conversation.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="clientNote">Private note</label><textarea id="clientNote" maxlength="2000" placeholder="Next action and context">${escapeHtml(conversation.note || '')}</textarea><button id="saveClient" type="button">Save status and note</button><p id="clientSaveState" class="caption" role="status">Changes stay private until saved.</p></div>${composer}`;
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
    if (conversation.replyDraft && senders.length) document.getElementById('clientUseDraft').addEventListener('click', () => { document.getElementById('clientReplyText').value = conversation.replyDraft; detail.dataset.dirty = 'true'; });
    if (senders.length) document.getElementById('clientSend').addEventListener('click', async () => {
      if (detailBusy) return;
      const text = document.getElementById('clientReplyText').value.trim();
      const senderKey = document.getElementById('clientReplySender').value;
      const sender = senders.find(item => item.key === senderKey);
      const state = document.getElementById('clientSendState');
      if (!text || /\[[^\]]+\]/.test(text)) { state.textContent = 'Write a complete reply and replace every placeholder.'; return; }
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
    const query = clientQuery.trim().toLowerCase();
    const rows = all.filter(conversation => {
      if (clientFilter === 'action' && !conversation.replyPending && conversation.status !== 'needs_review' && conversation.status !== 'interested') return false;
      if (clientFilter === 'replies' && !conversation.replyPending) return false;
      if (clientFilter === 'review' && conversation.status !== 'needs_review') return false;
      if (senderFilter !== 'all' && !(conversation.accounts || []).includes(senderFilter)) return false;
      return !query || [conversation.businessName, conversation.recipientName, ...(conversation.accounts || [])].join(' ').toLowerCase().includes(query);
    }).sort((left, right) => Number(Boolean(right.replyPending)) - Number(Boolean(left.replyPending)) || Number(right.status === 'needs_review') - Number(left.status === 'needs_review') || Date.parse(right.updatedAt || 0) - Date.parse(left.updatedAt || 0));
    document.getElementById('clientCount').textContent = `${number(rows.length)} recorded conversations · ${number(Math.min(rows.length, visibleCount))} shown`;
    document.getElementById('clientRows').innerHTML = rows.slice(0, visibleCount).map(conversation => {
      const privateUrl = `https://n8n.wildeautomations.com/reachr-command-center/#conversation=${encodeURIComponent(conversation.id)}`;
      const messengerUrl = safeMessenger(conversation.messengerUrl);
      const state = conversation.replyPending ? 'Verified reply waiting' : conversation.status === 'needs_review' ? 'Needs review' : conversation.status === 'interested' ? 'Interested' : conversation.status === 'waiting' ? 'Waiting' : conversation.status === 'closed' ? 'Closed' : 'Awaiting reply';
      return `<div class="operations-row"><strong>${escapeHtml(conversation.businessName)}</strong> · ${escapeHtml(state)}<small>${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · Last activity ${escapeHtml(date(conversation.updatedAt))}</small>${conversation.replyPending ? `<small>${escapeHtml(conversation.lastVerifiedInboundText || 'Verified inbound message')} · Detected ${escapeHtml(date(conversation.lastVerifiedInboundAt))}</small>` : ''}${conversation.candidateCount ? `<small>${number(conversation.candidateCount)} unverified preview(s) need checking in Messenger.</small>` : ''}<button type="button" data-client-id="${escapeHtml(conversation.id)}">Open here</button><a href="${escapeHtml(privateUrl)}" target="_blank" rel="noopener noreferrer">Private fallback ↗</a>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div>`;
    }).join('') || '<p class="caption">No conversations match this view.</p>';
    document.getElementById('showMoreClients').hidden = rows.length <= visibleCount;
  }

  function render(data) {
    document.getElementById('operationsStatus').textContent = `Checked ${date(data.checkedAt)} · Halifax schedule · Replies send only after your confirmation`;
    currentData = data;
    const conversations = new Map((data.conversations || []).map(item => [item.id, item]));
    const totals = `<div class="operations-totals"><div class="operations-total">Confirmed today<strong>${number(data.overview.confirmedToday)}</strong></div><div class="operations-total">Replies waiting<strong>${number(data.overview.repliesWaiting)}</strong></div><div class="operations-total">Needs action<strong>${number(data.overview.needsAction)}</strong></div></div>`;
    const senders = `<section class="operations-section"><h3>Messenger senders</h3><div class="operations-grid">${data.senders.map(sender => `<article class="operations-card"><h3>${escapeHtml(sender.name)}</h3><p>${number(sender.confirmedToday)} confirmed today · ${number(sender.totalConfirmed)} total · ${number(sender.eligible)} eligible</p><p>Window: ${escapeHtml(sender.campaignState)} · Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)}</p><p>Last confirmed: ${escapeHtml(date(sender.lastConfirmedAt))}</p>${sender.blockers.length ? `<p class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</p>` : ''}</article>`).join('')}</div></section>`;
    const replies = `<section class="operations-section"><h3>Verified replies waiting</h3>${data.replyInbox.length ? data.replyInbox.map(reply => { const conversation = conversations.get(reply.conversationId); const url = safeMessenger(conversation?.messengerUrl); return `<div class="operations-row"><strong>${escapeHtml(reply.businessName)}</strong> · ${escapeHtml(reply.sender)}<small>${escapeHtml(reply.preview)} · Detected ${escapeHtml(date(reply.detectedAt))}</small><button type="button" data-client-id="${escapeHtml(reply.conversationId)}">Open and reply here</button>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div>`; }).join('') : '<p class="caption">No verified replies waiting.</p>'}</section>`;
    const accountNames = [...new Set((data.conversations || []).flatMap(conversation => conversation.accounts || []))].sort();
    const senderOptions = accountNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    const clients = `<section class="operations-section"><h3>Recorded conversations</h3><p class="caption">This view includes conversations recorded by the outreach system. Personal Messenger inboxes may contain additional chats. Open Messenger for complete context.</p><div class="operations-tools"><input id="clientSearch" type="search" aria-label="Search Messenger conversations" placeholder="Search business, contact, or sender" value="${escapeHtml(clientQuery)}"><select id="senderFilter" aria-label="Filter by Facebook account"><option value="all">All sender accounts</option>${senderOptions}</select><select id="clientFilter" aria-label="Filter conversations"><option value="all">All recorded chats</option><option value="action">Needs attention</option><option value="replies">Verified replies</option><option value="review">Needs review</option></select></div><p id="clientCount" class="caption"></p><div id="clientRows"></div><button id="showMoreClients" type="button" class="reachr-tab" hidden>Show more conversations</button></section>`;
    const actions = `<section class="operations-section"><h3>Needs action</h3>${data.actions.length ? data.actions.map(action => `<div class="operations-row"><strong>${escapeHtml(action.title)}</strong>${action.detail ? `<small>${escapeHtml(action.detail)}</small>` : ''}</div>`).join('') : '<p class="caption">No active issues recorded.</p>'}</section>`;
    const pages = `<section class="operations-section"><h3>Page posting</h3><div class="operations-grid">${data.pages.map(page => `<article class="operations-card"><h3>${escapeHtml(page.name)}</h3><p>Connection: ${escapeHtml(page.connection)} · Posting: ${escapeHtml(page.postingStatus)}</p></article>`).join('')}</div></section>`;
    document.getElementById('operationsContent').innerHTML = totals + replies + clients + `<details class="operations-details"><summary>Sender and Page operations</summary>${actions}${senders}${pages}</details>`;
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
      .select('business_name,recipient_name,sender_actor_name,messenger_url,updated_at')
      .eq('marketplace_excluded', false).order('updated_at', { ascending: false }).limit(1000);
    if (archiveError) throw archiveError;
    const rows = data || [];
    document.getElementById('operationsStatus').textContent = 'Live sender connection unavailable · showing stored outreach archive';
    content.innerHTML = `<div class="operations-offline"><strong>Live sender accounts are offline.</strong><p>The archived list below may be incomplete. Reply sending and follow-up changes require the live connection. You can still open an exact Messenger thread or use the stored inbox.</p><button type="button" id="openStoredInbox">Open stored inbox</button></div><section class="operations-section"><h3>Stored conversations</h3><p class="caption">${number(rows.length)} archived records shown · sender names appear when recorded</p><input id="archiveSearch" type="search" aria-label="Search stored conversations" placeholder="Search business, contact, or sender"><div id="archiveRows"></div></section>`;
    const renderRows = () => {
      const query = document.getElementById('archiveSearch').value.trim().toLowerCase();
      const matching = rows.filter(row => !query || [row.business_name, row.recipient_name, row.sender_actor_name].join(' ').toLowerCase().includes(query));
      document.getElementById('archiveRows').innerHTML = matching.map(row => {
        const url = safeMessenger(row.messenger_url);
        return `<div class="operations-row"><strong>${escapeHtml(row.business_name)}</strong><small>${escapeHtml(row.recipient_name || 'Recipient unconfirmed')} · ${escapeHtml(row.sender_actor_name || 'Sender not recorded')} · Last stored activity ${escapeHtml(date(row.updated_at))}</small>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}</div>`;
      }).join('') || '<p class="caption">No stored conversations match this search.</p>';
    };
    document.getElementById('archiveSearch').addEventListener('input', renderRows);
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
      document.getElementById('operationsContent').textContent = '';
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
    const button = event.target.closest('[data-client-id]');
    if (button) openClient(button.dataset.clientId);
  });
  window.addEventListener('focus', () => load());
  window.addEventListener('reachr-auth-open', () => load());
  setInterval(load, 60000);
  if (!window.wildroseInitialSection || window.wildroseInitialSection === '#operations') tab.click();
})();
