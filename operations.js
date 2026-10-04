(() => {
  const endpoint = 'https://n8n.wildeautomations.com/reachr-command-center/api/github-operations';
  const nav = document.querySelector('.reachr-nav');
  const tab = document.createElement('button');
  tab.id = 'operationsTab';
  tab.className = 'reachr-tab';
  tab.type = 'button';
  tab.textContent = 'Outreach operations';
  tab.setAttribute('aria-selected', 'false');
  nav.insertBefore(tab, document.getElementById('metaTab'));

  const panel = document.createElement('section');
  panel.id = 'operationsPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Live local records</div><h2>Outreach operations</h2></div><button class="reachr-tab" id="refreshOperations" type="button">Refresh</button></div><p class="caption" id="operationsStatus">Open this tab to check senders and replies.</p><div id="operationsContent"></div></div>';
  document.getElementById('metaPanel').after(panel);

  const style = document.createElement('style');
  style.textContent = '.operations-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.operations-card{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:16px;min-width:0}.operations-card h3{margin:0 0 8px;font-size:15px}.operations-card p{margin:5px 0;color:var(--muted);font-size:12px;line-height:1.5}.operations-card .warning{color:var(--positive)}.operations-section{margin-top:22px}.operations-section h3{font-size:17px}.operations-row{border-top:1px solid var(--line);padding:11px 0;font-size:12px;line-height:1.5}.operations-row small{display:block;color:var(--muted);margin-top:4px}.operations-row a{color:var(--reply)}.operations-totals{display:flex;gap:9px;flex-wrap:wrap;margin:16px 0}.operations-total{border:1px solid var(--line);border-radius:10px;padding:12px;min-width:140px;font-size:11px;color:var(--muted)}.operations-total strong{display:block;font-size:24px;color:var(--text)}@media(max-width:720px){.operations-grid{grid-template-columns:1fr}.operations-total{flex:1}}';
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

  function render(data) {
    document.getElementById('operationsStatus').textContent = `Checked ${date(data.checkedAt)} · Halifax schedule · Read only`;
    const conversations = new Map(data.conversations.map(item => [item.id, item]));
    const totals = `<div class="operations-totals"><div class="operations-total">Confirmed today<strong>${number(data.overview.confirmedToday)}</strong></div><div class="operations-total">Replies waiting<strong>${number(data.overview.repliesWaiting)}</strong></div><div class="operations-total">Needs action<strong>${number(data.overview.needsAction)}</strong></div></div>`;
    const senders = `<section class="operations-section"><h3>Messenger senders</h3><div class="operations-grid">${data.senders.map(sender => `<article class="operations-card"><h3>${escapeHtml(sender.name)}</h3><p>${number(sender.confirmedToday)} confirmed today · ${number(sender.totalConfirmed)} total · ${number(sender.eligible)} eligible</p><p>Window: ${escapeHtml(sender.campaignState)} · Connection: ${escapeHtml(sender.connection)} · Reply checks: ${escapeHtml(sender.replyStatus)}</p><p>Last confirmed: ${escapeHtml(date(sender.lastConfirmedAt))}</p>${sender.blockers.length ? `<p class="warning">${sender.blockers.map(escapeHtml).join(' · ')}</p>` : ''}</article>`).join('')}</div></section>`;
    const replies = `<section class="operations-section"><h3>Verified replies waiting</h3>${data.replyInbox.length ? data.replyInbox.map(reply => { const conversation = conversations.get(reply.conversationId); const url = safeMessenger(conversation?.messengerUrl); return `<div class="operations-row"><strong>${escapeHtml(reply.businessName)}</strong> · ${escapeHtml(reply.sender)}<small>${escapeHtml(reply.preview)} · Detected ${escapeHtml(date(reply.detectedAt))}</small>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Open Messenger thread ↗</a>` : ''}</div>`; }).join('') : '<p class="caption">No verified replies waiting.</p>'}</section>`;
    const actions = `<section class="operations-section"><h3>Needs action</h3>${data.actions.length ? data.actions.map(action => `<div class="operations-row"><strong>${escapeHtml(action.title)}</strong>${action.detail ? `<small>${escapeHtml(action.detail)}</small>` : ''}</div>`).join('') : '<p class="caption">No active issues recorded.</p>'}</section>`;
    const pages = `<section class="operations-section"><h3>Page posting</h3><div class="operations-grid">${data.pages.map(page => `<article class="operations-card"><h3>${escapeHtml(page.name)}</h3><p>Connection: ${escapeHtml(page.connection)} · Posting: ${escapeHtml(page.postingStatus)}</p></article>`).join('')}</div></section>`;
    document.getElementById('operationsContent').innerHTML = totals + replies + senders + actions + pages;
  }

  async function load(force = false) {
    if (panel.hidden || document.querySelector('main').hidden || !force && Date.now() - lastLoaded < 60000) return;
    document.getElementById('operationsStatus').textContent = 'Checking live outreach records…';
    try {
      const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
      if (error || !session?.access_token) throw Error('Sign in again to load outreach operations.');
      const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw Error(response.status === 401 ? 'Sign in again to load outreach operations.' : 'Outreach operations unavailable.');
      render(await response.json());
      lastLoaded = Date.now();
    } catch (error) {
      document.getElementById('operationsStatus').textContent = error.message;
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
  window.addEventListener('focus', () => load());
  window.addEventListener('reachr-auth-open', () => load());
  setInterval(load, 60000);
  if (window.wildroseInitialSection === '#operations') tab.click();
})();
