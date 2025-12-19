const burger = document.getElementById("burger");
const menu = document.getElementById("menu");

burger?.addEventListener("click", () => {
  const isOpen = getComputedStyle(menu).display !== "none";
  menu.style.display = isOpen ? "none" : "flex";
});
// ===============================
// CAROUSEL AUTO + CONTROLES
// ===============================
(() => {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  const slides = [...carousel.querySelectorAll(".slide")];
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("carouselDots");

  let index = slides.findIndex(s => s.classList.contains("is-active"));
  if (index < 0) index = 0;

  const INTERVAL = 6000;
  let timer;

  // Crear dots
  const dots = slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === index ? " is-active" : "");
    dot.addEventListener("click", () => {
      goTo(i);
      restart();
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

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
    timer = setInterval(next, INTERVAL);
  }

  function stop(){
    clearInterval(timer);
  }

  function restart(){
    stop();
    start();
  }

  nextBtn.addEventListener("click", () => {
    next();
    restart();
  });

  prevBtn.addEventListener("click", () => {
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

