// ===============================
// BURGER MENU
// ===============================
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");

// Helper to open/close mobile menu with overlay
function openMenu(){
  if (!menu || !burger) return;

  // remember original place so we can restore later
  if (!menu._originalParent){
    menu._originalParent = menu.parentNode;
    menu._nextSibling = menu.nextSibling;
  }

  // ensure the menu is a direct child of body while open so it isn't blocked by overlays
  if (menu.parentNode !== document.body){
    document.body.appendChild(menu);
  }

  menu.classList.add('open');
  menu.setAttribute('aria-hidden','false');
  burger.setAttribute('aria-expanded','true');

  // create overlay
  let ov = document.getElementById('menuOverlay');
  if (!ov){
    ov = document.createElement('div');
    ov.id = 'menuOverlay';
    ov.className = 'menu-overlay active'; // show only when present
    // insert the overlay after the header so it sits behind the panel
    const headerEl = document.querySelector('.header');
    if (headerEl && headerEl.parentNode) document.body.insertBefore(ov, headerEl.nextSibling);
    else document.body.appendChild(ov);
    ov.style.zIndex = '100040'; // explicit to avoid CSS override
  } else {
    // if it already exists, ensure it's visible and beneath the menu
    ov.classList.add('active');
    ov.style.zIndex = '100040';
  }

  // esc close
  const escClose = (ev) => { if (ev.key === 'Escape') closeMenu(); };
  document.addEventListener('keydown', escClose);
  // store handler reference for removal
  menu._escClose = escClose;

  ov.addEventListener('click', closeMenu, { once:true });

  // Use native scrolling for the menu panel (more reliable across devices).
  // Remove any custom pointer/touch handlers that interfere with native scrolling.
  if (menu._touchStartHandler){
    try{
      menu.removeEventListener('touchstart', menu._touchStartHandler, { passive:false });
      menu.removeEventListener('touchmove', menu._touchMoveHandler, { passive:false });
    }catch(e){}
    delete menu._touchStartHandler; delete menu._touchMoveHandler;
  }
  if (menu._pointerDownHandler){
    try{
      menu.removeEventListener('pointerdown', menu._pointerDownHandler, { passive:false });
      menu.removeEventListener('pointermove', menu._pointerMoveHandler, { passive:false });
      menu.removeEventListener('pointerup', menu._pointerUpHandler, { passive:false });
      menu.removeEventListener('pointercancel', menu._pointerUpHandler, { passive:false });
    }catch(e){}
    delete menu._pointerDownHandler; delete menu._pointerMoveHandler; delete menu._pointerUpHandler; delete menu._isPointerDown;
  }

  // Add a grab handle so users see they can scroll the panel
  if (!menu.querySelector('.menu-grab')){
    const grab = document.createElement('div');
    grab.className = 'menu-grab';
    menu.insertBefore(grab, menu.firstChild);
  }
}

function closeMenu(){
  if (!menu || !burger) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden','true');
  burger.setAttribute('aria-expanded','false');
  const ov = document.getElementById('menuOverlay'); if (ov) ov.remove();
  if (menu._escClose) { document.removeEventListener('keydown', menu._escClose); delete menu._escClose; }

  // remove touch handlers if present
  if (menu._touchStartHandler){
    menu.removeEventListener('touchstart', menu._touchStartHandler, { passive:false });
    menu.removeEventListener('touchmove', menu._touchMoveHandler, { passive:false });
    delete menu._touchStartHandler;
    delete menu._touchMoveHandler;
  }

  // remove pointer handlers if present
  if (menu._pointerDownHandler){
    menu.removeEventListener('pointerdown', menu._pointerDownHandler, { passive:false });
    menu.removeEventListener('pointermove', menu._pointerMoveHandler, { passive:false });
    menu.removeEventListener('pointerup', menu._pointerUpHandler, { passive:false });
    menu.removeEventListener('pointercancel', menu._pointerUpHandler, { passive:false });
    delete menu._pointerDownHandler;
    delete menu._pointerMoveHandler;
    delete menu._pointerUpHandler;
    delete menu._isPointerDown;
  }

  // remove grab handle if present
  const grabEl = menu.querySelector('.menu-grab'); if (grabEl) grabEl.remove();

  // restore menu to its original parent location (if we moved it)
  if (menu._originalParent && menu.parentNode !== menu._originalParent){
    try{
      if (menu._nextSibling && menu._originalParent.contains(menu._nextSibling)){
        menu._originalParent.insertBefore(menu, menu._nextSibling);
      } else {
        menu._originalParent.appendChild(menu);
      }
    }catch(e){ /* ignore if DOM changed */ }
  }
}

burger?.addEventListener("click", () => {
  if (!menu) return;
  const isOpen = menu.classList.contains('open');
  if (isOpen) closeMenu(); else openMenu();
});

// Close menu when resizing to larger screens
window.addEventListener('resize', () => {
  if (!menu) return;
  if (window.innerWidth > 1024 && menu.classList.contains('open')){
    closeMenu();
  }
});

// Close menu when clicking any link inside it (works for navigation and modal triggers)
document.addEventListener('click', (e) => {
  const link = e.target && e.target.closest && e.target.closest('.menu a');
  if (!link) return;
  // If a menu link is clicked and menu is open on small screens, close it after a short delay
  if (menu && menu.classList.contains('open')){
    // If the clicked link opens a modal or uses data-open, wait a bit longer
    // so the modal's click handler runs first and can open properly on mobile.
    const opensModal = link.hasAttribute('data-modal') || link.hasAttribute('data-open');
    const delay = opensModal ? 220 : 50;
    setTimeout(() => { closeMenu(); }, delay);
  }
});


// ===============================
// CAROUSEL Y CONTROLES
// ===============================
(() => {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  const track = carousel.querySelector(".carousel-track");
  if (!track) return;


  const slides = [...track.querySelectorAll(".slide")];

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("carouselDots");

  let index = slides.findIndex(s => s.classList.contains("is-active"));
  if (index < 0) index = 0;

  const INTERVAL = 6000;
  let timer;

  
  const dots = (dotsWrap ? slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot" + (i === index ? " is-active" : "");
    dot.addEventListener("click", () => {
      goTo(i);
      restart();
    });
    dotsWrap.appendChild(dot);
    return dot;
  }) : []);

  function setActive(i){
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === i));
    dots.forEach((d, idx) => d.classList.toggle("is-active", idx === i));
  }

  function goTo(i){
    index = (i + slides.length) % slides.length;
    setActive(index);
  }

  function next(){ goTo(index + 1); }
  function prev(){ goTo(index - 1); }

  function start(){
    stop();
    timer = setInterval(next, INTERVAL);
  }

  function stop(){
    if (timer) clearInterval(timer);
  }

  function restart(){
    start();
  }

  nextBtn?.addEventListener("click", () => {
    next();
    restart();
  });

  prevBtn?.addEventListener("click", () => {
    prev();
    restart();
  });

  // Pausar al pasar el mouse
  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);

  // Swipe móvil
  let startX = 0;
  carousel.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  }, { passive:true });

  carousel.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40){
      dx < 0 ? next() : prev();
      restart();
    }
  });

  setActive(index);
  start();
})();


// ===============================
// MODALES (MENÚ + BOTONES CARRUSEL)
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  const triggers = document.querySelectorAll("[data-modal]");
  const overlays = document.querySelectorAll(".modal-overlay");
  const closeButtons = document.querySelectorAll(".modal-close");

  let _mm_scrollY = 0;
  function lockBodyScroll(){
    _mm_scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${_mm_scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }
  function unlockBodyScroll(){
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, _mm_scrollY || 0);
    _mm_scrollY = 0;
  }

  function openModal(modalId){
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    lockBodyScroll();
  }

  function closeModal(modal){
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    unlockBodyScroll();
  }

  // ABRIR
  triggers.forEach(trigger => {
    trigger.addEventListener("click", e => {
      e.preventDefault();
      const modalId = trigger.getAttribute("data-modal");
      openModal(modalId);
    });
  });

  // CERRAR CON BOTÓN X
  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-overlay");
      if (modal) closeModal(modal);
    });
  });

  // CERRAR CLICK FUERA
  overlays.forEach(overlay => {
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeModal(overlay);
    });
  });

  // CERRAR CON ESC
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.active").forEach(closeModal);
      // cerrar panel de búsqueda si está abierto
      const sp = document.getElementById('searchPanel');
      if (sp && sp.classList.contains('active')){
        sp.classList.remove('active');
        sp.setAttribute('aria-hidden','true');
      }
    }
  });

  // Abrir modal desde cualquier elemento con data-open (delegación para mayor fiabilidad)
  document.addEventListener('click', (e) => {
    const opener = e.target && e.target.closest && e.target.closest('[data-open]');
    if (!opener) return;
    e.preventDefault();
    const dest = opener.getAttribute('data-open');
    if (!dest) return;
    // cerrar modal(s) activos
    document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
    setTimeout(() => { openModal(dest); }, 120);
  });

  // BÚSQUEDA: drawer lateral con historial
  const searchToggle = document.getElementById('searchToggle');
  const searchDrawer = document.getElementById('searchDrawer');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchClose = document.getElementById('searchClose');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const searchInput = document.getElementById('searchInput');
  const searchSubmit = document.getElementById('searchSubmit');
  const historyList = document.getElementById('searchHistory');

  const HISTORY_KEY = 'mm_search_history_v1';
  const HISTORY_MAX = 8;

  // Products dataset will be loaded from products.json
  let PRODUCTS = [];

  function loadHistory(){
    try{
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }

  function saveHistory(arr){
    try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }catch(e){}
  }

  function renderHistory(){
    const items = loadHistory();
    historyList.innerHTML = '';
    if (items.length === 0){
      historyList.innerHTML = '<li style="opacity:.8">(Sin búsquedas todavía)</li>';
      return;
    }

    items.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      li.addEventListener('click', () => performSearch(q));
      historyList.appendChild(li);
    });
  }

  // Cargar productos desde JSON
  async function loadProducts(){
    try{
      const res = await fetch('products.json');
      PRODUCTS = await res.json();
    }catch(e){ PRODUCTS = []; }
  }

  function filterProducts(query){
    if (!query) return [];
    const q = query.toLowerCase();
    return PRODUCTS.filter(p => (
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    ));
  }

  function renderResults(items){
    const wrap = document.getElementById('searchResults');
    const noEl = document.getElementById('noResults');
    wrap.innerHTML = '';
    if (!items || items.length === 0){
      noEl.style.display = 'block';
      return;
    }
    noEl.style.display = 'none';

    items.slice(0,8).forEach(p => {
      const li = document.createElement('li');
      li.tabIndex = 0;
      li.innerHTML = `
        <img src="${p.image}" alt="${p.title}" />
        <div class="meta">
          <b>${p.title}</b>
          <small style="opacity:.8">${p.description}</small>
        </div>
      `;
      li.addEventListener('click', () => { window.location.href = p.link; });
      li.addEventListener('keydown', e => { if (e.key === 'Enter') window.location.href = p.link; });
      wrap.appendChild(li);
    });
  }

  function addToHistory(q){
    if (!q) return;
    const items = loadHistory().filter(x => x !== q);
    items.unshift(q);
    if (items.length > HISTORY_MAX) items.length = HISTORY_MAX;
    saveHistory(items);
    renderHistory();
  }

  function clearHistory(){
    saveHistory([]);
    renderHistory();
  }

  function openDrawer(){
    if (!searchDrawer) return;
    searchDrawer.setAttribute('aria-hidden','false');
    searchOverlay.classList.add('active');
    searchOverlay.setAttribute('aria-hidden','false');
    // esconder el botón de búsqueda para que no interfiera
    if (searchToggle) searchToggle.style.display = 'none';
    searchInput?.focus();
    renderHistory();
  }

  function closeDrawer(){
    if (!searchDrawer) return;
    searchDrawer.setAttribute('aria-hidden','true');
    searchOverlay.classList.remove('active');
    searchOverlay.setAttribute('aria-hidden','true');
    // restaurar el botón
    if (searchToggle) searchToggle.style.display = '';
  }

  function performSearch(q){
    const query = (q || searchInput?.value||'').trim();
    if (!query) return;
    addToHistory(query);

    // Filtrar productos y mostrar resultados en el drawer
    const results = filterProducts(query);
    renderResults(results);

    // Mantener botón "Ver tienda" con la query
    const viewAllBtn = document.getElementById('viewAllBtn');
    if (viewAllBtn) viewAllBtn.href = `productos.html?q=${encodeURIComponent(query)}`;
  }

  if (searchToggle && searchDrawer && searchOverlay){
    // cargar productos al inicio
    loadProducts().then(() => {
      renderHistory();
    });

    searchToggle.addEventListener('click', (ev) => { ev.preventDefault(); openDrawer(); });
    searchClose?.addEventListener('click', closeDrawer);
    searchOverlay.addEventListener('click', closeDrawer);

    searchSubmit?.addEventListener('click', () => performSearch());

    searchInput?.addEventListener('input', () => {
      // mostrar resultados en tiempo real mientras escribe
      const q = (searchInput.value || '').trim();
      if (q.length === 0){ renderResults([]); return; }
      const results = filterProducts(q);
      renderResults(results);
    });

    searchInput?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') performSearch();
    });

    clearHistoryBtn?.addEventListener('click', () => {
      clearHistory();
      searchInput?.focus();
      renderResults([]);
    });

    // cerrar con ESC también
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeDrawer();
    });

    renderHistory();
  }

});

document.addEventListener("DOMContentLoaded", () => {
  const counters = document.querySelectorAll(".contador");
  const section = document.querySelector(".contador-section");
  let started = false;

  if (!section || counters.length === 0) return;

  const startCounter = () => {
    counters.forEach(counter => {
      const target = Number(counter.dataset.target);
      let current = 0;

      // Velocidad del "reloj" (ms)
      const intervalTime = 50; // ⏱️ más alto = más lento
      const step = Math.ceil(target / 100); // pasos constantes

      const timer = setInterval(() => {
        current += step;

        if (current >= target) {
          counter.textContent = target;
          clearInterval(timer);
        } else {
          counter.textContent = current;
        }
      }, intervalTime);
    });
  };

  // Use IntersectionObserver for reliable visibility detection (better on mobile)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !started) {
          startCounter();
          started = true;
          obs.disconnect();
        }
      });
    }, { threshold: 0.45 });
    observer.observe(section);
  } else {
    // Fallback for older browsers: keep scroll listener
    const onScroll = () => {
      const sectionTop = section.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;
      if (!started && sectionTop < windowHeight * 0.85) {
        startCounter();
        started = true;
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll);
    // check immediately in case the section is already visible
    onScroll();
  }
});

/* =========================
   SHOPPING CART
========================= */
(function(){
  const STORAGE_KEY = 'mm_cart_v1';

  function loadCart(){
    try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }catch(e){ return []; }
  }
  function saveCart(items){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }catch(e){} }

  const CartUI = {
    cartOverlay: document.getElementById('cartOverlay'),
    cartDrawer: document.getElementById('cartDrawer'),
    cartList: document.getElementById('cartList'),
    cartEmpty: document.getElementById('cartEmpty'),
    cartTotal: document.getElementById('cartTotal'),
    cartCountSpan: document.getElementById('cartCount'),
    cartItemsCount: document.getElementById('cartItemsCount'),
    cartFooter: document.getElementById('cartFooter'),
    clearBtn: null,
    checkoutBtn: null
  };

  const API = {
    items: loadCart(),

    init(){
      // attach UI controls
      const toggle = document.getElementById('cartToggle');
      const closeBtn = document.getElementById('cartClose');
      const overlay = CartUI.cartOverlay;

      if (toggle) toggle.addEventListener('click', (e)=>{ e.preventDefault(); API.open(); });
      if (closeBtn) closeBtn.addEventListener('click', ()=> API.close());
      if (overlay) overlay.addEventListener('click', ()=> API.close());

      CartUI.clearBtn = document.getElementById('clearCartBtn');
      CartUI.checkoutBtn = document.getElementById('checkoutBtn');
      
      if (CartUI.clearBtn) CartUI.clearBtn.addEventListener('click', ()=> { API.items = []; API.save(); API.render(); });
      
      // MODIFICACIÓN AQUÍ: Redirección a la página de pagos
     // Busca esto dentro de API.init()
      // Busca esto dentro de API.init()
      CartUI.checkoutBtn = document.getElementById('checkoutBtn');

      if (CartUI.checkoutBtn) {
          CartUI.checkoutBtn.addEventListener('click', (e) => {
              e.preventDefault();
              if (API.items.length > 0) {
                  // Esto es lo que hace que el botón funcione
                  window.location.href = 'finalizar_pago.html'; 
              } else {
                  API.showEmptyNotice('El carrito está vacío');
              }
          });
      }

      // buttons inside cart (delegation)
      document.addEventListener('click', (e) => {
        const inc = e.target && e.target.closest && e.target.closest('[data-inc]');
        if (inc){
          const id = inc.getAttribute('data-inc'); API.changeQty(id, 1); return;
        }
        const dec = e.target && e.target.closest && e.target.closest('[data-dec]');
        if (dec){
          const id = dec.getAttribute('data-dec'); API.changeQty(id, -1); return;
        }
        const rem = e.target && e.target.closest && e.target.closest('[data-remove]');
        if (rem){
          const id = rem.getAttribute('data-remove'); API.remove(id); return;
        }
      });

      API.render();
    },

    save(){ saveCart(API.items); API.render(); },

    addItem(product){
      if (!product || !product.id) return;
      const idx = API.items.findIndex(it => it.id === product.id);
      if (idx >= 0){ API.items[idx].qty += 1; }
      else{ API.items.push({ id: product.id, title: product.title, price: Number(product.price||0), image: product.image, qty: 1 }); }
      API.save();
    },

    remove(id){ API.items = API.items.filter(i => i.id !== id); API.save(); },

    changeQty(id, delta){
      const it = API.items.find(i => i.id === id); if (!it) return;
      it.qty += delta; if (it.qty <= 0) API.remove(id); else API.save();
    },

    count(){ return API.items.reduce((s,i)=> s + i.qty, 0); },

    total(){ return API.items.reduce((s,i)=> s + (i.price||0) * i.qty, 0); },

    showEmptyNotice(message = 'No hay productos en el carrito', timeout = 2500){
      // small dismissible notice near the cart icon
      try{
        let note = document.getElementById('cartEmptyNotice');
        if (!note){
          note = document.createElement('div');
          note.id = 'cartEmptyNotice';
          note.className = 'cart-empty-notice';
          note.setAttribute('role','status');
          note.setAttribute('aria-live','polite');
          note.innerHTML = `<span class="msg">${message}</span><button class="close" aria-label="Cerrar">×</button>`;
          document.body.appendChild(note);

          // dismiss on close or click outside
          note.querySelector('.close').addEventListener('click', () => {
            note.classList.remove('show');
            setTimeout(() => note.remove(), 220);
          });

          // allow ESC to close when visible
          const escHandler = (ev) => { if (ev.key === 'Escape'){ if (note){ note.classList.remove('show'); setTimeout(()=> note.remove(),220); } document.removeEventListener('keydown', escHandler); } };
          document.addEventListener('keydown', escHandler);
        } else {
          note.querySelector('.msg').textContent = message;
        }

        // show and auto-hide
        setTimeout(() => note.classList.add('show'), 10);
        if (timeout > 0){ setTimeout(() => { if (note){ note.classList.remove('show'); setTimeout(()=> note.remove(),220); } }, timeout); }
      }catch(e){ /* ignore */ }
    },

    open(){
      // If cart empty, show a small notice instead of opening the drawer
      if (API.items.length === 0){ API.showEmptyNotice(); return; }

      // If the full drawer exists, open it
      if (CartUI.cartDrawer && CartUI.cartOverlay){
        CartUI.cartDrawer.setAttribute('aria-hidden','false');
        CartUI.cartOverlay.classList.add('active');
        CartUI.cartOverlay.setAttribute('aria-hidden','false');
        return;
      }

      // Fallback for pages that don't include the drawer: show a mini popup with items
      try{
        let mini = document.getElementById('miniCartPopup');
        if (mini) mini.remove();

        mini = document.createElement('div');
        mini.id = 'miniCartPopup';
        mini.className = 'mini-cart-popup';
        mini.setAttribute('role','dialog');
        mini.innerHTML = `<div class="mini-header"><strong>Carrito</strong><button class="close-mini" aria-label="Cerrar">×</button></div><div class="mini-body"></div>`;
        document.body.appendChild(mini);

        const body = mini.querySelector('.mini-body');
        if (!body) return;

        if (API.items.length === 0){ body.innerHTML = '<div style="padding:12px;opacity:.8;text-align:center;">No hay productos en el carrito.</div>'; }
        else{
          const ul = document.createElement('ul');
          API.items.forEach(it => {
            const li = document.createElement('li');
            li.innerHTML = `
              <img class="mini-item-img" src="${it.image}" alt="${it.title}" />
              <div class="mini-item-info">
                <div class="mini-item-title">${it.title}</div>
                <div class="mini-qty"><button data-dec="${it.id}" class="mini-btn">−</button><span style="min-width:30px;text-align:center">${it.qty}</span><button data-inc="${it.id}" class="mini-btn">+</button></div>
              </div>
              <div style="display:flex;gap:6px;align-items:center;"><button data-remove="${it.id}" class="mini-btn">Eliminar</button></div>
            `;
            ul.appendChild(li);
          });
          ul.style.listStyle='none'; ul.style.padding='10px'; ul.style.margin='0'; ul.style.display='flex'; ul.style.flexDirection='column'; ul.style.gap='8px';
          body.appendChild(ul);
        }

        // close handler (button)
        mini.querySelector('.close-mini')?.addEventListener('click', ()=> {
          mini.remove(); const overlayEl = document.getElementById('miniCartOverlay'); if (overlayEl) overlayEl.remove();
        });

        // create overlay so clicking outside closes the mini popup
        let smallOverlay = document.getElementById('miniCartOverlay');
        if (smallOverlay) smallOverlay.remove();
        smallOverlay = document.createElement('div');
        smallOverlay.id = 'miniCartOverlay';
        smallOverlay.className = 'cart-overlay active';
        document.body.appendChild(smallOverlay);
        smallOverlay.addEventListener('click', ()=>{ mini.remove(); smallOverlay.remove(); });

        // close with ESC
        const escMini = (ev)=>{ if (ev.key === 'Escape'){ mini.remove(); smallOverlay.remove(); document.removeEventListener('keydown', escMini); } };
        document.addEventListener('keydown', escMini);

        // delegate inside mini for inc/dec/remove
        mini.addEventListener('click', (e)=>{
          const inc = e.target && e.target.closest && e.target.closest('[data-inc]'); if (inc){ API.changeQty(inc.getAttribute('data-inc'), 1); API.open(); return; }
          const dec = e.target && e.target.closest && e.target.closest('[data-dec]'); if (dec){ API.changeQty(dec.getAttribute('data-dec'), -1); API.open(); return; }
          const rem = e.target && e.target.closest && e.target.closest('[data-remove]'); if (rem){ API.remove(rem.getAttribute('data-remove')); API.open(); return; }
        });

      }catch(e){ API.showEmptyNotice('Carrito (vista rápida)'); }
    },

    close(){
      if (!CartUI.cartDrawer || !CartUI.cartOverlay) return;
      CartUI.cartDrawer.setAttribute('aria-hidden','true');
      CartUI.cartOverlay.classList.remove('active');
      CartUI.cartOverlay.setAttribute('aria-hidden','true');
    },

    render(){
      // 1. Actualizar contadores
      const count = API.count();
      const countSpan = CartUI.cartCountSpan; if (countSpan) countSpan.textContent = count;
      const itemsCountEl = CartUI.cartItemsCount; if (itemsCountEl) itemsCountEl.textContent = `(${count} productos)`;
      
      // Mostrar el total (aunque sea $0 por ahora)
      const totalEl = CartUI.cartTotal; if (totalEl) totalEl.textContent = `$${API.total().toLocaleString()}`; 

      if (!CartUI.cartList) return; 

      // 2. Limpiar lista actual
      const list = CartUI.cartList; 
      list.innerHTML = '';

      // 3. LÓGICA DE VISIBILIDAD: Aquí estaba el error
      if (API.items.length === 0){
        if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = 'block';
        if (CartUI.cartFooter) CartUI.cartFooter.style.display = 'none';
      } else {
        if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = 'none';
        if (CartUI.cartFooter) {
            CartUI.cartFooter.style.setProperty('display', 'block', 'important'); // Forzamos que se vea
        }
      }

      // 4. Dibujar los productos
      API.items.forEach(it => {
        const li = document.createElement('li');
        li.style.borderBottom = "1px solid #eee";
        li.style.paddingBottom = "10px";
        li.innerHTML = `
          <div style="display:flex; gap:10px; align-items:center;">
            <img src="${it.image}" alt="${it.title}" style="width:50px; height:50px; object-fit:contain;" />
            <div style="flex:1;">
              <strong style="font-size:14px; display:block;">${it.title}</strong>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                <div class="cart-qty">
                  <button data-dec="${it.id}" style="cursor:pointer; padding:2px 8px;">−</button>
                  <span style="margin:0 8px;">${it.qty}</span>
                  <button data-inc="${it.id}" style="cursor:pointer; padding:2px 8px;">+</button>
                </div>
                <button data-remove="${it.id}" style="color:red; background:none; border:none; cursor:pointer; font-size:12px;">Eliminar</button>
              </div>
            </div>
          </div>
        `;
        list.appendChild(li);
      });
    }
  };

  // Expose API to global scope so pages can call it
  window.Cart = {
    addItem: (p) => { API.addItem(p); },
    open: () => API.open(),
    close: () => API.close(),
    getItems: () => API.items,
    clear: () => { API.items = []; API.save(); }
  };

  // Init when DOM ready (some elements may be in other pages)
  document.addEventListener('DOMContentLoaded', () => { API.init(); });

})();

// Reemplaza esto con el enlace .csv que copiaste de Google Sheets
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR8rDwu04L8NMJb85GCX4Hk3ojROvNgGT-ZktglPnC4QGG4iCVLCKKGLT9xB0HtnLOQKlpQSPJ5vTu9/pub?output=csv';

let datosColegios = [];

async function cargarDatos() {
    try {
        const response = await fetch(SHEET_URL);
        const data = await response.text();
        
        // Convertir el CSV en un Array de objetos
        const filas = data.split('\n').slice(1); // Omitir encabezado
        datosColegios = filas.map(fila => {
            const [colegio, grado, precio] = fila.split(',');
            return { colegio: colegio.trim(), grado: grado.trim(), precio: precio.trim() };
        });

        actualizarSelectColegios();
    } catch (error) {
        console.error("Error cargando precios:", error);
    }
}

function actualizarSelectColegios() {
    const select = document.getElementById('college');
    // Sacar nombres de colegios únicos
    const nombresUnicos = [...new Set(datosColegios.map(d => d.colegio))];
    
    select.innerHTML = '<option value="" disabled selected>Selecciona colegio</option>';
    nombresUnicos.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        select.appendChild(option);
    });
}

// Llamar a la función al cargar la página
cargarDatos();
document.getElementById('payForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // 1. Validar si el carrito tiene productos
    const carrito = JSON.parse(localStorage.getItem('mm_cart_v1')) || [];
    if (carrito.length === 0) {
        alert("Tu carrito está vacío. Añade productos antes de continuar.");
        window.location.href = 'index.html'; // Lo mandamos a comprar
        return;
    }

    // 2. Guardar datos del Acudiente y Colegio
    const datosEntrega = {
        acudiente: document.getElementById('parentName').value,
        documento: document.getElementById('documentId').value,
        colegio: document.getElementById('college').value, // El colegio se elige aquí
        ciudad: document.getElementById('city').value,
        direccion: document.getElementById('address').value,
        telefono: document.getElementById('phone').value
    };
    
    localStorage.setItem('datos_entrega', JSON.stringify(datosEntrega));

    // 3. Abrir nueva pestaña para datos del estudiante
    window.open('finalizar-estudiante.html', '_blank');
});