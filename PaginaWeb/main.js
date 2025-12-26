// ===============================
// BURGER MENU
// ===============================
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");

burger?.addEventListener("click", () => {
  // Toggle 'open' class so CSS controls visibility and layout
  if (!menu) return;
  const isOpen = menu.classList.toggle('open');
  burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
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

  function openModal(modalId){
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal){
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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

  window.addEventListener("scroll", () => {
    const sectionTop = section.getBoundingClientRect().top;
    const windowHeight = window.innerHeight;

    if (!started && sectionTop < windowHeight * 0.85) {
      startCounter();
      started = true;
    }
  });
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
      if (CartUI.checkoutBtn) CartUI.checkoutBtn.addEventListener('click', ()=> { alert('Funcionalidad de pago no implementada en este prototipo.'); });

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
      // Update counts/summary even if the full drawer is not present on this page
      const count = API.count();
      const countSpan = CartUI.cartCountSpan; if (countSpan) countSpan.textContent = count;
      const itemsCountEl = CartUI.cartItemsCount; if (itemsCountEl) itemsCountEl.textContent = `(${count} productos)`;
      const totalEl = CartUI.cartTotal; if (totalEl) totalEl.textContent = ` `; // prices hidden for now

      if (!CartUI.cartList) return; // no drawer on this page, nothing more to render

      const list = CartUI.cartList; list.innerHTML = '';
      if (API.items.length === 0){
        if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = '';
        if (CartUI.cartFooter) CartUI.cartFooter.style.display = 'none';
      } else {
        if (CartUI.cartEmpty) CartUI.cartEmpty.style.display = 'none';
        if (CartUI.cartFooter) CartUI.cartFooter.style.display = '';
      }

      API.items.forEach(it => {
        const li = document.createElement('li');
        li.innerHTML = `
          <img src="${it.image}" alt="${it.title}" />
          <div style="flex:1;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <strong style="font-size:15px;">${it.title}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <div class="cart-qty">
                <button data-dec="${it.id}" aria-label="Disminuir">−</button>
                <span style="min-width:26px;text-align:center">${it.qty}</span>
                <button data-inc="${it.id}" aria-label="Aumentar">+</button>
              </div>
              <button data-remove="${it.id}" class="btn secondary">Eliminar</button>
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
