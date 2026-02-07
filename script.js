/* =========================================================
   OCEANLY — HOME script
   - Map France cadrée (pas trop zoom)
   - Pins bleus, popup premium, favori toggle (on/off)
   - Bouton hero => scroll map
   - Search + clear
   - Favoris section
   - Actu (3 visibles) via RSS proxy (jina.ai)
   - Refresh modal 5s uniquement quand bouton refresh
   - Fix scroll white flashes: body.is-scrolling
   ========================================================= */

const LS_FAV = "oceanly:favorites";
const LS_LOGIN = "oceanly:login";

/* -----------------------------
   Spots (coords + camera link)
------------------------------ */
const SPOTS = [
  { id:"lacanau-ocean", name:"Lacanau Océan", region:"Gironde", lat:44.994, lon:-1.210, viewsurf:"https://viewsurf.com/" },
  { id:"le-porge-ocean", name:"Le Porge (Océan)", region:"Gironde", lat:44.889, lon:-1.253, viewsurf:"https://viewsurf.com/" },
  { id:"carcans-plage", name:"Carcans Plage", region:"Gironde", lat:45.080, lon:-1.220, viewsurf:"https://viewsurf.com/" },
  { id:"biscarrosse", name:"Biscarrosse Plage", region:"Landes", lat:44.441, lon:-1.252, viewsurf:"https://viewsurf.com/" },
  { id:"mimizan", name:"Mimizan Plage", region:"Landes", lat:44.213, lon:-1.295, viewsurf:"https://viewsurf.com/" },
  { id:"seignosse-estagnots", name:"Seignosse (Les Estagnots)", region:"Landes", lat:43.703, lon:-1.448, viewsurf:"https://viewsurf.com/" },
  { id:"hossegor-graviere", name:"Hossegor (La Gravière)", region:"Landes", lat:43.674, lon:-1.444, viewsurf:"https://viewsurf.com/" },
  { id:"capbreton-santocha", name:"Capbreton (La Piste)", region:"Landes", lat:43.648, lon:-1.433, viewsurf:"https://viewsurf.com/" },
  { id:"anglet-cavaliers", name:"Anglet (Les Cavaliers)", region:"Pays Basque", lat:43.514, lon:-1.542, viewsurf:"https://viewsurf.com/" },
  { id:"biarritz", name:"Biarritz (Côte des Basques)", region:"Pays Basque", lat:43.478, lon:-1.571, viewsurf:"https://viewsurf.com/" },
  { id:"la-torche", name:"La Torche", region:"Bretagne", lat:47.837, lon:-4.359, viewsurf:"https://viewsurf.com/" },
  { id:"penhors", name:"Penhors", region:"Bretagne", lat:47.930, lon:-4.392, viewsurf:"https://viewsurf.com/" },
  { id:"crozon-palue", name:"Crozon (La Palue)", region:"Bretagne", lat:48.195, lon:-4.546, viewsurf:"https://viewsurf.com/" }
];

/* -----------------------------
   Helpers
------------------------------ */
const $ = (sel) => document.querySelector(sel);
const el = {
  navbar: $("#navbar"),
  goMap: $("#go-map"),
  map: $("#surf-map"),
  search: $("#spot-search"),
  clear: $("#search-clear"),
  select: $("#spot-select"),
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

  loginOpen: $("#login-open"),
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
};

/* -----------------------------
   Navbar scroll animation
------------------------------ */
window.addEventListener("scroll", () => {
  if (!el.navbar) return;
  el.navbar.classList.toggle("scrolled", window.scrollY > 10);
});

/* Active nav (home anchors) */
(function setActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  const links = document.querySelectorAll(".nav-links a");
  links.forEach(a => a.classList.remove("active"));

  // home
  if (path === "index.html") {
    document.querySelectorAll('.nav-links a[href="index.html"]').forEach(a=>a.classList.add("active"));
  }
})();

/* -----------------------------
   Scroll glitch fix (white flashes)
------------------------------ */
let scrollTimer = null;
window.addEventListener("scroll", () => {
  document.body.classList.add("is-scrolling");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => document.body.classList.remove("is-scrolling"), 120);
}, { passive:true });

/* -----------------------------
   Toast
------------------------------ */
function toast(msg) {
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 2400);
}

/* -----------------------------
   Favorites storage
------------------------------ */
function getFavs() {
  try { return JSON.parse(localStorage.getItem(LS_FAV) || "[]"); }
  catch { return []; }
}
function setFavs(arr) {
  localStorage.setItem(LS_FAV, JSON.stringify(arr));
}
function isFav(id) {
  return getFavs().includes(id);
}
function toggleFav(id) {
  const favs = getFavs();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  setFavs(favs);
  renderFavs();
}

/* -----------------------------
   Render favorites section
------------------------------ */
function renderFavs() {
  const favs = getFavs();
  if (!el.favEmpty || !el.favList) return;

  el.favList.innerHTML = "";
  el.favEmpty.classList.toggle("hidden", favs.length > 0);

  favs.forEach(id => {
    const s = SPOTS.find(x => x.id === id);
    if (!s) return;

    const card = document.createElement("div");
    card.className = "fav-card2";
    card.innerHTML = `
      <div>
        <div class="fav-title">${s.name}</div>
        <div class="fav-sub">${s.region} • ${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}</div>
      </div>
      <div class="fav-actions">
        <a class="cta-soft btn-small btn-conditions" href="spot.html?spot=${encodeURIComponent(s.id)}">Conditions</a>
        <a class="cta-soft btn-small btn-camera" href="camera.html?spot=${encodeURIComponent(s.id)}">Caméra</a>
        <button class="cta-soft btn-small" data-remove="${s.id}" type="button">Retirer</button>
      </div>
    `;
    card.querySelector('[data-remove]').addEventListener("click", () => {
      toggleFav(s.id);
      toast("Favori retiré");
    });

    el.favList.appendChild(card);
  });
}

/* -----------------------------
   Leaflet map init
------------------------------ */
let map;
let markers = new Map();
let activeSpotId = null;

function bluePinIcon() {
  // SVG pin bleu
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24">
    <path fill="rgba(56,189,248,0.95)" d="M12 2c-3.86 0-7 3.14-7 7c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/>
  </svg>`;
  return L.divIcon({
    className: "",
    html: `<div style="filter: drop-shadow(0 0 14px rgba(56,189,248,.22));">${svg}</div>`,
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
    html: `<div style="filter: drop-shadow(0 0 16px rgba(239,68,68,.28));">${svg}</div>`,
    iconSize: [34,34],
    iconAnchor: [17,34],
    popupAnchor: [0,-30],
  });
}

function initMap() {
  if (!el.map) return;

  map = L.map("surf-map", {
    zoomControl: false, // on enlève le +/-
    attributionControl: true,
  });

  // dark tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  // Vue “France entière” (pas zoom excessif)
  const franceBounds = L.latLngBounds(
    L.latLng(42.0, -5.8),
    L.latLng(51.5, 8.5)
  );
  map.fitBounds(franceBounds, { padding:[20,20] });

  // Custom zoom UI
  const zoomUI = document.createElement("div");
  zoomUI.className = "zoom-ui";
  zoomUI.innerHTML = `
    <button class="zoom-btn" id="zplus" type="button">+</button>
    <button class="zoom-btn" id="zminus" type="button">−</button>
  `;
  el.map.parentElement.appendChild(zoomUI);
  zoomUI.querySelector("#zplus").addEventListener("click", () => map.zoomIn());
  zoomUI.querySelector("#zminus").addEventListener("click", () => map.zoomOut());

  // markers
  SPOTS.forEach(s => {
    const m = L.marker([s.lat, s.lon], { icon: bluePinIcon() }).addTo(map);
    markers.set(s.id, m);

    m.on("click", () => openSpotPopup(s.id, true));
  });
}

function setActivePin(id) {
  // reset all to blue
  markers.forEach((m, sid) => {
    m.setIcon(sid === id ? redPinIcon() : bluePinIcon());
  });
  activeSpotId = id;
}

function openSpotPopup(id, panTo = false) {
  const s = SPOTS.find(x => x.id === id);
  if (!s) return;
  const m = markers.get(id);
  if (!m) return;

  setActivePin(id);
  if (panTo) map.setView([s.lat, s.lon], Math.max(map.getZoom(), 9), { animate:true });

  const favOn = isFav(id);
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
        <a class="popup-btn popup-btn-blue" href="spot.html?spot=${encodeURIComponent(s.id)}">Conditions</a>
        <a class="popup-btn popup-btn-red" href="camera.html?spot=${encodeURIComponent(s.id)}">Caméra</a>
        <button class="popup-btn popup-btn-fav ${favClass}" data-fav="${s.id}" type="button">${favText}</button>
      </div>

      <div class="popup-hint">Pins bleus = spots • sélection = pin rouge.</div>
    </div>
  `;

  m.bindPopup(html, { closeButton:true, autoPan:true, className:"" }).openPopup();

  // bind fav toggle
  setTimeout(() => {
    const btn = document.querySelector(`button[data-fav="${CSS.escape(s.id)}"]`);
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleFav(s.id);
      const on = isFav(s.id);
      btn.classList.toggle("on", on);
      btn.textContent = on ? "Favori ✅" : "Favori";
      toast(on ? "Ajouté aux favoris" : "Retiré des favoris");
    });
  }, 0);
}

/* -----------------------------
   Search + select + list
------------------------------ */
function renderSpotUI() {
  // select
  if (el.select) {
    SPOTS.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} — ${s.region}`;
      el.select.appendChild(opt);
    });

    el.select.addEventListener("change", () => {
      if (!el.select.value) return;
      openSpotPopup(el.select.value, true);
      scrollToMap();
    });
  }

  // list
  if (el.list) {
    el.list.innerHTML = "";
    SPOTS.forEach(s => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "spot-row2";
      row.innerHTML = `
        <div class="spot-row2-top">
          <div class="spot-row2-name">${s.name}</div>
          <div class="spot-row2-right">
            <span class="spot-status ok">DISPO</span>
          </div>
        </div>
        <div class="spot-row2-sub">${s.region}</div>
      `;
      row.addEventListener("click", () => {
        openSpotPopup(s.id, true);
        scrollToMap();
      });
      el.list.appendChild(row);
    });
  }

  // search
  if (el.search) {
    const updateClear = () => {
      const v = (el.search.value || "").trim();
      el.clear.classList.toggle("hidden", v.length === 0);
    };
    el.search.addEventListener("input", () => {
      updateClear();
      const q = (el.search.value || "").trim().toLowerCase();
      if (!q) return;

      const found = SPOTS.find(s =>
        s.name.toLowerCase().includes(q) || s.id.includes(q) || s.region.toLowerCase().includes(q)
      );
      if (found) {
        openSpotPopup(found.id, true);
      }
    });
    el.clear.addEventListener("click", () => {
      el.search.value = "";
      updateClear();
      toast("Recherche effacée");
      // reset France view
      const franceBounds = L.latLngBounds(L.latLng(42.0, -5.8), L.latLng(51.5, 8.5));
      map.fitBounds(franceBounds, { padding:[20,20] });
      // reset pins
      markers.forEach(m => m.setIcon(bluePinIcon()));
      activeSpotId = null;
    });
    updateClear();
  }
}

/* -----------------------------
   Scroll to map
------------------------------ */
function scrollToMap() {
  const node = document.getElementById("map");
  if (!node) return;
  node.scrollIntoView({ behavior:"smooth", block:"start" });
}
if (el.goMap) el.goMap.addEventListener("click", scrollToMap);

/* -----------------------------
   Refresh modal 5s (ONLY on buttons)
------------------------------ */
async function runRefreshCountdown(onDone) {
  el.refreshOverlay.classList.remove("hidden");
  let n = 5;
  el.refreshCount.textContent = String(n);
  await new Promise((res) => {
    const t = setInterval(() => {
      n -= 1;
      el.refreshCount.textContent = String(n);
      if (n <= 0) { clearInterval(t); res(); }
    }, 1000);
  });
  el.refreshOverlay.classList.add("hidden");
  if (typeof onDone === "function") onDone();
}

/* -----------------------------
   Actu (RSS via jina.ai proxy)
------------------------------ */
const ACTU_SOURCES = [
  // tu peux en ajouter d’autres
  "https://www.surf-report.com/rss",
  "https://www.surfer.com/feed/"
];

let actuItems = [];
let actuIndex = 0;

function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

function formatDate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("fr-FR", { dateStyle:"medium", timeStyle:"short" });
  } catch { return ""; }
}

async function fetchRss(url) {
  // proxy texte HTML du RSS
  const prox = "https://r.jina.ai/http://"+url.replace(/^https?:\/\//,"");
  const res = await fetch(prox, { cache:"no-store" });
  if (!res.ok) throw new Error("fetch failed");
  const txt = await res.text();
  return txt;
}

function parseRss(xmlText) {
  // jina retourne une page texte, mais le RSS est dedans => on tente parse xml
  const raw = xmlText;
  const start = raw.indexOf("<?xml");
  const xml = start >= 0 ? raw.slice(start) : raw;

  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item")).slice(0, 12);

  return items.map(it => {
    const title = it.querySelector("title")?.textContent?.trim() || "Actu surf";
    const link = it.querySelector("link")?.textContent?.trim() || "#";
    const pubDate = it.querySelector("pubDate")?.textContent?.trim() || "";
    const desc = it.querySelector("description")?.textContent || "";
    const clean = stripHtml(desc).slice(0, 160);

    // image (enclosure)
    const enc = it.querySelector("enclosure");
    const img = enc?.getAttribute("url") || "";

    return { title, link, pubDate, desc: clean, img };
  });
}

function renderActu3() {
  if (!el.actuGrid) return;

  const view = actuItems.slice(actuIndex, actuIndex + 3);
  el.actuGrid.innerHTML = "";

  view.forEach(a => {
    const card = document.createElement("div");
    card.className = "actu-card";
    card.innerHTML = `
      <div class="actu-img" style="${a.img ? `background-image:url('${a.img}')` : ""}"></div>
      <div class="actu-body">
        <div class="actu-title">${a.title}</div>
        <div class="actu-date">${formatDate(a.pubDate)}</div>
        <div class="actu-desc">${a.desc || ""}</div>
        <div class="actu-links">
          <a class="cta-soft btn-small" target="_blank" rel="noopener" href="${a.link}">Lire</a>
          <a class="cta-soft btn-small btn-conditions" href="actu.html">Actu</a>
        </div>
      </div>
    `;
    el.actuGrid.appendChild(card);
  });

  el.actuStatus.textContent = actuItems.length
    ? `Actus: ${actuIndex + 1}–${Math.min(actuIndex + 3, actuItems.length)} / ${actuItems.length}`
    : "Aucune actu pour le moment.";
}

async function loadActu(showNotif = true) {
  try {
    el.actuStatus.textContent = "Chargement des actus…";
    let all = [];
    for (const src of ACTU_SOURCES) {
      try {
        const txt = await fetchRss(src);
        all = all.concat(parseRss(txt));
      } catch {}
    }
    // fallback si tout rate
    if (!all.length) {
      all = [
        { title:"Actu surf indisponible (CORS/source)", link:"actu.html", pubDate:new Date().toISOString(), desc:"Ajoute/Change des sources RSS dans script.js (ACTU_SOURCES).", img:"" }
      ];
    }

    // tri date
    all.sort((a,b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    const prevTop = actuItems[0]?.title || "";
    actuItems = all.slice(0, 30);
    actuIndex = 0;
    renderActu3();

    // notif si nouvelle actu
    if (showNotif && prevTop && actuItems[0]?.title && actuItems[0].title !== prevTop) {
      el.newsNotifSub.textContent = actuItems[0].title.slice(0, 70);
      el.newsNotif.classList.remove("hidden");
    }
  } catch (e) {
    el.actuStatus.textContent = "Impossible de récupérer les actus.";
  }
}

if (el.actuPrev) el.actuPrev.addEventListener("click", () => {
  actuIndex = Math.max(0, actuIndex - 3);
  renderActu3();
});
if (el.actuNext) el.actuNext.addEventListener("click", () => {
  actuIndex = Math.min(Math.max(0, actuItems.length - 3), actuIndex + 3);
  renderActu3();
});
if (el.actuRefresh) el.actuRefresh.addEventListener("click", async () => {
  await runRefreshCountdown(() => loadActu(false));
});
if (el.newsNotif) el.newsNotif.addEventListener("click", () => {
  el.newsNotif.classList.add("hidden");
  window.location.href = "actu.html";
});

/* -----------------------------
   Login UI (local)
------------------------------ */
function getLogin() {
  try { return JSON.parse(localStorage.getItem(LS_LOGIN) || "null"); } catch { return null; }
}
function setLogin(v) {
  localStorage.setItem(LS_LOGIN, JSON.stringify(v));
}
function openLogin() {
  el.loginModal.classList.remove("hidden");
  const me = getLogin();
  el.loginState.textContent = me?.email ? `Connecté: ${me.email}` : "—";
}
function closeLogin() {
  el.loginModal.classList.add("hidden");
}
if (el.loginOpen) el.loginOpen.addEventListener("click", openLogin);
if (el.loginClose) el.loginClose.addEventListener("click", closeLogin);
el.loginModal?.addEventListener("click", (e) => {
  if (e.target === el.loginModal) closeLogin();
});
if (el.tabLogin && el.tabSignup) {
  el.tabLogin.addEventListener("click", () => {
    el.tabLogin.classList.add("active");
    el.tabSignup.classList.remove("active");
    el.signupExtra.classList.add("hidden");
  });
  el.tabSignup.addEventListener("click", () => {
    el.tabSignup.classList.add("active");
    el.tabLogin.classList.remove("active");
    el.signupExtra.classList.remove("hidden");
  });
}
if (el.loginSave) el.loginSave.addEventListener("click", () => {
  const email = (el.loginEmail.value || "").trim();
  const pass = (el.loginPass.value || "").trim();
  const isSignup = !el.signupExtra.classList.contains("hidden");
  if (!email || !pass) return toast("Email + mot de passe requis");
  if (isSignup) {
    const p2 = (el.signupPass2.value || "").trim();
    if (p2 !== pass) return toast("Les mots de passe ne correspondent pas");
  }
  setLogin({ email });
  el.loginState.textContent = `Connecté: ${email}`;
  toast(isSignup ? "Compte créé (local)" : "Connecté (local)");
  setTimeout(closeLogin, 650);
});

/* -----------------------------
   Init
------------------------------ */
(function init() {
  // push content below fixed navbar
  document.body.style.paddingTop = "72px";

  initMap();
  renderSpotUI();
  renderFavs();
  loadActu(true);
})();
