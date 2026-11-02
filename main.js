const app = document.querySelector("#app");

const logo = '<img class="brand-logo" src="./logo.svg" alt="TM App twin-heart flame logo">';
const navItems = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "chats", label: "Chats", icon: "▤" },
  { id: "discover", label: "Discover", icon: "◎" },
  { id: "ai", label: "AI Studio", icon: "✦" },
  { id: "profile", label: "Profile", icon: "◉" }
];

let activePage = "home";

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" href="#" aria-label="TM App home">${logo}<span>TM App</span></a>
        <nav aria-label="Main navigation">
          ${navItems.map(item => `
            <button class="nav-item ${activePage === item.id ? "active" : ""}" data-page="${item.id}">
              <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
            </button>
          `).join("")}
        </nav>
        <div class="sidebar-footer">Your world. Your people.</div>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div class="mobile-brand">${logo}<span>TM App</span></div>
          <div class="topbar-note">Connect. Chat. Discover.</div>
          <button class="avatar-button" aria-label="Open profile" data-page="profile">Y</button>
        </header>

        <section class="page-content">
          ${renderPage()}
        </section>

        <nav class="mobile-nav" aria-label="Mobile navigation">
          ${navItems.map(item => `
            <button class="mobile-nav-item ${activePage === item.id ? "active" : ""}" data-page="${item.id}">
              <span>${item.icon}</span><small>${item.label}</small>
            </button>
          `).join("")}
        </nav>
      </main>
    </div>
  `;

  app.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      activePage = button.dataset.page;
      render();
    });
  });
}

function renderPage() {
  const pages = {
    home: `
      <div class="welcome-row">
        <div><p class="eyebrow">WELCOME TO TM</p><h1>Your world,<br /><span>your people.</span></h1></div>
        <div class="welcome-orb" aria-hidden="true"><img src="./logo.svg" alt="" /></div>
      </div>
      <p class="lead">A place to connect, make friends, chat, and explore something new.</p>
      <div class="feature-grid">
        <button class="feature-card chat-card" data-page="chats"><span class="feature-symbol">✉</span><span class="feature-title">Private Chats</span><span class="feature-description">Talk one-on-one and stay connected.</span><span class="feature-link">Open chats ↗</span></button>
        <button class="feature-card discover-card" data-page="discover"><span class="feature-symbol">◎</span><span class="feature-title">Discover People</span><span class="feature-description">Meet new people and find your community.</span><span class="feature-link">Start discovering ↗</span></button>
        <button class="feature-card ai-card" data-page="ai"><span class="feature-symbol">✦</span><span class="feature-title">AI Studio</span><span class="feature-description">A creative space for AI-powered experiences.</span><span class="feature-link">Explore AI Studio ↗</span></button>
        <button class="feature-card profile-card" data-page="profile"><span class="feature-symbol">◉</span><span class="feature-title">Your Profile</span><span class="feature-description">Make your TM identity yours.</span><span class="feature-link">View profile ↗</span></button>
      </div>
      <div class="notice"><span class="notice-dot"></span><div><strong>TM is getting ready.</strong><p>This is the first app shell. Accounts, messaging, discovery, and AI features will be connected in upcoming milestones.</p></div></div>
    `,
    chats: pagePlaceholder("Chats", "Your conversations will live here.", "Messaging is not connected yet."),
    discover: pagePlaceholder("Discover", "Meet people and find your community.", "Discovery and matching will be built in a later milestone."),
    ai: pagePlaceholder("AI Studio", "Create, explore, and experiment.", "AI Studio access and tier requirements will be added later."),
    profile: pagePlaceholder("Your Profile", "Your TM identity starts here.", "Profile setup and account settings are coming soon.")
  };
  return pages[activePage] || pages.home;
}

function pagePlaceholder(title, subtitle, note) {
  return `
    <p class="eyebrow">TM APP</p>
    <h1>${title}</h1>
    <p class="lead">${subtitle}</p>
    <div class="placeholder-panel"><div class="placeholder-icon">✦</div><h2>Coming up next</h2><p>${note}</p><button class="primary-button" data-page="home">Back to Home</button></div>
  `;
}

render();

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.error));
}
