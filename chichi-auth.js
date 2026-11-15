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
      category:project.category || "business", template_key:project.template || "business-starter",
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
  async function listMarketplace() {
    return await api("chichi_listings?select=id,title,slug,category,description,price_kobo,currency,demo_url,preview_image,features,licence_terms&review_status=eq.approved&order=is_featured.desc,created_at.desc");
  }
  async function submitListing(listing) {
    const session=await getSession();
    const slug=listing.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)+"-"+Math.random().toString(36).slice(2,6);
    const rows=await api("chichi_listings?select=id,title,review_status",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({seller_id:session.user.id,title:listing.title,slug,category:listing.category,description:listing.description,price_kobo:Math.round(Number(listing.price)*100),demo_url:listing.demo_url||"",licence_terms:listing.licence_terms||"",review_status:"pending"})});
    return rows?.[0];
  }
  async function applyDeveloper(profile) {
    const session=await getSession();
    const rows=await api("chichi_developer_profiles?select=id,status",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({id:session.user.id,display_name:profile.display_name,bio:profile.bio||"",portfolio_url:profile.portfolio_url||"",status:"pending"})});
    return rows?.[0];
  }
  async function applyAffiliate() {
    const session=await getSession();
    const code="CHICHI"+Math.random().toString(36).slice(2,9).toUpperCase();
    const rows=await api("chichi_affiliate_profiles?select=id,referral_code,status",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({id:session.user.id,referral_code:code,status:"pending"})});
    return rows?.[0];
  }
  async function createSupportTicket(ticket) {
    const session=await getSession();
    const rows=await api("chichi_support_tickets?select=id,subject,status,created_at",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({owner_id:session.user.id,subject:ticket.subject,message:ticket.message})});
    return rows?.[0];
  }
  async function createOrder(order) {
    const session=await getSession();
    const rows=await api("chichi_orders?select=id,item_name,amount_kobo,payment_status,created_at",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({buyer_id:session.user.id,listing_id:order.listing_id||null,item_name:order.item_name,amount_kobo:Math.round(Number(order.amount)*100),currency:"NGN",payment_status:"pending",fulfilment_status:"awaiting_payment",provider:"manual"})});
    return rows?.[0];
  }
  async function listOrders() { return await api("chichi_orders?select=id,item_name,amount_kobo,payment_status,fulfilment_status,created_at&order=created_at.desc"); }
  async function listMyListings() { return await api("chichi_listings?select=id,title,review_status,created_at&order=created_at.desc"); }
  async function listHostingPlans() { return await api("chichi_hosting_plans?select=id,name,price_kobo,billing_period,storage_mb,bandwidth_gb,backups_included&is_active=eq.true"); }
  async function requestHosting(projectId, planId) {
    const session=await getSession();
    const rows=await api("chichi_hosting_subscriptions?select=id,status,created_at",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({owner_id:session.user.id,project_id:projectId||null,plan_id:planId,status:"pending"})});
    return rows?.[0];
  }
  async function uploadAsset(file) {
    const session=await getSession();
    const types=["image/jpeg","image/png","image/webp","image/gif","image/svg+xml"];
    if(!file || !types.includes(file.type) || file.size>5242880) throw new Error("Choose a JPG, PNG, WEBP, GIF or SVG image under 5 MB.");
    const name=crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
    const path=session.user.id+"/"+name;
    const response=await fetch(config.url.replace(/[/]$/,"")+"/storage/v1/object/chichi-website-assets/"+path,{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":file.type,"x-upsert":"false"},body:file});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.message||"Image upload failed.");
    return path;
  }
  async function adminAction(action,id,extra={}) {
    const session=await getSession();
    const response=await fetch(config.url.replace(/[/]$/,"")+"/functions/v1/chichi-admin",{method:"POST",headers:{apikey:config.publishableKey,Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action,id,...extra})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.error||"Administrator action failed.");
    return result.result;
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
  window.ChichiAuth = { configured, getSession, signIn, signUp, resetPassword, signInWithGoogle, signOut, listProjects, saveProject, deleteProject, listProjectVersions, restoreProjectVersion, listMarketplace, submitListing, applyDeveloper, applyAffiliate, createSupportTicket, createOrder, listOrders, listMyListings, listHostingPlans, requestHosting, uploadAsset, adminAction };
})();