
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

// Tag button (mobile-only): redirect to store (productos.html)
const tagBtns = document.querySelectorAll('.tag-btn');
if (tagBtns && tagBtns.length){
  tagBtns.forEach(btn => btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    // On mobile we want to send users to the store
    window.location.href = 'productos.html';
  }));
}

// Close button inside mobile menu (drawer)
const menuCloseBtns = document.querySelectorAll('.menu-close');
if (menuCloseBtns && menuCloseBtns.length){
  menuCloseBtns.forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); closeMenu(); }));
}

// Make badges optionally interactive (e.g., 'Ofertas' -> productos.html?tag=ofertas)
const menuBadges = document.querySelectorAll('.menu-top-badges .badge');
if (menuBadges && menuBadges.length){
  menuBadges.forEach(b => b.addEventListener('click', (ev) => {
    const txt = (b.textContent || '').trim().toLowerCase();
    // simple mapping: send to productos with a query for the badge text
    const q = encodeURIComponent(txt.replace(/[^a-z0-9]+/g,'-'));
    window.location.href = `productos.html?tag=${q}`;
  }));
}


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

    // Mobile search input/button (header) -> reuse drawer logic
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');
    const mobileSearchInput = document.getElementById('mobileSearchInput');
    if (mobileSearchBtn && mobileSearchInput){
      mobileSearchBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const q = (mobileSearchInput.value || '').trim();
        if (searchInput) searchInput.value = q; // copy to drawer input
        openDrawer();
        if (q) performSearch(q);
      });

      mobileSearchInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter'){ ev.preventDefault(); mobileSearchBtn.click(); }
      });
    }

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
      
     
      CartUI.checkoutBtn = document.getElementById('checkoutBtn');

      if (CartUI.checkoutBtn) {
          CartUI.checkoutBtn.addEventListener('click', (e) => {
              e.preventDefault();
              if (API.items.length > 0) {
                  // Esto es lo que hace que el botón funcione
                  window.location.href = 'pago.html'; 
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
        // Busca esta parte dentro de API.open() en main.js
        mini.innerHTML = `
          <div class="mini-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
            <strong>Carrito</strong>
            <button class="close-mini" aria-label="Cerrar" style="border:none; background:none; font-size:20px; cursor:pointer;">×</button>
          </div>
          <div class="mini-body" style="max-height:300px; overflow-y:auto;"></div>
          
          <div class="mini-footer" style="padding:15px; border-top:1px solid #eee; background:#fff;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <strong>Total:</strong>
              <strong>$${API.total().toLocaleString()}</strong>
            </div>
            <button id="btnPagarMini" style="width:100%; background:#13d6eba2; color:white; border:none; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:16px;">
              PAGAR AHORA
            </button>
          </div>
        `;

        // Justo debajo de donde pones el innerHTML, añade la función del botón:
        setTimeout(() => {
          const btnPagar = document.getElementById('btnPagarMini');
          if (btnPagar) {
            btnPagar.onclick = () => {
              window.location.href = 'pago.html';
            };
          }
        }, 50);
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

      // 1. Mostrar siempre el footer para asegurar que el botón exista
      if (CartUI.cartFooter) {
          CartUI.cartFooter.style.setProperty('display', 'block', 'important'); 
      }

      // 2. Actualizar el texto del total
      if (CartUI.cartTotal) {
          CartUI.cartTotal.textContent = `$${API.total().toLocaleString()}`;
      }
      
      // 3. Controlar solo el mensaje de "Carrito Vacío"
      if (API.items.length === 0) {
          if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = 'block';
          // Quitamos la línea que ponía el footer en 'none'
      } else {
          if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = 'none';
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

/**
 * ARCHIVO UNIFICADO: main.js
 * Sistema de Tienda Educativa Math Minds
 */

// 1. VARIABLE GLOBAL ÚNICA
let baseDeDatos = [];

// 2. CARGA DE DATOS DESDE GOOGLE SHEETS
async function inicializarTienda() {
    const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR8rDwu04L8NMJb85GCX4Hk3ojROvNgGT-ZktglPnC4QGG4iCVLCKKGLT9xB0HtnLOQKlpQSPJ5vTu9/pub?output=csv";
    
    try {
        console.log("Iniciando carga de datos...");
        const respuesta = await fetch(URL_CSV);
        const datos = await respuesta.text();
        
        // Separar por filas y eliminar las vacías
        const filas = datos.split(/\r?\n/).filter(linea => linea.trim() !== "");
        
        // Mapeo de columnas: 0:Colegio, 1:Grado, 2:Producto, 3:Costo
        baseDeDatos = filas.slice(1).map(fila => {
            const c = fila.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
            return {
                colegio: c[0]?.replace(/"/g, '').trim(),
                grado: c[1]?.replace(/"/g, '').trim(),
                producto: c[2]?.replace(/"/g, '').trim(),
                costo: parseInt(c[3]?.replace(/[^0-9]/g, "")) || 0
            };
        }).filter(p => p.colegio && p.grado);

        console.log("Carga completa. Registros:", baseDeDatos.length);
        poblarColegios();
    } catch (e) {
        console.error("Error cargando base de datos:", e);
    }
}

// 3. LLENAR SELECTOR DE COLEGIOS
function poblarColegios() {
    const selectCol = document.getElementById('selectColegio');
    if (!selectCol) return;

    // Obtener nombres únicos de colegios y ordenar
    const colegiosUnicos = [...new Set(baseDeDatos.map(p => p.colegio))].sort();
    
    selectCol.innerHTML = '<option value="">Seleccione un colegio...</option>';
    colegiosUnicos.forEach(col => {
        let opt = new Option(col, col);
        selectCol.add(opt);
    });
}

// 4. ESCUCHAR CAMBIOS EN LOS FILTROS
document.addEventListener('change', (e) => {
    // Si cambia el Colegio -> Cargar sus Grados
    if (e.target.id === 'selectColegio') {
        const colSeleccionado = e.target.value;
        const selectGra = document.getElementById('selectGrado');
        const contenedor = document.getElementById('contenedorProductos');
        
        if (!selectGra) return;

        selectGra.innerHTML = '<option value="">Seleccione un grado...</option>';
        if (contenedor) contenedor.innerHTML = '<p>Ahora selecciona tu grado para ver los materiales.</p>';

        if (colSeleccionado) {
            // Filtrar todos los grados que pertenecen a este colegio
            const gradosDelColegio = baseDeDatos
                .filter(p => p.colegio === colSeleccionado)
                .map(p => p.grado);

            // Quitar duplicados y ordenar
            const gradosUnicos = [...new Set(gradosDelColegio)].sort();

            gradosUnicos.forEach(g => selectGra.add(new Option(g, g)));
            selectGra.disabled = false;
        } else {
            selectGra.disabled = true;
        }
    }

    // Si cambia el Grado -> Mostrar Productos
    if (e.target.id === 'selectGrado') {
        const col = document.getElementById('selectColegio').value;
        const gra = e.target.value;
        if (col && gra) {
            renderizarProductos(col, gra);
        }
    }
});

// 5. MOSTRAR PRODUCTOS EN PANTALLA
function renderizarProductos(col, gra) {
    const contenedor = document.getElementById('contenedorProductos');
    if (!contenedor) return;

    const filtrados = baseDeDatos.filter(p => p.colegio === col && p.grado === gra);
    contenedor.innerHTML = ""; 

    if (filtrados.length === 0) {
        contenedor.innerHTML = "<p>No hay productos disponibles para esta selección.</p>";
        return;
    }

    filtrados.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card-producto';

        const info = document.createElement('div');
        info.className = 'producto-info';

        const img = document.createElement('img');
        img.src = '../Multimedia/Logotipo_MathMinds.png';
        img.width = 50;
        img.style.marginBottom = '10px';

        const title = document.createElement('h3');
        title.textContent = p.producto;

        const meta = document.createElement('p');
        meta.style.fontSize = '12px';
        meta.style.color = '#777';
        meta.textContent = `${p.colegio} - ${p.grado}`;

        const price = document.createElement('p');
        price.className = 'precio';
        price.textContent = `$${p.costo.toLocaleString()}`;

        const btn = document.createElement('button');
        btn.className = 'btn primary full add-to-cart-btn';
        btn.type = 'button';
        btn.textContent = 'Añadir al carrito';
        // data attributes for delegation/debug
        btn.dataset.product = p.producto;
        btn.dataset.price = p.costo;
        btn.addEventListener('click', () => {
          agregarAlCarrito(p.producto, p.costo);
        });

        info.appendChild(img);
        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(price);
        info.appendChild(btn);
        card.appendChild(info);

        contenedor.appendChild(card);
    });
}

// (Removed duplicate carritoTienda implementation) -- cart actions are unified below.

// 6. MANEJO DEL FORMULARIO DE PAGO (Si existe en la página)
document.addEventListener('submit', (e) => {
    if (e.target.id === 'payForm') {
        e.preventDefault();
        const carrito = JSON.parse(localStorage.getItem('mm_cart_v1')) || [];
        
        if (carrito.length === 0) {
            alert("Tu carrito está vacío.");
            return;
        }

        const datosEntrega = {
            acudiente: document.getElementById('parentName')?.value,
            documento: document.getElementById('documentId')?.value,
            colegio: document.getElementById('college')?.value,
            ciudad: document.getElementById('city')?.value,
            direccion: document.getElementById('address')?.value,
            telefono: document.getElementById('phone')?.value
        };
        
        localStorage.setItem('datos_entrega', JSON.stringify(datosEntrega));
        window.open('finalizar_pago.html', '_blank');
    }
});

// 7. INICIAR CUANDO EL DOCUMENTO ESTÉ LISTO
document.addEventListener('DOMContentLoaded', inicializarTienda);

document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('mobile-menu');
    const navList = document.getElementById('nav-list');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navList.classList.toggle('active');
            // Cambia el icono de barras a una X
            const icon = menuToggle.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
        });
    }
});
document.getElementById('mobile-menu-btn').addEventListener('click', function() {
    document.getElementById('menu').classList.toggle('open');
});

// (Removed duplicate implementations — using unified cart below.)

// Variable única para tu pedido (var to avoid TDZ when functions run early)
var pedidoMathMinds = JSON.parse(localStorage.getItem('mm_pedido')) || [];

// Unified add-to-cart function used by product buttons
function agregarAlCarrito(nombre, precioRaw) {
    console.log('agregarAlCarrito called with', nombre, precioRaw);
    // Normalize price (accept numbers or formatted strings)
    const precioNum = Number(String(precioRaw).replace(/[^0-9.-]+/g, '')) || 0;

    const producto = {
        id: Date.now().toString(),
        nombre: String(nombre),
        precio: precioNum
    };

    // Ensure in-memory array exists and load fresh state
    pedidoMathMinds = JSON.parse(localStorage.getItem('mm_pedido')) || [];
    pedidoMathMinds.push(producto);
    try{
      localStorage.setItem('mm_pedido', JSON.stringify(pedidoMathMinds));
      console.log('Saved mm_pedido len:', pedidoMathMinds.length);
    }catch(e){
      console.error('Failed to save mm_pedido:', e);
      showInlineToast('No se pudo guardar el carrito en el navegador. Revisa permisos o espacio.');
    }

    // If the Cart API is present, add to it too so the drawer stays in sync
    try{
      if (window.Cart && typeof window.Cart.addItem === 'function'){
        window.Cart.addItem({ id: producto.id, title: producto.nombre, price: producto.precio, image: '' });
      }
    }catch(e){ console.error('Cart.addItem error', e); }

    // Update visual counters
    actualizarContadores();

    // Minimal visible feedback: inline toast
    showInlineToast(`✅ ${producto.nombre} añadido al carrito.`);
}

// Small inline toast helper (lightweight, no dependency)
function showInlineToast(message, timeout = 1400){
  try{
    let el = document.createElement('div');
    el.className = 'mm-inline-toast';
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '86px',
      right: '18px',
      background: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '10px 14px',
      borderRadius: '8px',
      zIndex: 200000,
      opacity: '0',
      transform: 'translateY(6px)'
    });
    document.body.appendChild(el);
    // allow CSS transition
    requestAnimationFrame(()=>{ el.style.transition = 'opacity 240ms ease, transform 240ms ease'; el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform = 'translateY(8px)'; setTimeout(()=> el.remove(), 260); }, timeout);
  }catch(e){ /* ignore */ }
}

// Centralized counter update
function actualizarContadores() {
    const pedido = JSON.parse(localStorage.getItem('mm_pedido')) || [];
    const cantidad = pedido.length;

    const cMenu = document.getElementById('cartCount');
    if (cMenu) {
      cMenu.innerText = cantidad;
      // bump animation
      try{
        cMenu.classList.remove('badge-bump');
        // forced reflow to restart animation
        void cMenu.offsetWidth;
        cMenu.classList.add('badge-bump');
      }catch(e){}
    }

    // also update Cart UI if present
    try{
      if (window.Cart && typeof window.Cart.render === 'function'){
        window.Cart.render();
      }
    }catch(e){}

    console.log('Total en carrito:', cantidad);
}

// Delegate click handler for add-to-cart buttons (robust for dynamically created content)
document.addEventListener('click', (e) => {
  const btn = e.target && e.target.closest && e.target.closest('.add-to-cart-btn');
  if (!btn) return;
  const prod = btn.dataset.product || btn.getAttribute('data-product') || null;
  const price = btn.dataset.price || btn.getAttribute('data-price') || null;
  if (prod) agregarAlCarrito(prod, price);
});

// Ensure counters are set on load
window.addEventListener('load', actualizarContadores);

// Expose quick test to console
window.testAddToCart = function(){ agregarAlCarrito('Producto prueba', 100); }; 

// Debug panel (cerrable) to inspect mm_pedido and add test items
function renderDebugPanel(){
  if (document.getElementById('mm-debug-panel')) return;
  const panel = document.createElement('div');
  panel.id = 'mm-debug-panel';
  Object.assign(panel.style,{ position:'fixed', right:'14px', bottom:'14px', width:'220px', background:'#fff', border:'1px solid rgba(0,0,0,0.08)', padding:'8px', borderRadius:'10px', boxShadow:'0 6px 18px rgba(0,0,0,0.06)', zIndex:200001, fontSize:'13px'});
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong style="font-size:13px;">Debug carrito</strong>
      <button id="mm-debug-close" style="border:none;background:transparent;cursor:pointer;font-size:16px;">×</button>
    </div>
    <div id="mm-debug-count" style="opacity:.9;margin-bottom:8px;">Cargando...</div>
    <div style="display:flex;gap:6px;">
      <button id="mm-debug-add" style="flex:1;padding:6px;border-radius:8px;border:1px solid var(--black);background:#f6f6f6;">Añadir test</button>
      <button id="mm-debug-show" style="padding:6px;border-radius:8px;border:1px solid var(--black);background:#fff;">Mostrar</button>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById('mm-debug-close').addEventListener('click', ()=> panel.remove());
  document.getElementById('mm-debug-add').addEventListener('click', ()=> { agregarAlCarrito('Producto test', 149); updateDebugPanel(); });
  document.getElementById('mm-debug-show').addEventListener('click', ()=> { 
    const arr = JSON.parse(localStorage.getItem('mm_pedido'))||[];
    alert('mm_pedido:\n' + JSON.stringify(arr, null, 2));
  });

  updateDebugPanel();
}

function updateDebugPanel(){
  const el = document.getElementById('mm-debug-count');
  if (!el) return;
  const arr = JSON.parse(localStorage.getItem('mm_pedido'))||[];
  el.textContent = `Items: ${arr.length}`;
}

// Keep panel in sync when counters update
const origActualizar = actualizarContadores;
actualizarContadores = function(){ origActualizar(); updateDebugPanel(); };

// Auto-render debug panel (remove or gate this if you don't want visible panel)
if (typeof document !== 'undefined'){
  document.addEventListener('DOMContentLoaded', () => { renderDebugPanel(); });
}