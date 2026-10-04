(() => {
  const origin = 'https://n8n.wildeautomations.com/reachr-command-center/api/meta-analytics';
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
  document.head.append(style);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const count = value => Number(value || 0).toLocaleString('en-CA');
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
    document.getElementById('metaStatus').textContent = `Checked ${new Date(data.checkedAt).toLocaleString()} · Read only · Page ${data.page.id || 'unavailable'}`;
    const ads = data.ads.status === 'ready' ? `<article class="meta-card"><h3>Ads · ${escapeHtml(data.ads.accountName)}</h3><div class="caption">${escapeHtml(data.ads.period.start || '')} to ${escapeHtml(data.ads.period.end || '')} · ${escapeHtml(data.ads.currency)}</div><div class="meta-stats"><div class="meta-stat">Spend<strong>${money(data.ads.totals.spend, data.ads.currency)}</strong></div><div class="meta-stat">Impressions<strong>${count(data.ads.totals.impressions)}</strong></div><div class="meta-stat">Reach<strong>${count(data.ads.totals.reach)}</strong></div><div class="meta-stat">Clicks<strong>${count(data.ads.totals.clicks)}</strong></div><div class="meta-stat">Link clicks<strong>${count(data.ads.totals.linkClicks)}</strong></div></div><div class="label">Campaigns with delivery</div>${data.ads.campaigns.map(campaign => `<div class="meta-row">${escapeHtml(campaign.name)}<small>${money(campaign.spend, data.ads.currency)} · ${count(campaign.impressions)} impressions · ${count(campaign.linkClicks)} link clicks</small></div>`).join('') || '<p class="caption">No ad delivery in this period.</p>'}</article>` : `<article class="meta-card"><h3>Ads</h3><p class="meta-warning">${escapeHtml(data.ads.reason)}</p></article>`;
    const page = data.page.status === 'ready' ? (() => {
      const posts = data.page.posts.status === 'ready' ? data.page.posts.items : null;
      const recentShares = posts?.reduce((total, post) => total + Number(post.shares || 0), 0);
      const stats = `<div class="meta-stats"><div class="meta-stat">Followers<strong>${count(data.page.followers)}</strong></div><div class="meta-stat">Page likes<strong>${count(data.page.likes)}</strong></div><div class="meta-stat">Recent posts<strong>${posts ? count(posts.length) : '—'}</strong></div><div class="meta-stat">Shares on recent posts<strong>${posts ? count(recentShares) : '—'}</strong></div></div>`;
      const recentPosts = posts ? posts.map(post => {
        const url = postUrl(post.url);
        return `<div class="meta-row">${escapeHtml(post.text || 'Page post')}<small>${escapeHtml(post.createdAt?.slice(0, 10) || '')} · ${count(post.shares)} shares</small>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">View post ↗</a>` : ''}</div>`;
      }).join('') || '<p class="caption">No recent posts returned.</p>' : `<p class="meta-warning">${escapeHtml(data.page.posts.reason)}</p>`;
      return `<article class="meta-card"><h3>${escapeHtml(data.page.name)} · Organic Page</h3>${stats}<h3>Recent posts</h3>${recentPosts}<p class="caption">Recent-post counts cover only the posts returned by Meta. Reaction, comment, and post-view metrics are unavailable to this token.</p></article>`;
    })() : `<article class="meta-card"><h3>Organic Page</h3><p class="meta-warning">${escapeHtml(data.page.reason)}</p></article>`;
    document.getElementById('metaContent').innerHTML = `${page}<details class="meta-ads"><summary>Paid ads · secondary report</summary>${ads}</details>`;
  }

  async function load() {
    if (panel.hidden || document.querySelector('main').hidden || Date.now() - lastLoaded < 300000) return;
    const status = document.getElementById('metaStatus');
    status.textContent = 'Loading Meta report…';
    try {
      const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
      if (error || !session?.access_token) throw Error('Sign in again to load Meta analytics.');
      const response = await fetch(origin, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) throw Error(response.status === 401 ? 'Sign in again to load Meta analytics.' : 'Meta report unavailable.');
      render(await response.json());
      lastLoaded = Date.now();
    } catch (error) {
      status.textContent = error.message;
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
