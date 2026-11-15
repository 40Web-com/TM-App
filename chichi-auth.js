(() => {
  const config = window.CHICHI_AUTH_CONFIG || {};
  const storageKey = "chichi_ads_auth_session";
  const configured = () => Boolean(config.url && config.publishableKey &&
    !config.url.includes("YOUR_PROJECT") && !config.publishableKey.includes("YOUR_PUBLISHABLE"));
  const endpoint = (path) => config.url.replace(/\/$/, "") + "/auth/v1/" + path;
  const headers = (token) => ({
    "Content-Type": "application/json",
    apikey: config.publishableKey,
    ...(token ? { Authorization: "Bearer " + token } : {})
  });
  const readSession = () => {
    try { return JSON.parse(localStorage.getItem(storageKey) || "null"); }
    catch { return null; }
  };
  const saveSession = (session) => {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  };
  async function request(path, body, token) {
    const response = await fetch(endpoint(path), {
      method: "POST", headers: headers(token), body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.msg || result.message || result.error_description || result.error || "Authentication request failed.");
    return result;
  }
  async function refresh() {
    const current = readSession();
    if (!current?.refresh_token) return null;
    const next = await request("token?grant_type=refresh_token", { refresh_token: current.refresh_token });
    saveSession(next);
    return next;
  }
  async function getSession() {
    if (!configured()) return null;
    let current = readSession();
    if (!current?.access_token) return null;
    if (Number(current.expires_at || 0) * 1000 < Date.now() + 60000) {
      try { current = await refresh(); } catch { saveSession(null); return null; }
    }
    return current;
  }
  async function signIn(email, password) {
    if (!configured()) throw new Error("Chichi_Ads authentication is not configured yet. A separate Chichi_Ads Supabase project and its publishable settings are required.");
    const session = await request("token?grant_type=password", { email, password });
    saveSession(session);
    return session.user;
  }
  async function signInWithGoogle() {
    if (!configured()) throw new Error("Google sign-in is not configured yet. Connect the Chichi_Ads Supabase project and enable Google under Authentication → Providers.");
    const redirect = encodeURIComponent(window.location.href.split("?")[0].split("#")[0]);
    window.location.assign(endpoint("authorize?provider=google&redirect_to=" + redirect));
  }
  async function consumeOAuthCallback() {
    if (!configured()) return;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    if (!accessToken) return;
    const refreshToken = params.get("refresh_token");
    const expiresIn = Number(params.get("expires_in") || 3600);
    try {
      const response = await fetch(endpoint("user"), { headers: headers(accessToken) });
      const user = await response.json();
      if (!response.ok) throw new Error("Could not load the Google account.");
      saveSession({ access_token: accessToken, refresh_token: refreshToken, token_type: params.get("token_type") || "bearer", expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn, user });
      history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch (error) { console.error("Chichi_Ads OAuth callback failed:", error); }
  }
  consumeOAuthCallback();
  async function signOut() {
    const session = await getSession();
    if (session?.access_token && configured()) {
      try {
        await fetch(endpoint("logout"), { method: "POST", headers: headers(session.access_token) });
      } finally { saveSession(null); }
    } else saveSession(null);
  }
  window.ChichiAuth = { configured, getSession, signIn, signInWithGoogle, signOut };
})();