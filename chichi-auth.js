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
  async function signUp(email, password) {
    if (!configured()) throw new Error("Chichi_Ads account service is not configured.");
    return await request("signup", { email, password });
  }
  async function resetPassword(email) {
    if (!configured()) throw new Error("Chichi_Ads account service is not configured.");
    const response = await fetch(endpoint("recover"), { method:"POST", headers:headers(), body:JSON.stringify({email}) });
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result.msg || result.message || "Could not send password reset email.");
    return true;
  }
  async function api(path, options={}) {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Please sign in to manage your websites.");
    const base = config.url.replace(/[/]$/, "");
    const response = await fetch(base + "/rest/v1/" + path, {
      ...options,
      headers: { apikey:config.publishableKey, Authorization:"Bearer "+session.access_token,
        "Content-Type":"application/json", ...(options.headers||{}) }
    });
    const raw = await response.text();
    const result = raw ? JSON.parse(raw) : null;
    if (!response.ok) throw new Error(result?.message || result?.hint || "Website project request failed.");
    return result;
  }
  async function listProjects() {
    return await api("chichi_website_projects?select=id,name,slug,category,template_key,status,content,updated_at&order=updated_at.desc");
  }
  async function saveProject(project) {
    const session = await getSession();
    if (!session?.user?.id) throw new Error("Please sign in first.");
    const record = { owner_id:session.user.id, name:project.name, slug:project.slug,
      category:project.category || "business", template_key:"business-starter",
      content:project.content, updated_at:new Date().toISOString() };
    let saved;
    if (project.id) {
      const rows = await api("chichi_website_projects?id=eq."+encodeURIComponent(project.id)+"&select=id,name,slug,category,content,updated_at", {
        method:"PATCH", headers:{"Prefer":"return=representation"}, body:JSON.stringify(record)
      });
      saved = rows?.[0];
    } else {
      const rows = await api("chichi_website_projects?select=id,name,slug,category,content,updated_at", {
        method:"POST", headers:{"Prefer":"return=representation"}, body:JSON.stringify(record)
      });
      saved = rows?.[0];
    }
    if (!saved) throw new Error("The project could not be saved.");
    const latest = await api("chichi_website_project_versions?select=version_number&project_id=eq."+encodeURIComponent(saved.id)+"&order=version_number.desc&limit=1");
    const version = (latest?.[0]?.version_number || 0) + 1;
    await api("chichi_website_project_versions", {method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({
      project_id:saved.id, owner_id:session.user.id, version_number:version, snapshot:saved.content
    })});
    return saved;
  }
  async function deleteProject(id) {
    await api("chichi_website_projects?id=eq."+encodeURIComponent(id), {method:"DELETE"});
    return true;
  }
  async function signOut() {
    const session = await getSession();
    if (session?.access_token && configured()) {
      try {
        await fetch(endpoint("logout"), { method: "POST", headers: headers(session.access_token) });
      } finally { saveSession(null); }
    } else saveSession(null);
  }
  window.ChichiAuth = { configured, getSession, signIn, signUp, resetPassword, signInWithGoogle, signOut, listProjects, saveProject, deleteProject };
})();