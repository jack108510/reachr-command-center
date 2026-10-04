(() => {
  const origin = 'https://n8n.wildeautomations.com/reachr-command-center/api/meta-analytics';
  const nav = document.querySelector('.reachr-nav');
  const overview = document.getElementById('overviewPanel');
  const inbox = document.getElementById('inboxPanel');
  const tab = document.createElement('button');
  tab.className = 'reachr-tab';
  tab.id = 'metaTab';
  tab.type = 'button';
  tab.textContent = 'Meta analytics';
  tab.setAttribute('aria-selected', 'false');
  nav.append(tab);

  const panel = document.createElement('section');
  panel.id = 'metaPanel';
  panel.hidden = true;
  panel.innerHTML = '<div class="chart-card"><div class="chart-header"><div><div class="label">Meta Graph API</div><h2>Ads and organic content</h2></div></div><p id="metaStatus" class="caption">Open this tab to load the latest report.</p><div id="metaContent"></div></div>';
  inbox.after(panel);

  const style = document.createElement('style');
  style.textContent = '.meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.meta-card{border:1px solid var(--line);border-radius:12px;padding:18px;background:var(--panel);min-width:0}.meta-card h3{margin:0 0 10px;font-size:17px}.meta-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.meta-stat{padding:10px;border:1px solid var(--line);border-radius:9px;color:var(--muted);font-size:11px}.meta-stat strong{display:block;color:var(--text);font-size:18px}.meta-row{padding:9px 0;border-top:1px solid var(--line);font-size:12px;line-height:1.4}.meta-row small{display:block;color:var(--muted);margin-top:3px}.meta-warning{color:var(--positive);font-size:12px}@media(max-width:800px){.meta-grid{grid-template-columns:1fr}}@media(max-width:430px){.meta-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}';
  document.head.append(style);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const count = value => Number(value || 0).toLocaleString('en-CA');
  const money = (value, currency) => `${escapeHtml(currency)} ${Number(value || 0).toFixed(2)}`;
  let lastLoaded = 0;

  function render(data) {
    document.getElementById('metaStatus').textContent = `Checked ${new Date(data.checkedAt).toLocaleString()} · Read only · Page ${data.page.id || 'unavailable'}`;
    const ads = data.ads.status === 'ready' ? `<article class="meta-card"><h3>Ads · ${escapeHtml(data.ads.accountName)}</h3><div class="caption">${escapeHtml(data.ads.period.start || '')} to ${escapeHtml(data.ads.period.end || '')} · ${escapeHtml(data.ads.currency)}</div><div class="meta-stats"><div class="meta-stat">Spend<strong>${money(data.ads.totals.spend, data.ads.currency)}</strong></div><div class="meta-stat">Impressions<strong>${count(data.ads.totals.impressions)}</strong></div><div class="meta-stat">Reach<strong>${count(data.ads.totals.reach)}</strong></div><div class="meta-stat">Clicks<strong>${count(data.ads.totals.clicks)}</strong></div><div class="meta-stat">Link clicks<strong>${count(data.ads.totals.linkClicks)}</strong></div></div><div class="label">Campaigns with delivery</div>${data.ads.campaigns.map(campaign => `<div class="meta-row">${escapeHtml(campaign.name)}<small>${money(campaign.spend, data.ads.currency)} · ${count(campaign.impressions)} impressions · ${count(campaign.linkClicks)} link clicks</small></div>`).join('') || '<p class="caption">No ad delivery in this period.</p>'}</article>` : `<article class="meta-card"><h3>Ads</h3><p class="meta-warning">${escapeHtml(data.ads.reason)}</p></article>`;
    const page = data.page.status === 'ready' ? `<article class="meta-card"><h3>Organic · ${escapeHtml(data.page.name)}</h3><div class="caption">${count(data.page.followers)} followers · ${count(data.page.likes)} Page likes</div>${data.page.posts.status === 'ready' ? data.page.posts.items.map(post => `<div class="meta-row">${escapeHtml(post.text || 'Page post')}<small>${escapeHtml(post.createdAt?.slice(0, 10) || '')} · ${count(post.shares)} shares</small></div>`).join('') || '<p class="caption">No recent posts returned.</p>' : `<p class="meta-warning">${escapeHtml(data.page.posts.reason)}</p>`}<p class="caption">Meta has not granted reaction, comment, or post-view metrics for this token.</p></article>` : `<article class="meta-card"><h3>Organic Page</h3><p class="meta-warning">${escapeHtml(data.page.reason)}</p></article>`;
    document.getElementById('metaContent').innerHTML = `<div class="meta-grid">${ads}${page}</div>`;
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
