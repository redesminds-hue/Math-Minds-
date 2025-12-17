const burger = document.getElementById("burger");
const nav = document.getElementById("nav");

burger?.addEventListener("click", () => {
  const visible = nav.style.display === "flex";
  nav.style.display = visible ? "none" : "flex";
  nav.style.flexDirection = "column";
  nav.style.gap = "14px";
  nav.style.position = "absolute";
  nav.style.top = "66px";
  nav.style.right = "16px";
  nav.style.background = "#fff";
  nav.style.border = "1px solid #e5e7eb";
  nav.style.borderRadius = "10px";
  nav.style.padding = "14px";
  nav.style.boxShadow = "0 10px 30px rgba(0,0,0,.08)";
});
