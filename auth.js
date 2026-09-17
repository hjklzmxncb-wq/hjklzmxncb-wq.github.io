(() => {
  const cfg = window.HOPPANG_CONFIG || {};
  const configured = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const listeners = [];
  let user = null;
  let purchases = [];
  let ready = false;

  const client = configured ? window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'hoppang-auth-session'
      }
    }
  ) : null;

  function snapshot() {
    return { user, purchases: [...purchases], configured, ready };
  }

  function emit() {
    const state = snapshot();
    listeners.forEach(fn => fn(state));
  }

  async function loadPurchases() {
    if (!client || !user) {
      purchases = [];
      return [];
    }
    const { data, error } = await client
      .from('purchases')
      .select('work_id,purchased_at')
      .eq('user_id', user.id);
    purchases = error ? [] : (data || []);
    return purchases;
  }

  async function refresh() {
    if (!client) {
      user = null;
      purchases = [];
      ready = true;
      emit();
      return;
    }
    const { data, error } = await client.auth.getSession();
    if (error) console.warn('[Auth] getSession:', error.message);
    user = data?.session?.user || null;
    await loadPurchases();
    ready = true;
    emit();
  }

  async function signIn(email, password) {
    if (!client) throw new Error('AUTH_NOT_CONFIGURED');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    user = data.user;
    await loadPurchases();
    ready = true;
    emit();
    return data;
  }

  async function signUp(email, password) {
    if (!client) throw new Error('AUTH_NOT_CONFIGURED');
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) throw error;
    user = data.session?.user || null;
    if (user) await loadPurchases();
    ready = true;
    emit();
    return data;
  }

  async function signInOAuth(provider) {
    if (!client) throw new Error('AUTH_NOT_CONFIGURED');
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo }
    });
    if (error) throw error;
    return data;
  }

  async function requestPasswordReset(email) {
    if (!client) throw new Error('AUTH_NOT_CONFIGURED');
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }

  async function updatePassword(password) {
    if (!client) throw new Error('AUTH_NOT_CONFIGURED');
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    user = data.user || user;
    emit();
    return data;
  }

  async function signOut() {
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) throw error;
    }
    user = null;
    purchases = [];
    ready = true;
    emit();
  }

  async function token() {
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data.session?.access_token || null;
  }

  function owns(workId) {
    return purchases.some(p => p.work_id === workId);
  }

  function onChange(fn) {
    listeners.push(fn);
    fn(snapshot());
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  if (client) {
    client.auth.onAuthStateChange((event, session) => {
      user = session?.user || null;
      ready = true;
      setTimeout(async () => {
        await loadPurchases();
        emit();
        if (event === 'PASSWORD_RECOVERY') {
          window.dispatchEvent(new CustomEvent('hoppang:password-recovery'));
        }
      }, 0);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
    window.addEventListener('storage', e => {
      if (e.key === 'hoppang-auth-session') refresh();
    });
  }

  window.HoppangAuth = {
    configured,
    client,
    refresh,
    signIn,
    signUp,
    signInOAuth,
    requestPasswordReset,
    updatePassword,
    signOut,
    token,
    owns,
    onChange,
    get user() { return user; },
    get purchases() { return [...purchases]; },
    get ready() { return ready; }
  };

  refresh();
})();
