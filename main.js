const app = document.querySelector("#app");

const icon = (name) => {
  const paths = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    chats: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    discover: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
    sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z"/>',
    wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M16 14h2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkle}</svg>`;
};

const navItems = [
  { id: "home", label: "Home", icon: "home" },
  { id: "chats", label: "Chats", icon: "chats" },
  { id: "discover", label: "Discover", icon: "discover" },
  { id: "profile", label: "Profile", icon: "profile" }
];

let activePage = "home";

function navButton(item, mobile = false) {
  return `<button class="${mobile ? "mobile-nav-item" : "nav-item"} ${activePage === item.id ? "active" : ""}" data-page="${item.id}" ${activePage === item.id ? 'aria-current="page"' : ""}>
    ${icon(item.icon)}<span>${mobile ? `<small>${item.label}</small>` : item.label}</span>
  </button>`;
}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="./" data-page="home" aria-label="TM App home"><img class="brand-logo" src="./logo.svg" alt=""><span>TM <b>App</b></span></a>
        <nav aria-label="Main navigation">${navItems.map(item => navButton(item)).join("")}</nav>
        <div class="sidebar-footer"><span class="footer-heart">${icon("heart")}</span><span>Your world. Your people.</span></div>
      </aside>
      <main class="main-content">
        <header class="topbar">
          <a class="mobile-brand" href="./" data-page="home"><img class="brand-logo" src="./logo.svg" alt=""><span>TM App</span></a>
          <div class="topbar-spacer"></div>
          <span class="topbar-note">Connect with your people</span>
          <button class="avatar-button" data-page="profile" aria-label="Open profile">${icon("profile")}</button>
        </header>
        <section class="page-content">${renderPage()}</section>
        <nav class="mobile-nav" aria-label="Mobile navigation">${navItems.map(item => navButton(item, true)).join("")}</nav>
      </main>
    </div>`;

  app.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", event => {
      if (button.tagName === "A") event.preventDefault();
      activePage = button.dataset.page;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function renderPage() {
  if (activePage === "home") return homePage();
  const pageMap = {
    chats: ["TM Chat", "Private conversations, all in one place.", "Chat features are scheduled for build step 4."],
    discover: ["Discover", "Find friends, dating connections, and your community.", "Profiles and matching are scheduled for build step 5."],
    profile: ["Your Profile", "Your TM identity starts here.", "Profile creation and editing are scheduled for build step 3."]
  };
  const [title, subtitle, note] = pageMap[activePage] || pageMap.profile;
  return `<div class="page-heading"><p class="eyebrow">TM APP</p><h1>${title}</h1><p class="lead">${subtitle}</p></div>
    <div class="coming-panel"><div class="coming-mark">${icon("sparkle")}</div><span class="status-label">BUILD IN PROGRESS</span><h2>Coming in its build step</h2><p>${note}</p><button class="primary-button" data-page="home">Back to Home</button></div>`;
}

function homePage() {
  return `
    <div class="hero">
      <div class="hero-copy">
        <p class="eyebrow">WELCOME TO TM</p>
        <h1>Your world.<br><span>Your people.</span></h1>
        <p class="lead">A place to chat privately, meet people, and discover something new.</p>
      </div>
      <div class="hero-art" aria-hidden="true"><div class="hero-halo"></div><img src="./logo.svg" alt=""></div>
    </div>
    <div class="section-heading"><div><p class="eyebrow">EXPLORE TM</p><h2>What brings you here?</h2></div></div>
    <div class="category-grid">
      <button class="category-card" data-page="chats"><span class="category-icon">${icon("chats")}</span><span class="category-title">TM Chat</span><span class="category-copy">Private conversations with your people.</span><span class="category-action">Open chats ${icon("arrow")}</span></button>
      <button class="category-card" data-page="discover"><span class="category-icon">${icon("heart")}</span><span class="category-title">Dating & Friends</span><span class="category-copy">Discover people and build real connections.</span><span class="category-action">Discover people ${icon("arrow")}</span></button>
      <button class="category-card" data-page="ai"><span class="category-icon">${icon("sparkle")}</span><span class="category-title">AI Studio</span><span class="category-copy">Creative AI tools, unlocked at Tier 60.</span><span class="category-action">Explore AI Studio ${icon("arrow")}</span></button>
      <button class="category-card" data-page="plans"><span class="category-icon">${icon("wallet")}</span><span class="category-title">Plans & Tiers</span><span class="category-copy">Explore Gold, Diamond, and Platinum.</span><span class="category-action">View plans ${icon("arrow")}</span></button>
    </div>
    <div class="home-note"><span class="note-icon">${icon("heart")}</span><div><strong>A little space to feel connected.</strong><p>TM brings chat, friendships, dating, and AI experiences together in one place.</p></div></div>
    <div class="section-heading suggested-heading"><div><p class="eyebrow">YOUR COMMUNITY</p><h2>People suggested for you</h2></div><span class="coming-tag">Coming soon</span></div>
    <div class="suggested-preview"><div class="suggested-avatar">${icon("profile")}</div><div><strong>Your suggestions will appear here</strong><p>Complete your profile to help TM find people with shared interests.</p></div></div>`;
}

render();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}
