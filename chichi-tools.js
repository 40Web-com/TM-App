(() => {
  const app = document.getElementById("app");
  const cfg = window.CHICHI_AUTH_CONFIG || {};
  let allTools = [];
  let busy = false;
  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const base = () => String(cfg.url || "").replace(/\/$/, "");
  const openSignIn = () => {
    const layer = document.getElementById("auth-layer");
    if (layer) layer.hidden = false;
  };
  async function currentSession() {
    return await window.ChichiAuth?.getSession().catch(() => null);
  }
  function headers(session, extra = {}) {
    return {
      apikey: cfg.publishableKey,
      Authorization: "Bearer " + (session?.access_token || cfg.publishableKey),
      ...extra
    };
  }
  async function loadAllTools() {
    const target = document.getElementById("all-tools-grid");
    if (!target || target.dataset.loading === "1") return;
    target.dataset.loading = "1";
    target.innerHTML = '<div class="empty">Loading approved tools…</div>';
    try {
      const session = await currentSession();
      const url = base() + "/rest/v1/chichi_listings?select=id,title,description,price_kobo,currency,preview_images,listing_kind,asset_count&category=eq.all-tools&review_status=eq.approved&order=created_at.desc";
      const response = await fetch(url, { headers: headers(session) });
      const rows = await response.json().catch(() => []);
      if (!response.ok) throw new Error(rows?.message || "Could not load the All Tools marketplace.");
      allTools = Array.isArray(rows) ? rows : [];
      if (!allTools.length) {
        target.innerHTML = '<div class="empty">No approved tools yet. Use ＋ Add to submit the first collection.</div>';
      } else {
        target.innerHTML = allTools.map(item => {
          const previews = Array.isArray(item.preview_images) ? item.preview_images : [];
          const first = previews[0] || "";
          const kind = item.listing_kind === "video_pack" ? "Video pack" : item.listing_kind === "mixed" ? "Images + video" : "Image pack";
          return '<article class="tool-card"><div class="tool-card-media">' +
            (first ? '<img src="' + safe(first) + '" alt="' + safe(item.title) + '">' : '<span>✦</span>') +
            '<small>' + safe(kind) + '</small></div><div class="tool-card-body"><h4>' + safe(item.title) +
            '</h4><p>' + safe(item.description) + '</p><div class="tool-card-meta"><b>₦' +
            (Number(item.price_kobo || 0) / 100).toLocaleString() + '</b><span>' +
            Number(item.asset_count || 0) + ' files</span></div><button class="btn outline" data-tool-preview="' +
            safe(item.id) + '">Preview</button></div></article>';
        }).join("");
      }
      await loadMyToolPurchases();
    } catch (error) {
      target.innerHTML = '<div class="empty">' + safe(error.message || "Could not load tools.") + '</div>';
    } finally {
      target.dataset.loading = "0";
    }
  }
  async function loadMyToolPurchases() {
    const target = document.getElementById("my-tool-purchase-list");
    if (!target) return;
    const session = await currentSession();
    if (!session) {
      target.textContent = "Sign in to view your purchases.";
      return;
    }
    try {
      const orders = await window.ChichiAuth.listOrders();
      const ids = new Set(allTools.map(x => x.id));
      const purchases = (orders || []).filter(order => order.listing_id && ids.has(order.listing_id));
      if (!purchases.length) {
        target.textContent = "Your All Tools purchases will appear here.";
        return;
      }
      target.innerHTML = purchases.map(order => {
        const verified = order.payment_status === "verified";
        return '<div class="tool-purchase-row"><div><b>' + safe(order.item_name) +
          '</b><small>' + (verified ? "Payment confirmed · files unlocked" : "Payment awaiting confirmation") +
          '</small></div>' + (verified ?
          '<button class="btn" data-tool-download="' + safe(order.listing_id) + '">Get full files</button>' :
          '<span class="tool-pending">Pending</span>') +
          '<div class="tool-download-links" id="tool-downloads-' + safe(order.listing_id) + '"></div></div>';
      }).join("");
    } catch (error) {
      target.textContent = error.message || "Could not load your purchases.";
    }
  }
  function showToolPreview(id) {
    const item = allTools.find(x => x.id === id);
    if (!item) return;
    const previews = Array.isArray(item.preview_images) ? item.preview_images.slice(0, 2) : [];
    const content = document.getElementById("tool-preview-content");
    const modal = document.getElementById("tool-preview-modal");
    if (!content || !modal) return;
    const images = previews.map((src, i) =>
      '<img src="' + safe(src) + '" alt="Preview ' + (i + 1) + ' for ' + safe(item.title) + '">'
    ).join("");
    content.innerHTML = '<div class="eyebrow">ALL TOOLS · PREVIEW</div><h3>' + safe(item.title) +
      '</h3><div class="tool-preview-images">' + images + '</div><p>' + safe(item.description) +
      '</p><div class="tool-card-meta"><b>₦' + (Number(item.price_kobo || 0) / 100).toLocaleString() +
      '</b><span>' + Number(item.asset_count || 0) + ' original files</span></div><p class="muted">You are viewing two preview photos. The complete original collection unlocks after payment is confirmed.</p><button class="btn" data-tool-buy="' +
      safe(item.id) + '">Buy and unlock full files</button>';
    modal.hidden = false;
  }
  async function buyTool(id) {
    const session = await currentSession();
    if (!session) { openSignIn(); return; }
    const item = allTools.find(x => x.id === id);
    if (!item) return;
    try {
      const order = await window.ChichiAuth.createOrder({
        listing_id: item.id,
        item_name: item.title,
        amount: Number(item.price_kobo || 0) / 100
      });
      const modal = document.getElementById("tool-preview-modal");
      if (modal) modal.hidden = true;
      alert("Purchase request created. Reference: " + order.id + ". Your full files will unlock after payment is confirmed.");
      await loadMyToolPurchases();
    } catch (error) {
      alert(error.message || "Could not create the purchase request.");
    }
  }
  async function downloadTool(id) {
    const session = await currentSession();
    if (!session) { openSignIn(); return; }
    const target = document.getElementById("tool-downloads-" + id);
    if (!target) return;
    target.textContent = "Preparing secure download links…";
    try {
      const response = await fetch(base() + "/functions/v1/chichi-marketplace-access", {
        method: "POST",
        headers: headers(session, { "Content-Type": "application/json" }),
        body: JSON.stringify({ listing_id: id })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not unlock the files.");
      target.innerHTML = '<div class="tool-download-list">' + (result.files || []).map(file =>
        '<a href="' + safe(file.url) + '" target="_blank" rel="noopener">↓ ' + safe(file.file_name) +
        ' <small>(' + (Number(file.file_size || 0) / 1048576).toFixed(1) + ' MB)</small></a>'
      ).join("") + '</div><small class="muted">Secure links expire in 10 minutes. Open or save them now.</small>';
    } catch (error) {
      target.textContent = error.message || "Could not prepare downloads.";
    }
  }
  function cleanName(name) {
    return String(name || "file").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(-100) || "file";
  }
  async function uploadObject(session, bucket, path, file) {
    const response = await fetch(base() + "/storage/v1/object/" + bucket + "/" + path, {
      method: "POST",
      headers: headers(session, { "Content-Type": file.type, "x-upsert": "false" }),
      body: file
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || result.error || "File upload failed.");
  }
  async function submitToolListing(form) {
    if (busy) return;
    busy = true;
    const status = document.getElementById("tool-upload-status");
    const submit = form.querySelector('button[type="submit"]');
    const session = await currentSession();
    if (!session) { busy = false; openSignIn(); return; }
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const description = String(data.get("description") || "").trim();
    const price = Number(data.get("price"));
    const previews = Array.from(form.querySelector('[name="preview_files"]').files || []);
    const files = Array.from(form.querySelector('[name="full_files"]').files || []);
    const allowed = new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","video/quicktime"]);
    if (previews.length !== 2 || previews.some(file => !file.type.startsWith("image/"))) {
      status.textContent = "Choose exactly two preview images.";
      busy = false; return;
    }
    if (!files.length || files.length > 20 || files.some(file => !allowed.has(file.type) || file.size > 104857600)) {
      status.textContent = "Choose 1–20 supported image or video files. Each file must be 100 MB or smaller.";
      busy = false; return;
    }
    if (previews.some(file => file.size > 5242880)) {
      status.textContent = "Each preview image must be 5 MB or smaller.";
      busy = false; return;
    }
    if (!title || description.length < 15 || !Number.isFinite(price) || price < 1) {
      status.textContent = "Complete the title, description and a price above ₦0.";
      busy = false; return;
    }
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 314572800) {
      status.textContent = "The complete upload must be 300 MB or smaller.";
      busy = false; return;
    }
    if (submit) submit.disabled = true;
    const folder = session.user.id + "/" + crypto.randomUUID();
    const previewUrls = [];
    const assetRows = [];
    try {
      status.textContent = "Uploading the two preview photos…";
      for (let i = 0; i < previews.length; i++) {
        const path = folder + "/preview-" + (i + 1) + "-" + cleanName(previews[i].name);
        await uploadObject(session, "chichi-marketplace-previews", path, previews[i]);
        previewUrls.push(base() + "/storage/v1/object/public/chichi-marketplace-previews/" + path);
      }
      let imageCount = 0, videoCount = 0;
      status.textContent = "Uploading full original files…";
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = folder + "/file-" + String(i + 1).padStart(2, "0") + "-" + cleanName(file.name);
        await uploadObject(session, "chichi-marketplace-files", path, file);
        if (file.type.startsWith("video/")) videoCount++; else imageCount++;
        assetRows.push({
          seller_id: session.user.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          sort_order: i
        });
      }
      const kind = imageCount && videoCount ? "mixed" : videoCount ? "video_pack" : "image_pack";
      const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) + "-" + crypto.randomUUID().slice(0, 6);
      status.textContent = "Saving your listing for review…";
      const listingResponse = await fetch(base() + "/rest/v1/chichi_listings?select=id", {
        method: "POST",
        headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=representation" }),
        body: JSON.stringify({
          seller_id: session.user.id,
          title,
          slug,
          category: "all-tools",
          description,
          price_kobo: Math.round(price * 100),
          currency: "NGN",
          preview_image: previewUrls[0],
          preview_images: previewUrls,
          listing_kind: kind,
          asset_count: files.length,
          features: [],
          licence_terms: "Buyer receives access to the original files after payment is confirmed. Seller confirms they have the rights to sell these files.",
          review_status: "pending"
        })
      });
      const listingResult = await listingResponse.json().catch(() => ({}));
      if (!listingResponse.ok || !listingResult?.[0]?.id) throw new Error(listingResult.message || "Could not save your listing.");
      const listingId = listingResult[0].id;
      const assets = assetRows.map(row => ({ ...row, listing_id: listingId }));
      const assetResponse = await fetch(base() + "/rest/v1/chichi_listing_assets", {
        method: "POST",
        headers: headers(session, { "Content-Type": "application/json", "Prefer": "return=minimal" }),
        body: JSON.stringify(assets)
      });
      if (!assetResponse.ok) {
        const err = await assetResponse.json().catch(() => ({}));
        throw new Error(err.message || "Your listing was saved, but its file records could not be completed. Please contact support.");
      }
      status.textContent = "Submitted successfully. Your listing will appear in All Tools after admin approval.";
      form.reset();
      const modal = document.getElementById("tool-upload-modal");
      if (modal) modal.hidden = true;
      alert("Your All Tools listing has been submitted for review.");
    } catch (error) {
      status.textContent = error.message || "Upload failed. Please try again.";
    } finally {
      busy = false;
      if (submit) submit.disabled = false;
    }
  }
  async function generateImage() {
    const prompt = document.getElementById("ai-image-prompt")?.value.trim();
    const status = document.getElementById("ai-image-status");
    const resultTarget = document.getElementById("ai-image-result");
    const button = document.getElementById("ai-image-generate");
    if (!prompt || prompt.length < 8) { status.textContent = "Write a more detailed prompt first."; return; }
    const session = await currentSession();
    if (!session) { openSignIn(); return; }
    button.disabled = true;
    status.textContent = "Connecting to APInex…";
    resultTarget.innerHTML = "";
    try {
      const response = await fetch(base() + "/functions/v1/chichi-ai", {
        method: "POST",
        headers: headers(session, { "Content-Type": "application/json" }),
        body: JSON.stringify({ prompt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Image generation failed.");
      const src = data.image || data.image_url;
      if (!src) throw new Error("APInex returned no image.");
      resultTarget.innerHTML = '<div class="ai-generated-wrap"><img class="ai-generated-image" src="' + safe(src) + '" alt="AI generated image"><a class="btn outline" href="' + safe(src) + '" download="chichi-ai-image.png" target="_blank" rel="noopener">Download image</a></div>';
      status.textContent = "Image generated successfully.";
    } catch (error) {
      status.textContent = error.message || "Could not generate this image.";
    } finally {
      button.disabled = false;
    }
  }
  app.addEventListener("click", async event => {
    const tab = event.target.closest("[data-market-tab]");
    if (tab) {
      app.querySelectorAll("[data-market-tab]").forEach(button => button.classList.toggle("active", button === tab));
      const all = document.getElementById("market-all-tools");
      const websites = document.getElementById("market-websites");
      if (all) all.hidden = tab.dataset.marketTab !== "all-tools";
      if (websites) websites.hidden = tab.dataset.marketTab !== "websites";
      if (tab.dataset.marketTab === "all-tools") loadAllTools();
      return;
    }
    if (event.target.closest("#open-tool-upload")) {
      const session = await currentSession();
      if (!session) { openSignIn(); return; }
      const modal = document.getElementById("tool-upload-modal");
      if (modal) modal.hidden = false;
      return;
    }
    const close = event.target.closest("[data-close-tool-modal]");
    if (close) {
      const modal = close.closest(".tool-modal");
      if (modal) modal.hidden = true;
      return;
    }
    const preview = event.target.closest("[data-tool-preview]");
    if (preview) { showToolPreview(preview.dataset.toolPreview); return; }
    const buy = event.target.closest("[data-tool-buy]");
    if (buy) { await buyTool(buy.dataset.toolBuy); return; }
    const download = event.target.closest("[data-tool-download]");
    if (download) { await downloadTool(download.dataset.toolDownload); return; }
    if (event.target.id === "ai-image-generate") { await generateImage(); return; }
  });
  app.addEventListener("submit", async event => {
    if (event.target.id !== "tool-upload-form") return;
    event.preventDefault();
    await submitToolListing(event.target);
  });
  const observer = new MutationObserver(() => {
    const grid = document.getElementById("all-tools-grid");
    if (grid && grid.dataset.loaded !== "1") {
      grid.dataset.loaded = "1";
      loadAllTools();
    }
  });
  observer.observe(app, { childList: true, subtree: true });
})();