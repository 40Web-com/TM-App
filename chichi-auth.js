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
  const persistSession = (session) => {
    if (session?.access_token) {
      if (!session.expires_at) session.expires_at = Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
      saveSession(session);
    }
    return session;
  };
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
    persistSession(next);
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
    persistSession(session);
    return session.user;
  }
  async function signInWithGoogle() {
    if (!configured()) throw new Error("Chichi_Ads Google sign-in is not configured.");
    const random = new Uint8Array(48);
    crypto.getRandomValues(random);
    const verifier = btoa(String.fromCharCode(...random)).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
    localStorage.setItem("chichi_ads_pkce_verifier", verifier);
    const redirect = window.location.origin + window.location.pathname;
    const url = endpoint("authorize") + "?provider=google&redirect_to=" + encodeURIComponent(redirect) +
      "&code_challenge=" + encodeURIComponent(challenge) + "&code_challenge_method=s256";
    window.location.assign(url);
  }
  async function consumeOAuthCallback() {
    if (!configured()) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;
    const verifier = localStorage.getItem("chichi_ads_pkce_verifier");
    if (!verifier) { console.error("Chichi_Ads OAuth verifier is missing."); return; }
    try {
      const response = await fetch(endpoint("token?grant_type=pkce"), {
        method:"POST", headers:headers(),
        body:JSON.stringify({auth_code:code,code_verifier:verifier})
      });
      const session = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(session.msg || session.message || "Google sign-in could not be completed.");
      persistSession(session);
      localStorage.removeItem("chichi_ads_pkce_verifier");
      history.replaceState({},document.title,window.location.pathname);
    } catch(error) {
      console.error("Chichi_Ads Google callback failed:",error);
      localStorage.removeItem("chichi_ads_pkce_verifier");
      alert(error.message);
      history.replaceState({},document.title,window.location.pathname);
    }
  }
  consumeOAuthCallback();
  async function signUp(email, password) {
    if (!configured()) throw new Error("Chichi_Ads account service is not configured.");
    const result = await request("signup", { email, password });
    if (result?.access_token) persistSession(result);
    return result;
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
  async function listProjectVersions(id) {
    return await api("chichi_website_project_versions?select=id,version_number,snapshot,created_at&project_id=eq."+encodeURIComponent(id)+"&order=version_number.desc");
  }
  async function restoreProjectVersion(id, snapshot) {
    const rows = await api("chichi_website_projects?id=eq."+encodeURIComponent(id)+"&select=id", {
      method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({content:snapshot,updated_at:new Date().toISOString()})
    });
    if (!rows?.length) throw new Error("Could not restore this version.");
    const latest = await listProjectVersions(id);
    await api("chichi_website_project_versions",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({
      project_id:id,owner_id:(await getSession()).user.id,version_number:(latest?.[0]?.version_number||0)+1,snapshot
    })});
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
  window.ChichiAuth = { configured, getSession, signIn, signUp, resetPassword, signInWithGoogle, signOut, listProjects, saveProject, deleteProject, listProjectVersions, restoreProjectVersion };
})();