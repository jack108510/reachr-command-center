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
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Messenger communication</div><h2>Client conversations</h2><p class="caption">One row per client thread. Review the latest recorded context, track its status, and open Messenger for the full live conversation.</p></div><button class="reachr-tab" id="refreshOperations" type="button">Refresh</button></div><p class="caption" id="operationsStatus">Checking connected sender accounts…</p><section id="clientDetail" class="operations-client-detail" hidden></section><div id="operationsContent"></div></div>';
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
  const conversationReplyCategory = conversation => conversation.latestDirection === 'inbound' && conversation.latestPreviewVerified !== false
    ? replyCategory(conversation.latestPreview) : 'review';
  const isPriorityLead = conversation => conversation.leadQuality === 'high' || conversation.opportunityType === 'partnership';
  const leadLabels = conversation => [conversation.leadQuality === 'high' ? 'High quality' : conversation.leadQuality === 'promising' ? 'Promising' : '', conversation.opportunityType === 'partnership' ? 'Partnership' : conversation.opportunityType === 'client' ? 'Client opportunity' : ''].filter(Boolean);
  const today = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
  const dueNow = conversation => conversation.status !== 'closed' && Boolean(conversation.dueDate && conversation.dueDate <= today());
  function freshness(conversation) {
    const checkedAt = timestamp(conversation.threadCheckedAt);
    if (conversation.candidateCount || conversation.threadCheckStatus === 'unanchored') return { label: 'Check live thread · history unverified', state: 'uncertain' };
    if (conversation.threadCheckStatus === 'error') return { label: 'Check live thread · sync error', state: 'uncertain' };
    if (conversation.threadCheckStatus !== 'verified' || !checkedAt) return { label: 'No verified thread check yet', state: 'uncertain' };
    if (Date.now() - checkedAt > 30 * 60 * 1000) return { label: `Delayed · checked ${date(conversation.threadCheckedAt)}`, state: 'delayed' };
    return { label: `Checked ${date(conversation.threadCheckedAt)} · verify live before replying`, state: 'recent' };
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
  let clientFilter = 'recent';
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
    const messages = (conversation.messages || []).map(message => `<div class="operations-message ${message.direction === 'outbound' ? 'outbound' : ''}"><small>${message.direction === 'outbound' ? 'Recorded outbound' : 'Verified inbound'} · Captured ${escapeHtml(date(message.observedAt))}</small>${escapeHtml(message.body)}</div>`).join('') || '<p class="caption">No recorded messages. Check Messenger for the full thread.</p>';
    const pendingEntry = currentTriage?.entries.find(reply => reply.conversationId === conversation.id);
    const replyNeedsReview = Boolean(conversation.replyPending && pendingEntry?.recent && pendingEntry.category === 'review');
    const senders = replyNeedsReview ? conversation.replySenders || [] : [];
    const statuses = { needs_review: 'Needs review', awaiting_reply: 'Awaiting reply', interested: 'Interested', waiting: 'Waiting', closed: 'Closed' };
    const directSendNote = senders.length ? 'Open the live Messenger thread and check its latest message before sending.' : pendingEntry && !pendingEntry.recent ? 'This stored reply is over 72 hours old. Check the live Messenger thread; direct sending is paused here.' : pendingEntry?.category === 'decline' ? 'This looks like a decline. No reply is suggested; check the live thread if context differs.' : pendingEntry?.category === 'automatic' ? 'This looks like an automatic response. No reply is suggested; check the live thread if context differs.' : conversation.replyPending ? 'Direct sending is unavailable until the owning Facebook account passes its identity and inbox checks. Check the live thread first.' : 'No verified inbound reply is waiting. Use Messenger for any new message.';
    const composer = `<div class="operations-section operations-composer"><h3>Reply workspace</h3><p class="caption">${escapeHtml(directSendNote)}</p>${senders.length ? `<label for="clientReplySender">Facebook account</label><select id="clientReplySender">${senders.map(sender => `<option value="${escapeHtml(sender.key)}">${escapeHtml(sender.name)}</option>`).join('')}</select>` : ''}<label for="clientReplyText">Your message</label><textarea id="clientReplyText" maxlength="2000" placeholder="Write a specific reply for this conversation"></textarea>${senders.length ? '<label class="operations-live-check"><input id="clientLiveChecked" type="checkbox"> I checked the latest message in the live Messenger thread</label>' : ''}<div class="operations-composer-actions">${conversation.replyDraft ? '<button id="clientUseDraft" type="button">Use suggested starter</button>' : ''}<button id="clientCopy" type="button">Copy for Messenger</button>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open Messenger ↗</a>` : ''}${senders.length ? '<button id="clientSend" type="button">Review and send</button>' : ''}</div><p id="clientSendState" class="caption" role="status">A copied message is not sent. Confirm delivery in Messenger.</p></div>`;
    detail.innerHTML = `<div class="chart-header"><div><div class="label">Client conversation</div><h3>${escapeHtml(conversation.businessName)}</h3><p class="caption">${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · ${number(conversation.verifiedReplyCount)} verified inbound</p></div><div><button id="reloadClient" type="button">Reload record</button><button id="closeClient" type="button">Back to conversations</button></div></div>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open full Messenger conversation ↗</a>` : ''}<p class="operations-freshness operations-freshness-${freshness(conversation).state}">${escapeHtml(freshness(conversation).label)}</p><p class="warning">This is a partial record. The live Messenger conversation is the source of truth.</p><div class="operations-preview"><strong>Latest recorded context</strong><br>${escapeHtml(conversation.latestPreview || 'No message captured')} · Captured ${escapeHtml(date(conversation.updatedAt))}</div><div class="operations-section operations-lead-section"><h3>Lead intelligence</h3><p class="caption">Tag promising clients and partnership opportunities after checking the live thread. The brief is your own summary, not an automatic reading of the full Messenger chat.</p><div class="operations-lead-fields"><div><label for="clientLeadQuality">Lead quality</label><select id="clientLeadQuality"><option value="unreviewed" ${!conversation.leadQuality || conversation.leadQuality === 'unreviewed' ? 'selected' : ''}>Not reviewed</option><option value="promising" ${conversation.leadQuality === 'promising' ? 'selected' : ''}>Promising</option><option value="high" ${conversation.leadQuality === 'high' ? 'selected' : ''}>High quality</option></select></div><div><label for="clientOpportunityType">Opportunity type</label><select id="clientOpportunityType"><option value="unknown" ${!conversation.opportunityType || conversation.opportunityType === 'unknown' ? 'selected' : ''}>Unclassified</option><option value="client" ${conversation.opportunityType === 'client' ? 'selected' : ''}>Potential client</option><option value="partnership" ${conversation.opportunityType === 'partnership' ? 'selected' : ''}>Partnership</option></select></div></div><label for="clientConversationBrief">Conversation brief</label><textarea id="clientConversationBrief" maxlength="1200" placeholder="What has this person asked for? What was agreed? What should happen next?">${escapeHtml(conversation.conversationBrief || '')}</textarea><div class="operations-captured-context"><strong>Captured context</strong><span>Last verified inbound: ${escapeHtml(conversation.lastVerifiedInboundText || 'None recorded')}</span><span>Last recorded outbound: ${escapeHtml((conversation.messages || []).filter(message => message.direction === 'outbound').at(-1)?.body || 'None recorded')}</span></div></div>${composer}<div class="operations-section"><h3>Follow-up plan</h3><div class="operations-lead-fields"><div><label for="clientNextAction">Next action</label><input id="clientNextAction" maxlength="240" value="${escapeHtml(conversation.nextAction || '')}" placeholder="Send demo, ask for website, or follow up"></div><div><label for="clientDueDate">Due date</label><input id="clientDueDate" type="date" value="${escapeHtml(conversation.dueDate || '')}"></div></div><label for="clientStatus">Status</label><select id="clientStatus">${Object.entries(statuses).map(([value, label]) => `<option value="${value}" ${conversation.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select><label for="clientNote">Private note</label><textarea id="clientNote" maxlength="2000" placeholder="Next action and context">${escapeHtml(conversation.note || '')}</textarea><button id="saveClient" type="button">Save conversation details</button><p id="clientSaveState" class="caption" role="status">Changes stay private until saved.</p></div><details class="operations-details"><summary>Stored message history · may be incomplete</summary>${previews}${messages}</details>`;
    for (const id of ['clientStatus', 'clientNote', 'clientReplyText', 'clientLeadQuality', 'clientOpportunityType', 'clientConversationBrief', 'clientNextAction', 'clientDueDate']) for (const eventName of ['input', 'change']) document.getElementById(id)?.addEventListener(eventName, () => { detail.dataset.dirty = 'true'; });
    document.getElementById('reloadClient').addEventListener('click', () => openClient(conversation.id));
    document.getElementById('closeClient').addEventListener('click', () => {
      if (detailBusy) return;
      if (detail.dataset.dirty === 'true' && !window.confirm('Discard unsaved status, note, or reply text?')) return;
      selectedClientId = null;
      detail.hidden = true;
      document.getElementById('conversationPlaceholder')?.removeAttribute('hidden');
    });
    document.getElementById('saveClient').addEventListener('click', async () => {
      if (detailBusy) return;
      detailBusy = true;
      const button = document.getElementById('saveClient');
      const status = document.getElementById('clientStatus').value;
      const note = document.getElementById('clientNote').value;
      const leadQuality = document.getElementById('clientLeadQuality').value;
      const opportunityType = document.getElementById('clientOpportunityType').value;
      const conversationBrief = document.getElementById('clientConversationBrief').value;
      const nextAction = document.getElementById('clientNextAction').value.trim();
      const dueDate = document.getElementById('clientDueDate').value;
      if (dueDate && !nextAction) { document.getElementById('clientSaveState').textContent = 'Add a next action for the due date.'; detailBusy = false; return; }
      button.disabled = true;
      document.getElementById('clientSaveState').textContent = 'Saving…';
      try {
        await apiRequest(`/github-conversations/${conversation.id}`, { method: 'PATCH', body: JSON.stringify({ status, note, leadQuality, opportunityType, conversationBrief, nextAction, dueDate }) });
        conversation.status = status;
        conversation.note = note;
        conversation.leadQuality = leadQuality;
        conversation.opportunityType = opportunityType;
        conversation.conversationBrief = conversationBrief;
        conversation.nextAction = nextAction;
        conversation.dueDate = dueDate;
        const summary = currentData?.conversations?.find(item => item.id === conversation.id);
        if (summary) { Object.assign(summary, { status, note, leadQuality, opportunityType, conversationBrief, nextAction, dueDate }); }
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
    document.getElementById('conversationPlaceholder')?.setAttribute('hidden', '');
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
    const now = timestamp(currentData?.checkedAt) || Date.now();
    const rows = all.filter(conversation => {
      if (clientFilter === 'recent' && timestamp(conversation.updatedAt) < now - recentWindowMs) return false;
      if (clientFilter === 'action' && (conversation.status !== 'needs_review' || conversationReplyCategory(conversation) !== 'review' || timestamp(conversation.updatedAt) < now - recentWindowMs)) return false;
      if (clientFilter === 'replies' && !conversation.replyPending) return false;
      if (clientFilter === 'review' && conversation.status !== 'needs_review') return false;
      if (clientFilter === 'priority' && !isPriorityLead(conversation)) return false;
      if (clientFilter === 'partnership' && conversation.opportunityType !== 'partnership') return false;
      if (clientFilter === 'due' && !dueNow(conversation)) return false;
      if (['interested', 'waiting', 'closed'].includes(clientFilter) && conversation.status !== clientFilter) return false;
      if (senderFilter !== 'all' && !(conversation.accounts || []).includes(senderFilter)) return false;
      return !query || [conversation.businessName, conversation.recipientName, conversation.latestPreview, conversation.note, conversation.conversationBrief, conversation.nextAction, ...leadLabels(conversation), ...(conversation.accounts || [])].join(' ').toLowerCase().includes(query);
    }).sort((left, right) => clientFilter === 'due' ? (left.dueDate || '').localeCompare(right.dueDate || '') || timestamp(right.updatedAt) - timestamp(left.updatedAt) : timestamp(right.updatedAt) - timestamp(left.updatedAt));
    document.getElementById('clientCount').textContent = `${number(rows.length)} conversations in this view · ${number(Math.min(rows.length, visibleCount))} shown`;
    for (const button of document.getElementById('operationsContent').querySelectorAll('[data-inbox-filter]')) {
      const active = button.dataset.inboxFilter === clientFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    document.getElementById('clientRows').innerHTML = rows.slice(0, visibleCount).map(conversation => {
      const privateUrl = `https://n8n.wildeautomations.com/reachr-command-center/#conversation=${encodeURIComponent(conversation.id)}`;
      const messengerUrl = safeMessenger(conversation.messengerUrl);
      const category = conversationReplyCategory(conversation);
      const urgent = conversation.status === 'needs_review' && category === 'review';
      const state = conversation.status === 'needs_review' && category === 'decline' ? 'Declined · close' : conversation.status === 'needs_review' && category === 'automatic' ? 'Automatic reply' : { needs_review: 'Needs review', interested: 'Interested', waiting: 'Waiting', closed: 'Closed', awaiting_reply: 'Awaiting reply' }[conversation.status] || 'Review status';
      const direction = conversation.latestDirection === 'outbound' ? 'Last recorded outbound' : conversation.latestDirection === 'inbound' ? 'Last recorded inbound' : conversation.latestPreviewVerified === false ? 'Unverified preview' : 'Latest recorded message';
      const snippet = String(conversation.latestPreview || 'No message captured').replace(/\s+/g, ' ').trim().slice(0, 180);
      return `<article class="operations-row ${urgent ? 'operations-row-urgent' : ''}"><div class="operations-row-head"><strong>${escapeHtml(conversation.businessName)}</strong><span class="operations-state ${urgent ? 'operations-state-urgent' : ''}">${escapeHtml(state)}</span></div><small class="operations-freshness operations-freshness-${freshness(conversation).state}">${escapeHtml(freshness(conversation).label)}</small>${conversation.dueDate ? `<small class="operations-next-action ${dueNow(conversation) ? 'operations-due-now' : ''}">${dueNow(conversation) ? 'Due now' : `Due ${escapeHtml(conversation.dueDate)}`} · ${escapeHtml(conversation.nextAction || 'Next action missing')}</small>` : ''}${leadLabels(conversation).length ? `<div class="operations-lead-tags">${leadLabels(conversation).map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>` : ''}${conversation.conversationBrief ? `<small class="operations-brief">Brief: ${escapeHtml(conversation.conversationBrief.slice(0, 190))}${conversation.conversationBrief.length > 190 ? '…' : ''}</small>` : ''}<small>${escapeHtml(conversation.recipientName || 'Recipient unconfirmed')} · ${escapeHtml((conversation.accounts || []).join(', ') || 'Sender unknown')} · Last recorded ${escapeHtml(date(conversation.updatedAt))}</small><small class="operations-reply-preview">${escapeHtml(direction)}: ${escapeHtml(snippet)}${conversation.latestPreview?.length > 180 ? '…' : ''}</small>${conversation.candidateCount ? `<small>${number(conversation.candidateCount)} unverified preview(s) need checking in Messenger.</small>` : ''}<div class="operations-row-actions"><button type="button" data-client-id="${escapeHtml(conversation.id)}">Manage conversation</button><a href="${escapeHtml(privateUrl)}" target="_blank" rel="noopener noreferrer">Private fallback ↗</a>${messengerUrl ? `<a href="${escapeHtml(messengerUrl)}" target="_blank" rel="noopener noreferrer">Open full thread ↗</a>` : ''}</div></article>`;
    }).join('') || '<p class="caption">No conversations match this view.</p>';
    document.getElementById('showMoreClients').hidden = rows.length <= visibleCount;
  }

  function render(data) {
    tab.textContent = 'Messenger';
    document.getElementById('operationsStatus').textContent = `Records checked ${date(data.checkedAt)} · captured time may differ from when a message was sent`;
    currentData = data;
    currentTriage = triageReplies(data);
    const allConversations = data.conversations || [];
    const recentConversations = allConversations.filter(conversation => timestamp(conversation.updatedAt) >= (timestamp(data.checkedAt) || Date.now()) - recentWindowMs);
    const totals = `<div class="operations-totals"><div class="operations-total">Recent client threads<strong>${number(recentConversations.length)}</strong></div><div class="operations-total">Recent to review<strong>${number(recentConversations.filter(conversation => conversation.status === 'needs_review' && conversationReplyCategory(conversation) === 'review').length)}</strong></div><div class="operations-total">Priority leads<strong>${number(allConversations.filter(isPriorityLead).length)}</strong></div><div class="operations-total">Due today or overdue<strong>${number(allConversations.filter(dueNow).length)}</strong></div></div>`;
    const jackReplyStatus = data.senders.find(sender => sender.name === 'Jack Sereda')?.replyStatus;
    const jackSyncNotice = jackReplyStatus && jackReplyStatus !== 'current'
      ? `<div class="operations-offline" role="status"><strong>Jack Messenger sync: ${escapeHtml(jackReplyStatus.replaceAll('_', ' '))}</strong><p>Some Jack conversations could not be fully verified and may have newer messages. Open the live Messenger thread before replying.</p></div>`
      : '';
    const senderHealth = `<section class="operations-section" aria-label="Messenger connection health"><h3>Messenger connection health</h3><p class="caption">These checks cover recorded sender accounts. Personal Messenger inboxes may contain additional conversations.</p>${data.senders.map(sender => `<div class="operations-row"><strong>${escapeHtml(sender.name)}</strong><small>Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)} · Window: ${escapeHtml(sender.campaignState)}</small>${sender.blockers.length ? `<small class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</small>` : ''}</div>`).join('') || '<p class="warning">No sender accounts were reported by the live service.</p>'}</section>`;
    const senders = `<section class="operations-section"><h3>Messenger senders</h3><div class="operations-grid">${data.senders.map(sender => `<article class="operations-card"><h3>${escapeHtml(sender.name)}</h3><p>${number(sender.confirmedToday)} confirmed today · ${number(sender.totalConfirmed)} total · ${number(sender.eligible)} eligible</p><p>Window: ${escapeHtml(sender.campaignState)} · Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)}</p><p>Last confirmed: ${escapeHtml(date(sender.lastConfirmedAt))}</p>${sender.blockers.length ? `<p class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</p>` : ''}</article>`).join('')}</div></section>`;
    const accountNames = [...new Set((data.conversations || []).flatMap(conversation => conversation.accounts || []))].sort();
    const senderOptions = accountNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    const clients = `<section class="operations-section"><h3>Conversations</h3><p class="caption">One row per client thread. Recent shows activity captured in the past 72 hours; All history includes older records. Open Messenger to see the complete current conversation.</p><div class="operations-quick-filters" aria-label="Conversation views"><button type="button" data-inbox-filter="recent">Recent</button><button type="button" data-inbox-filter="action">Recent to review</button><button type="button" data-inbox-filter="due">Due today</button><button type="button" data-inbox-filter="priority">Priority leads</button><button type="button" data-inbox-filter="partnership">Partnerships</button><button type="button" data-inbox-filter="interested">Interested</button><button type="button" data-inbox-filter="waiting">Waiting</button><button type="button" data-inbox-filter="all">All history</button></div><div class="operations-tools"><input id="clientSearch" type="search" aria-label="Search Messenger conversations" placeholder="Search business, person, message, brief, or note" value="${escapeHtml(clientQuery)}"><select id="senderFilter" aria-label="Filter by Facebook account"><option value="all">All sender accounts</option>${senderOptions}</select><select id="clientFilter" aria-label="Filter conversations"><option value="recent">Recent</option><option value="action">Recent to review</option><option value="due">Due today</option><option value="priority">Priority leads</option><option value="partnership">Partnerships</option><option value="interested">Interested</option><option value="waiting">Waiting</option><option value="closed">Closed</option><option value="all">All history</option></select></div><p id="clientCount" class="caption"></p><div id="clientRows"></div><button id="showMoreClients" type="button" class="reachr-tab" hidden>Show more conversations</button></section>`;
    const actions = `<section class="operations-section"><h3>Needs action</h3>${data.actions.length ? data.actions.map(action => `<div class="operations-row"><strong>${escapeHtml(action.title)}</strong>${action.detail ? `<small>${escapeHtml(action.detail)}</small>` : ''}</div>`).join('') : '<p class="caption">No active issues recorded.</p>'}</section>`;
    const pages = `<section class="operations-section"><h3>Page posting</h3><div class="operations-grid">${data.pages.map(page => `<article class="operations-card"><h3>${escapeHtml(page.name)}</h3><p>Connection: ${escapeHtml(page.connection)} · Posting: ${escapeHtml(page.postingStatus)}</p></article>`).join('')}</div></section>`;
    document.getElementById('operationsContent').innerHTML = jackSyncNotice + totals + `<div class="operations-workspace"><div class="operations-list-pane">${clients}</div><div class="operations-detail-pane"><div id="conversationPlaceholder" class="operations-conversation-placeholder" ${selectedClientId ? 'hidden' : ''}><strong>Choose a conversation</strong><p>Review the recorded context, tag valuable leads, and write a brief after checking the live Messenger thread.</p></div></div></div>` + `<details class="operations-details"><summary>Sender and Page operations</summary>${senderHealth}${actions}${senders}${pages}</details>`;
    document.querySelector('.operations-detail-pane').prepend(document.getElementById('clientDetail'));
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
    if (panel.hidden || document.querySelector('main').hidden || !force && (Date.now() - lastLoaded < 60000 || document.activeElement?.matches('#clientSearch,#clientFilter,#senderFilter,#archiveSearch,#clientStatus,#clientNote,#clientReplyText,#clientLeadQuality,#clientOpportunityType,#clientConversationBrief,#clientNextAction,#clientDueDate'))) return;
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
