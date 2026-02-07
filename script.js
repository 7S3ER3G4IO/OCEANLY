/* =========================================================
   OCEANLY — HOME script (Ticket UI/UX + Actus Live + Favoris Netlify)
   - Scroll "Voir conditions" => map avec offset navbar
   - Map layout premium + zoom UI redesign (CSS)
   - Swipe spots (liste) = navigation principale (pas de search)
   - Favoris = backend Netlify (token + functions)
   - Actus = Netlify Function news + auto-refresh
   ========================================================= */

const SPOTS = window.OCEANLY?.SPOTS || [];

const $ = (sel) => document.querySelector(sel);

const el = {
  navbar: $("#navbar"),
  goMap: $("#go-map"),
  map: $("#surf-map"),
  list: $("#spot-list"),

  favEmpty: $("#favorites-empty"),
  favList: $("#favorites-list"),

  toast: $("#toast"),

  refreshOverlay: $("#refresh-overlay"),
  refreshCount: $("#refresh-count"),

  actuGrid: $("#actu-grid"),
  actuStatus: $("#actu-status"),
  actuPrev: $("#actu-prev"),
  actuNext: $("#actu-next"),
  actuRefresh: $("#actu-refresh"),

  newsNotif: $("#news-notif"),
  newsNotifSub: $("#news-notif-sub"),

  loginOpen: null, // injecté par navbar
  loginModal: $("#login-modal"),
  loginClose: $("#login-close"),
  tabLogin: $("#tab-login"),
  tabSignup: $("#tab-signup"),
  signupExtra: $("#signup-extra"),
  loginEmail: $("#login-email"),
  loginPass: $("#login-pass"),
  signupPass2: $("#signup-pass2"),
  loginSave: $("#login-save"),
  loginState: $("#login-state"),
  loginHint: $("#login-hint"),
};

function toast(msg) {
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 2400);
}

/* -----------------------------
   Auth token storage (client)
   - OK de stocker le token côté client (session),
     mais les FAVORIS eux sont côté serveur (multi-device via login)
------------------------------ */
const LS_TOKEN = "oceanly:auth_token";
const LS_EMAIL = "oceanly:auth_email";

function getToken() { return localStorage.getItem(LS_TOKEN) || ""; }
function setToken(t) { localStorage.setItem(LS_TOKEN, t); }
function setEmail(e) { localStorage.setItem(LS_EMAIL, e); }
function getEmail() { return localStorage.getItem(LS_EMAIL) || ""; }
function isAuthed() { return !!getToken(); }

/* -----------------------------
   Favorites (server)
------------------------------ */
let serverFavs = [];

async function favsFetch() {
  if (!isAuthed()) { serverFavs = []; renderFavs(); return; }
  const r = await fetch("/.netlify/functions/favorites", {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "favorites");
  serverFavs = j.favs || [];
  renderFavs();
}

function isFav(slug) { return serverFavs.includes(slug); }

async function toggleFav(slug) {
  if (!isAuthed()) {
    toast("Connecte-toi pour enregistrer tes favoris (multi-device).");
    openLogin();
    return;
  }
  const r = await fetch("/.netlify/functions/favorites", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${getToken()}`
    },
    body: JSON.stringify({ slug })
  });
  const j = await r.json();
  if (!j.ok) return toast(j.error || "Erreur favoris");

  serverFavs = j.favs || [];
  renderFavs();
  toast(j.on ? "Ajouté aux favoris" : "Retiré des favoris");
}

/* -----------------------------
   Render favorites UI
------------------------------ */
function renderFavs() {
  if (!el.favEmpty || !el.favList) return;

  el.favList.innerHTML = "";
  const has = serverFavs.length > 0;

  el.favEmpty.classList.toggle("hidden", has);
  if (!has) {
    el.favEmpty.textContent = isAuthed()
      ? "Aucun favori. Ajoute-en depuis la carte."
      : "Connecte-toi pour retrouver tes favoris partout.";
  }

  serverFavs.forEach(slug => {
    const s = SPOTS.find(x => x.slug === slug);
    if (!s) return;

    const card = document.createElement("div");
    card.className = "fav-card2";
    card.innerHTML = `
      <div>
        <div class="fav-title">${s.name}</div>
        <div class="fav-sub">${s.region} • ${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</div>
      </div>
      <div class="fav-actions">
        <a class="cta-soft btn-small btn-conditions" href="spot.html?spot=${encodeURIComponent(s.slug)}">Conditions</a>
        <a class="cta-soft btn-small btn-camera" href="camera.html?spot=${encodeURIComponent(s.slug)}">Caméra</a>
        <button class="cta-soft btn-small" data-remove="${s.slug}" type="button">Retirer</button>
      </div>
    `;
    card.querySelector('[data-remove]').addEventListener("click", () => toggleFav(s.slug));
    el.favList.appendChild(card);
  });
}

/* -----------------------------
   Smooth scroll map (offset)
------------------------------ */
function scrollToMap() {
  const target = document.getElementById("map");
  if (!target) return;

  const nav = document.getElementById("navbar");
  const navH = nav ? nav.getBoundingClientRect().height : 72;

  const top = target.getBoundingClientRect().top + window.pageYOffset - navH - 18;
  window.scrollTo({ top, behavior: "smooth" });
}

if (el.goMap) el.goMap.addEventListener("click", scrollToMap);

/* -----------------------------
   Map (Leaflet)
------------------------------ */
let map;
let markers = new Map();
let activeSpotSlug = null;

function bluePinIcon() {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
    <path fill="rgba(56,189,248,0.95)" d="M12 2c-3.86 0-7 3.14-7 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="pin-glow">${svg}</div>`,
    iconSize: [34,34],
    iconAnchor: [17,34],
    popupAnchor: [0,-30],
  });
}
function redPinIcon() {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
    <path fill="rgba(239,68,68,0.95)" d="M12 2c-3.86 0-7 3.14-7 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: `<div class="pin-glow red">${svg}</div>`,
    iconSize: [34,34],
    iconAnchor: [17,34],
    popupAnchor: [0,-30],
  });
}

function initMap() {
  if (!el.map) return;

  map = L.map("surf-map", {
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  const franceBounds = L.latLngBounds(
    L.latLng(42.0, -5.8),
    L.latLng(51.5, 8.5)
  );
  map.fitBounds(franceBounds, { padding:[24,24] });

  // Zoom UI (design via CSS)
  const zoomUI = document.createElement("div");
  zoomUI.className = "zoom-ui-premium";
  zoomUI.innerHTML = `
    <button class="zoom-btn-premium" id="zplus" type="button" aria-label="Zoom +">+</button>
    <button class="zoom-btn-premium" id="zminus" type="button" aria-label="Zoom -">−</button>
  `;
  el.map.parentElement.appendChild(zoomUI);
  zoomUI.querySelector("#zplus").addEventListener("click", () => map.zoomIn());
  zoomUI.querySelector("#zminus").addEventListener("click", () => map.zoomOut());

  SPOTS.forEach(s => {
    const m = L.marker([s.lat, s.lon], { icon: bluePinIcon() }).addTo(map);
    markers.set(s.slug, m);
    m.on("click", () => openSpotPopup(s.slug, true));
  });
}

function setActivePin(slug) {
  markers.forEach((m, sslug) => {
    m.setIcon(sslug === slug ? redPinIcon() : bluePinIcon());
  });
  activeSpotSlug = slug;
}

function openSpotPopup(slug, panTo = false) {
  const s = SPOTS.find(x => x.slug === slug);
  if (!s) return;
  const m = markers.get(slug);
  if (!m) return;

  setActivePin(slug);
  if (panTo) map.setView([s.lat, s.lon], Math.max(map.getZoom(), 9), { animate:true });

  const favOn = isFav(slug);
  const favClass = favOn ? "on" : "";
  const favText = favOn ? "Favori ✅" : "Favori";

  const html = `
    <div class="popup-dark">
      <div class="popup-title">${s.name}</div>
      <div class="popup-badges">
        <span class="badge live"><span class="dot"></span> LIVE</span>
        <span class="badge">${s.region}</span>
      </div>
      <div class="popup-actions">
        <a class="popup-btn popup-btn-blue" href="spot.html?spot=${encodeURIComponent(s.slug)}">Conditions</a>
        <a class="popup-btn popup-btn-red" href="camera.html?spot=${encodeURIComponent(s.slug)}">Caméra</a>
        <button class="popup-btn popup-btn-fav ${favClass}" data-fav="${s.slug}" type="button">${favText}</button>
      </div>
      <div class="popup-hint">Swipe spots → clic → popup premium.</div>
    </div>
  `;

  m.bindPopup(html, { closeButton:true, autoPan:true }).openPopup();

  setTimeout(() => {
    const btn = document.querySelector(`button[data-fav="${CSS.escape(s.slug)}"]`);
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleFav(s.slug);
    });
  }, 0);
}

/* -----------------------------
   Swipe Spots list (principal)
------------------------------ */
function renderSpotList() {
  if (!el.list) return;
  el.list.innerHTML = "";

  SPOTS.forEach(s => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "spot-row2 swipe-row";
    row.innerHTML = `
      <div class="spot-row2-top">
        <div class="spot-row2-name">${s.name}</div>
        <div class="spot-row2-right">
          <span class="spot-status ok">LIVE</span>
        </div>
      </div>
      <div class="spot-row2-sub">${s.region}</div>
    `;
    row.addEventListener("click", () => openSpotPopup(s.slug, true));
    el.list.appendChild(row);
  });
}

/* -----------------------------
   Actu LIVE (Netlify Function)
------------------------------ */
let actuItems = [];
let actuIndex = 0;

function formatDate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("fr-FR", { dateStyle:"medium", timeStyle:"short" });
  } catch { return ""; }
}

function renderActu3() {
  if (!el.actuGrid) return;

  const view = actuItems.slice(actuIndex, actuIndex + 3);
  el.actuGrid.innerHTML = "";

  view.forEach(a => {
    const card = document.createElement("div");
    card.className = "actu-card";
    card.innerHTML = `
      <div class="actu-body">
        <div class="actu-title">${a.title}</div>
        <div class="actu-date">${a.source || ""}${a.pubDate ? " • " + formatDate(a.pubDate) : ""}</div>
        <div class="actu-desc">${a.desc || ""}</div>
        <div class="actu-links">
          <a class="cta-soft btn-small" target="_blank" rel="noopener" href="${a.link}">Lire</a>
          <a class="cta-soft btn-small btn-conditions" href="actu.html">Actu</a>
        </div>
      </div>
    `;
    el.actuGrid.appendChild(card);
  });

  if (el.actuStatus) {
    el.actuStatus.textContent = actuItems.length
      ? `Actus: ${actuIndex + 1}–${Math.min(actuIndex + 3, actuItems.length)} / ${actuItems.length}`
      : "Aucune actu pour le moment.";
  }
}

async function loadActu(showNotif = true) {
  try {
    if (el.actuStatus) el.actuStatus.textContent = "Chargement des actus…";
    const r = await fetch("/.netlify/functions/news", { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "news");

    const prevTop = actuItems[0]?.title || "";
    actuItems = (j.items || []).slice(0, 30);
    actuIndex = 0;
    renderActu3();

    if (showNotif && prevTop && actuItems[0]?.title && actuItems[0].title !== prevTop && el.newsNotif && el.newsNotifSub) {
      el.newsNotifSub.textContent = actuItems[0].title.slice(0, 70);
      el.newsNotif.classList.remove("hidden");
    }
  } catch {
    if (el.actuStatus) el.actuStatus.textContent = "Impossible de récupérer les actus.";
  }
}

function runRefreshCountdown(onDone) {
  if (!el.refreshOverlay || !el.refreshCount) return onDone?.();
  el.refreshOverlay.classList.remove("hidden");
  let n = 3;
  el.refreshCount.textContent = String(n);
  const t = setInterval(() => {
    n -= 1;
    el.refreshCount.textContent = String(n);
    if (n <= 0) {
      clearInterval(t);
      el.refreshOverlay.classList.add("hidden");
      onDone?.();
    }
  }, 1000);
}

if (el.actuPrev) el.actuPrev.addEventListener("click", () => { actuIndex = Math.max(0, actuIndex - 3); renderActu3(); });
if (el.actuNext) el.actuNext.addEventListener("click", () => { actuIndex = Math.min(Math.max(0, actuItems.length - 3), actuIndex + 3); renderActu3(); });
if (el.actuRefresh) el.actuRefresh.addEventListener("click", () => runRefreshCountdown(() => loadActu(false)));
if (el.newsNotif) el.newsNotif.addEventListener("click", () => { el.newsNotif.classList.add("hidden"); window.location.href = "actu.html"; });

/* -----------------------------
   Login modal -> backend
------------------------------ */
function openLogin() {
  el.loginModal?.classList.remove("hidden");
  if (el.loginState) el.loginState.textContent = isAuthed() ? `Connecté: ${getEmail()}` : "—";
}
function closeLogin() { el.loginModal?.classList.add("hidden"); }

function bindLoginButtonsFromNavbar() {
  // navbar est injectée par common.js, donc le bouton arrive après DOMContentLoaded
  const btn = document.getElementById("login-open");
  if (btn) {
    btn.addEventListener("click", openLogin);
  }
}

if (el.loginClose) el.loginClose.addEventListener("click", closeLogin);
el.loginModal?.addEventListener("click", (e) => { if (e.target === el.loginModal) closeLogin(); });

if (el.tabLogin && el.tabSignup) {
  el.tabLogin.addEventListener("click", () => {
    el.tabLogin.classList.add("active");
    el.tabSignup.classList.remove("active");
    el.signupExtra.classList.add("hidden");
    el.loginHint.textContent = "Connexion → favoris multi-device";
  });
  el.tabSignup.addEventListener("click", () => {
    el.tabSignup.classList.add("active");
    el.tabLogin.classList.remove("active");
    el.signupExtra.classList.remove("hidden");
    el.loginHint.textContent = "Inscription → crée ton compte";
  });
}

if (el.loginSave) el.loginSave.addEventListener("click", async () => {
  const email = (el.loginEmail.value || "").trim().toLowerCase();
  const pass = (el.loginPass.value || "").trim();
  const isSignup = !el.signupExtra.classList.contains("hidden");

  if (!email || !pass) return toast("Email + mot de passe requis");
  if (isSignup) {
    const p2 = (el.signupPass2.value || "").trim();
    if (p2 !== pass) return toast("Les mots de passe ne correspondent pas");
  }

  try {
    const r = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: isSignup ? "register" : "login", email, password: pass })
    });
    const j = await r.json();
    if (!j.ok) return toast(j.error || "Erreur connexion");

    setToken(j.token);
    setEmail(j.email);
    if (el.loginState) el.loginState.textContent = `Connecté: ${j.email}`;
    toast(isSignup ? "Compte créé ✅" : "Connecté ✅");

    await favsFetch();
    setTimeout(closeLogin, 500);
  } catch {
    toast("Erreur réseau (auth)");
  }
});

/* -----------------------------
   Init
------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  bindLoginButtonsFromNavbar();
  initMap();
  renderSpotList();

  // Favoris: charge depuis serveur si connecté
  try { await favsFetch(); } catch {}

  // Actus: charge + auto-refresh toutes les 5 minutes
  await loadActu(true);
  setInterval(() => loadActu(false), 5 * 60 * 1000);

  // Fix pour éviter flash scroll
  let scrollTimer = null;
  window.addEventListener("scroll", () => {
    document.body.classList.add("is-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => document.body.classList.remove("is-scrolling"), 120);
  }, { passive:true });
});
