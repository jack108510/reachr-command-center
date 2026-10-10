(() => {
  const api = 'https://rose-publisher.wildeautomations.com/api/command-center';
  const nav = document.querySelector('.reachr-nav');
  const tab = document.createElement('button');
  tab.id = 'publisherTab';
  tab.type = 'button';
  tab.className = 'reachr-tab';
  tab.textContent = 'Publish to Page';
  tab.setAttribute('aria-selected', 'false');
  nav.append(tab);

  const panel = document.createElement('section');
  panel.id = 'publisherPanel';
  panel.hidden = true;
  panel.innerHTML = `<div class="publisher-head"><div><div class="label">Wildrose Automations · Facebook Page</div><h2>Make your next post count.</h2><p>Write the copy, add up to four photos, and review the exact post before it goes live.</p></div><span class="publisher-kicker">PAGE PUBLISHER</span></div>
    <div class="publisher-grid"><div class="publisher-compose"><label for="publisherCopy">Post copy</label><textarea id="publisherCopy" maxlength="5000" placeholder="What would you like to share?"></textarea><div class="publisher-media-head"><strong>Photos</strong><span id="publisherImageCount">0 of 4</span></div><label class="publisher-drop" for="publisherFiles"><span class="publisher-drop-icon">＋</span><strong>Choose JPG or PNG images</strong><small>Up to four photos · 8 MB each</small></label><input id="publisherFiles" type="file" accept="image/jpeg,image/png" multiple hidden><div id="publisherThumbs" class="publisher-thumbs"></div><div class="publisher-actions"><div><strong>Wildrose Automations</strong><small>Facebook Page · publishes immediately</small></div><button id="publisherReview" type="button" disabled>Review post</button></div><p id="publisherStatus" class="publisher-status" role="status" aria-live="polite">Checking Page connection…</p><a class="publisher-standalone" href="https://rose-publisher.wildeautomations.com/" target="_blank" rel="noopener noreferrer">Open standalone publisher ↗</a></div>
    <aside class="publisher-preview"><div class="publisher-preview-label">LIVE PREVIEW</div><div class="publisher-post"><div class="publisher-post-head"><span class="publisher-avatar">W</span><div><strong>Wildrose Automations</strong><small>Just now · Public</small></div></div><p id="publisherPreviewCopy" class="publisher-placeholder">Your post appears here as you write.</p><div id="publisherPreviewImages" class="publisher-preview-images"></div><div class="publisher-social"><span>Like</span><span>Comment</span><span>Share</span></div></div><p class="publisher-footnote">Photos stay on this device until you confirm publishing. The Page token stays on the publisher server.</p></aside></div>
    <div id="publisherConfirm" class="publisher-confirm" hidden><div class="publisher-confirm-card" role="dialog" aria-modal="true" aria-labelledby="publisherConfirmTitle"><div class="label">FINAL CHECK</div><h3 id="publisherConfirmTitle">Publish to Facebook?</h3><p id="publisherConfirmSummary"></p><p>This sends the exact copy and selected photos to the Wildrose Automations Facebook Page now.</p><div class="publisher-confirm-actions"><button id="publisherCancel" type="button">Keep editing</button><button id="publisherSend" type="button">Publish now</button></div></div></div>`;
  document.querySelector('main').append(panel);

  const $ = id => document.getElementById(id);
  const files = [];
  let connected = false;
  let sending = false;
  let uncertain = false;
  let lastCheck = 0;
  const setStatus = (message, tone = '') => { const el = $('publisherStatus'); el.textContent = message; el.dataset.tone = tone; };
  const canReview = () => connected && !sending && !uncertain && $('publisherCopy').value.trim().length > 0;
  const updateReview = () => { $('publisherReview').disabled = !canReview(); };

  function render() {
    const copy = $('publisherCopy').value;
    $('publisherPreviewCopy').textContent = copy || 'Your post appears here as you write.';
    $('publisherPreviewCopy').classList.toggle('publisher-placeholder', !copy);
    $('publisherImageCount').textContent = `${files.length} of 4`;
    $('publisherThumbs').replaceChildren();
    $('publisherPreviewImages').replaceChildren();
    $('publisherPreviewImages').classList.toggle('single', files.length === 1);
    files.forEach((entry, index) => {
      const card = document.createElement('div'); card.className = 'publisher-thumb';
      const image = document.createElement('img'); image.src = entry.url; image.alt = `Selected photo ${index + 1}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove photo ${index + 1}`);
      remove.onclick = () => { URL.revokeObjectURL(entry.url); files.splice(index, 1); render(); };
      card.append(image, remove); $('publisherThumbs').append(card);
      const preview = document.createElement('img'); preview.src = entry.url; preview.alt = `Post photo ${index + 1}`; $('publisherPreviewImages').append(preview);
    });
    updateReview();
  }

  async function sessionToken() {
    const { data: { session }, error } = await window.reachrSupabaseClient.auth.getSession();
    if (error || !session?.access_token) throw Error('Sign in to the Command Center again.');
    return session.access_token;
  }
  async function checkConnection(force = false) {
    if (!force && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    setStatus('Checking Page connection…');
    try {
      const response = await fetch(`${api}/config`, { headers: { Authorization: `Bearer ${await sessionToken()}` }, cache: 'no-store' });
      if (!response.ok) throw Error(response.status === 401 ? 'Sign in to the Command Center again.' : 'Publisher connection unavailable.');
      const config = await response.json();
      if (!config.pageId) throw Error('Facebook Page is not configured.');
      connected = true;
      setStatus(`Connected to ${config.pageName || 'Wildrose Automations'} · ready to publish`, 'ready');
    } catch (error) { connected = false; setStatus(`${error.message} Your draft stays here while this tab is open.`, 'error'); }
    updateReview();
  }
  const encode = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type: file.type, data: String(reader.result).split(',')[1] });
    reader.onerror = () => reject(Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
  function addFiles(selected) {
    for (const file of selected) {
      if (files.length >= 4) { setStatus('Choose no more than four photos.', 'error'); break; }
      if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 8 * 1024 * 1024 || !file.size) { setStatus(`${file.name}: use JPG or PNG, up to 8 MB.`, 'error'); continue; }
      files.push({ file, url: URL.createObjectURL(file) });
    }
    render();
  }
  $('publisherFiles').onchange = event => { addFiles(event.target.files); event.target.value = ''; };
  $('publisherCopy').oninput = render;
  $('publisherReview').onclick = () => {
    if (!canReview()) return;
    $('publisherConfirmSummary').textContent = `${$('publisherCopy').value.length} characters${files.length ? ` and ${files.length} photo${files.length === 1 ? '' : 's'}` : ', with no photos'}.`;
    $('publisherConfirm').hidden = false;
    $('publisherSend').focus();
  };
  $('publisherCancel').onclick = () => { $('publisherConfirm').hidden = true; $('publisherReview').focus(); };
  $('publisherSend').onclick = async () => {
    if (!canReview()) return;
    sending = true; updateReview(); $('publisherSend').disabled = true; $('publisherCancel').disabled = true;
    setStatus('Publishing to Facebook…');
    const requestId = crypto.randomUUID();
    let submitted = false;
    try {
      const images = await Promise.all(files.map(entry => encode(entry.file)));
      const token = await sessionToken();
      submitted = true;
      const response = await fetch(`${api}/publish`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, message: $('publisherCopy').value, images }), cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw Error(result.error || 'Facebook did not confirm the post.');
      $('publisherConfirm').hidden = true;
      uncertain = true;
      setStatus(result.verified ? 'Published and verified on Facebook.' : `Facebook returned a post ID. ${result.warning || 'Verify the post on the Page.'}`, result.verified ? 'ready' : 'error');
      try {
        const url = new URL(result.permalink);
        if (url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'))) {
          const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = ' View published post ↗'; $('publisherStatus').append(link);
        }
      } catch {}
    } catch (error) {
      $('publisherConfirm').hidden = true;
      if (submitted) uncertain = true;
      setStatus(`${error.message} ${submitted ? 'Check the Facebook Page before trying again. Reload this page to start a new post.' : 'Nothing was sent.'}`, 'error');
    } finally { sending = false; $('publisherSend').disabled = false; $('publisherCancel').disabled = false; updateReview(); }
  };

  tab.addEventListener('click', () => {
    for (const id of ['overviewPanel', 'inboxPanel', 'metaPanel', 'operationsPanel']) { const other = $(id); if (other) other.hidden = true; }
    panel.hidden = false;
    for (const button of nav.querySelectorAll('button')) { button.classList.remove('active'); button.setAttribute('aria-selected', 'false'); }
    tab.classList.add('active'); tab.setAttribute('aria-selected', 'true');
    history.replaceState(null, '', '#publish');
    checkConnection();
  });
  for (const button of nav.querySelectorAll('button')) if (button !== tab) button.addEventListener('click', () => { panel.hidden = true; tab.classList.remove('active'); tab.setAttribute('aria-selected', 'false'); });
  window.addEventListener('reachr-auth-open', () => { if (!panel.hidden) checkConnection(true); });
  if (window.wildroseInitialSection === '#publish') tab.click();
})();
