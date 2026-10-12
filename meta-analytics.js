(() => {
  const origin = 'https://wildrose-widget.wildeautomations.com/api/command-center/insights';
  const nav = document.querySelector('.reachr-nav');
  const overview = document.getElementById('overviewPanel');
  const inbox = document.getElementById('inboxPanel');
  const tab = document.createElement('button');
  tab.className = 'reachr-tab';
  tab.id = 'metaTab';
  tab.type = 'button';
  tab.textContent = 'Organic content';
  tab.setAttribute('aria-selected', 'false');
  nav.append(tab);

  const panel = document.createElement('section');
  panel.id = 'metaPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Meta Graph API</div><h2>Organic content</h2></div></div><p id="metaStatus" class="caption">Open this tab to load the latest report.</p><div id="metaContent"></div></div>';
  inbox.after(panel);

  const style = document.createElement('style');
  style.textContent = '.meta-card{border:1px solid var(--line);border-radius:12px;padding:18px;background:var(--panel);min-width:0;margin-top:18px}.meta-card h3{margin:0 0 10px;font-size:17px}.meta-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.meta-stat{padding:10px;border:1px solid var(--line);border-radius:9px;color:var(--muted);font-size:11px}.meta-stat strong{display:block;color:var(--text);font-size:18px}.meta-row{padding:12px 0;border-top:1px solid var(--line);font-size:13px;line-height:1.5}.meta-row small{display:block;color:var(--muted);margin-top:4px}.meta-row a{display:inline-block;margin-top:6px;color:var(--send)}.meta-warning{color:var(--positive);font-size:12px}.meta-ads{margin-top:18px}.meta-ads summary{cursor:pointer;color:var(--muted);font-weight:700}.meta-ads .meta-card{margin-top:12px}@media(max-width:650px){.meta-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  style.textContent += '.meta-post-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.meta-post-top strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;font-size:13px;font-weight:650;white-space:pre-wrap}.meta-post-top span{white-space:nowrap;color:var(--muted);font-size:11px}.meta-post-performance{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.meta-post-performance span{display:inline-flex;gap:6px;align-items:center;padding:6px 9px;border:1px solid var(--line);border-radius:7px;color:var(--muted);font-size:11px}.meta-post-performance strong{color:var(--text);font-size:12px}';
  document.head.append(style);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const count = value => value == null ? '—' : Number(value).toLocaleString('en-CA');
  const money = (value, currency) => `${escapeHtml(currency)} ${Number(value || 0).toFixed(2)}`;
  const postUrl = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com')) ? url.href : null;
    } catch {
      return null;
    }
  };
  let lastLoaded = 0;

  function render(data) {
    document.getElementById('metaStatus').textContent = `Updated from Meta ${new Date(data.checkedAt).toLocaleString()}`;
    const page = data.page;
    const posts = page.posts.status === 'ready' ? page.posts.items : null;
    const stats = `<div class="meta-stats"><div class="meta-stat">Followers<strong>${count(page.followers)}</strong></div><div class="meta-stat">Page likes<strong>${count(page.likes)}</strong></div><div class="meta-stat">Recent posts<strong>${posts ? count(posts.length) : '—'}</strong></div><div class="meta-stat">Shares on recent posts<strong>${posts ? count(posts.reduce((sum, post) => sum + Number(post.shares || 0), 0)) : '—'}</strong></div></div>`;
    const rows = posts ? posts.map(post => {
      const url = postUrl(post.url);
      const interactions = post.reactions == null || post.comments == null ? null : Number(post.reactions) + Number(post.comments) + Number(post.shares || 0);
      return `<div class="meta-row"><div class="meta-post-top"><strong>${escapeHtml(post.text || 'Page post')}</strong><span>${escapeHtml(post.createdAt?.slice(0, 10) || '')}</span></div><div class="meta-post-performance"><span>Reactions <strong>${count(post.reactions)}</strong></span><span>Comments <strong>${count(post.comments)}</strong></span><span>Shares <strong>${count(post.shares)}</strong></span><span>Interactions <strong>${count(interactions)}</strong></span></div>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View on Facebook ↗</a>` : ''}</div>`;
    }).join('') || '<p class="caption">No recent posts returned by Meta.</p>' : `<p class="meta-warning">${escapeHtml(page.posts.reason)}</p>`;
    document.getElementById('metaContent').innerHTML = `<article class="meta-card"><h3>${escapeHtml(page.name)} · Facebook Page</h3>${stats}<h3>Post performance</h3>${rows}<p class="caption">Counts come from Meta when this tab loads. Interactions add reactions, comments, and shares; they are not unique people. A dash means Meta did not return that metric.</p></article>`;
  }

  async function load() {
    if (panel.hidden || document.querySelector('main').hidden || Date.now() - lastLoaded < 300000) return;
    const status = document.getElementById('metaStatus');
    status.textContent = 'Loading Meta report…';
    try {
      const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
      if (error || !session?.access_token) throw Error('Sign in again to load Meta analytics.');
      const response = await fetch(origin, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw Error(response.status === 401 ? 'Sign in again to load Page insights.' : 'Connect or refresh your Facebook Page token in Publish to Page to see current numbers.');
      render(await response.json());
      lastLoaded = Date.now();
    } catch (error) {
      status.textContent = error.message;
      document.getElementById('metaContent').textContent = '';
    }
  }

  tab.addEventListener('click', () => {
    overview.hidden = true;
    inbox.hidden = true;
    const operationsPanel = document.getElementById('operationsPanel');
    if (operationsPanel) operationsPanel.hidden = true;
    const operationsTab = document.getElementById('operationsTab');
    if (operationsTab) { operationsTab.classList.remove('active'); operationsTab.setAttribute('aria-selected', 'false'); }
    panel.hidden = false;
    document.getElementById('overviewTab').classList.remove('active');
    document.getElementById('inboxTab').classList.remove('active');
    tab.classList.add('active');
    document.getElementById('overviewTab').setAttribute('aria-selected', 'false');
    document.getElementById('inboxTab').setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-selected', 'true');
    history.replaceState(null, '', '#analytics');
    load();
  });
  for (const id of ['overviewTab', 'inboxTab']) document.getElementById(id).addEventListener('click', () => {
    panel.hidden = true;
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  window.addEventListener('focus', load);
  window.addEventListener('reachr-auth-open', load);
  setInterval(load, 300000);
  if (window.wildroseInitialSection === '#analytics') tab.click();
})();
