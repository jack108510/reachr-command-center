/* The password is verified by Supabase Auth; it is never embedded in the public site. */
(() => {
  const el = id => document.getElementById(id);
  const config = window.REACHR_SUPABASE;
  const gate = el('pilotGate');
  const main = document.querySelector('main');
  const frame = el('inboxFrame');
  const email = 'wildejack1010@gmail.com';
  if (!config || !window.supabase) {
    el('gateError').textContent = 'Access service unavailable. Reload this page.';
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey);
  function show(open) {
    gate.hidden = open;
    main.hidden = !open;
    if (!open) frame.removeAttribute('src');
    if (open && location.hash === '#inbox' && !frame.getAttribute('src')) {
      frame.src = 'private.html?v=pilot-password-1';
    }
  }
  async function check() {
    try {
      const { data: { user }, error } = await client.auth.getUser();
      show(!error && user?.email === email && !!user.email_confirmed_at);
    } catch {
      show(false);
      el('gateError').textContent = 'Could not check access. Reload this page.';
    }
  }
  el('pilotForm').addEventListener('submit', async event => {
    event.preventDefault();
    const password = el('pilotPassword').value;
    el('pilotPassword').value = '';
    el('gateError').textContent = 'Checking…';
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || data.user?.email !== email || !data.user.email_confirmed_at) {
        show(false);
        el('gateError').textContent = 'Incorrect password.';
        return;
      }
      el('gateError').textContent = '';
      show(true);
    } catch {
      show(false);
      el('gateError').textContent = 'Could not check access. Reload this page.';
    }
  });
  el('lockSite').addEventListener('click', async () => {
    show(false);
    await client.auth.signOut();
  });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') show(false);
  });
  check();
})();
