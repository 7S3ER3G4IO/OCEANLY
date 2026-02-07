(() => {
  const API_BASE = "/.netlify/functions";
  async function apiGet(functionName, params = {}) {
    const url = new URL(`${API_BASE}/${functionName}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }
  window.APP = { API_BASE, apiGet };

  function getPageKey() {
    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    if (file === "" || file === "index.html") return "home";
    if (file === "spot.html") return "spot";
    if (file === "camera.html") return "camera";
    if (file === "actu.html") return "actu";
    if (file === "best.html") return "best";
    return file;
  }

  function injectNavbar() {
    const host = document.getElementById("navbar");
    if (!host) return;

    const page = getPageKey();
    const isHome = page === "home";

    host.className = "navbar navbar-fixed";
    host.innerHTML = `
      <div class="logo">
        <img src="assets/images/logo.svg" alt="Logo OCEANLY">
        <div class="brand">
          <div class="brand-name">OCEANLY</div>
          <div class="brand-sub">Prévisions surf • Carte • Favoris • Caméras • Actu</div>
        </div>
      </div>

      <nav class="nav-links" id="navLinks">
        <a href="index.html" data-page="home">Accueil</a>
        <a href="index.html#map" data-page="map">Carte</a>
        <a href="index.html#favorites" data-page="favorites">Favoris</a>
        <a href="camera.html" data-page="camera">Caméra</a>
        <a href="actu.html" data-page="actu">Actu</a>
      </nav>

      <div class="nav-actions">
        ${
          isHome
            ? `<button id="login-open" class="nav-login" type="button">Se connecter</button>`
            : `<a class="cta-soft btn-small" href="index.html">← Retour</a>`
        }
      </div>
    `;

    // active link simple
    const links = host.querySelectorAll(".nav-links a");
    links.forEach(a => a.classList.remove("active"));
    if (page === "home") host.querySelector('[data-page="home"]')?.classList.add("active");
    if (page === "camera") host.querySelector('[data-page="camera"]')?.classList.add("active");
    if (page === "actu") host.querySelector('[data-page="actu"]')?.classList.add("active");
  }

  function bindNavbarScroll() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function ensureBodyOffset() {
    document.body.style.paddingTop = "72px";
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectNavbar();
    bindNavbarScroll();
    ensureBodyOffset();
  });
})();
