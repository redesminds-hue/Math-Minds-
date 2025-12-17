const burger = document.getElementById("burger");
const menu = document.getElementById("menu");

burger?.addEventListener("click", () => {
  const isOpen = getComputedStyle(menu).display !== "none";
  menu.style.display = isOpen ? "none" : "flex";
});
