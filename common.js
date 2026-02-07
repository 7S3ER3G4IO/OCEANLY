/* common.js — comportements communs (navbar + scroll) */

(function(){
  const body = document.body;

  // anti “flash blanc” / repaint : on réduit le blur pendant scroll rapide
  let t = null;
  window.addEventListener("scroll", () => {
    body.classList.add("is-scrolling");
    clearTimeout(t);
    t = setTimeout(() => body.classList.remove("is-scrolling"), 140);
  }, { passive:true });

  // navbar “active”
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-links a[data-page]").forEach(a=>{
    const p = (a.getAttribute("data-page")||"").toLowerCase();
    if (!p) return;
    if (p === path) a.classList.add("active");
  });

  // smooth scroll for anchors
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener("click", (e)=>{
      const id = a.getAttribute("href");
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  });
})();
