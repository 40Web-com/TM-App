(() => {
  const walletIcon = '<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 8h18M16 14h2"/></svg>';
  const installPayMenuItem = () => {
    const nav = document.querySelector('.right-menu nav');
    if (!nav) return;
    const items = [
      {attr:'data-zap-menu',href:'#freefirezap',label:'Free Fire Zap',icon:'🔥',page:'freefirezap'},
      {attr:'data-pay-menu',href:'#aliyankeyepay',label:'Aliyankee Pay',icon:walletIcon,page:'aliyankeyepay'}
    ];
    items.forEach(item => {
      if (nav.querySelector('['+item.attr+']')) return;
      const link = document.createElement('button');
      link.className = 'nav-item';
      link.type = 'button';
      link.setAttribute(item.attr, '');
      link.innerHTML = (item.icon === walletIcon ? walletIcon : '<span style="font-size:20px;width:24px;text-align:center">'+item.icon+'</span>') + '<span>'+item.label+'</span>';
      link.addEventListener('click',()=>{if(window.__tmNavigate)window.__tmNavigate(item.page);});
      link.style.textAlign = 'left';
      link.style.background = 'transparent';
      link.style.border = '0';
      link.style.width = '100%';
      link.style.cursor = 'pointer';
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