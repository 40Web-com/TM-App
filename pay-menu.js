(() => {
  const walletIcon = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M16 14h2"/></svg>';
  const installPayMenuItem = () => {
    const nav = document.querySelector('.right-menu nav');
    if (!nav) return;
    const items = [
      {attr:'data-zap-menu',href:'./free-fire-zap.html',label:'Free Fire Zap',icon:'🔥'},
      {attr:'data-pay-menu',href:'./aliyankee-pay.html?v=7',label:'Aliyankee Pay',icon:walletIcon}
    ];
    items.forEach(item => {
      if (nav.querySelector('['+item.attr+']')) return;
      const link = document.createElement('a');
      link.className = 'nav-item';
      link.href = item.href;
      link.setAttribute(item.attr, '');
      link.innerHTML = (item.icon === walletIcon ? walletIcon : '<span style="font-size:20px;width:24px;text-align:center">'+item.icon+'</span>') + '<span>'+item.label+'</span>';
      link.style.textDecoration = 'none';
      link.style.color = 'inherit';
      nav.appendChild(link);
    });
  };
  const start = () => {
    installPayMenuItem();
    const app = document.getElementById('app');
    if (app) new MutationObserver(installPayMenuItem).observe(app, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();