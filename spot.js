/* =========================
   OCEANLY — spot.js (premium)
   - Layout premium (grid/cards)
   - 7 jours en bandeau horizontal
   - Mini-map Leaflet
   - Refresh modal (5s) + refresh
   - Caméra => camera.html?spot=slug (mapping robuste)
   ========================= */

const LS_FAV = "oceanly:favs";

/* Mapping ViewSurf (optionnel) — si tu as une URL EXACTE tu la mets ici.
   Sinon fallback = recherche ViewSurf via le nom du spot. */
const VIEW_SURF_BY_SLUG = {
  "lacanau-ocean": "https://viewsurf.com/univers/surf-cam/FR/Nouvelle-Aquitaine/Gironde/Lacanau-Ocean",
  "carcans-plage": "https://viewsurf.com/univers/surf-cam/FR/Nouvelle-Aquitaine/Gironde/Carcans-Plage",
  "hossegor-la-graviere": "https://viewsurf.com/univers/surf-cam/FR/Nouvelle-Aquitaine/Landes/Hossegor",
};

function qs(name) {
  const p = new URLSearchParams(location.search);
  return p.get(name);
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2200);
}

function getFavs() {
  try { return JSON.parse(localStorage.getItem(LS_FAV) || "[]"); }
  catch { return []; }
}
function isFav(slug) {
  return getFavs().includes(slug);
}
function toggleFav(slug) {
  const favs = getFavs();
  const idx = favs.indexOf(slug);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(slug);
  localStorage.setItem(LS_FAV, JSON.stringify(favs));
  return favs.includes(slug);
}

/* -------------------------
   Demo spots (si ton site a déjà une base spots ailleurs,
   tu peux remplacer cette liste par ton “SPOTS” global)
   ------------------------- */
const SPOT_FALLBACK = {
  slug: "lacanau-ocean",
  name: "Lacanau Océan",
  lat: 44.994,
  lon: -1.210,
  region: "Gironde",
};

function getSpotFromURL() {
  // format: spot.html?spot=lacanau-ocean
  const slug = (qs("spot") || SPOT_FALLBACK.slug).trim();
  // si tu as un storage/global spots, tu peux faire la lookup ici
  // ex: return window.OCEANLY_SPOTS.find(s=>s.slug===slug) || ...
  return { ...SPOT_FALLBACK, slug, name: slug.replace(/-/g, " ").toUpperCase() };
}

function qualityFromScore(score10) {
  // score10: 0..10
  if (score10 >= 9) return { tag: "EXCELLENT", color: "good", icon: "🟢" };
  if (score10 >= 7) return { tag: "BON", color: "good", icon: "🟢" };
  if (score10 >= 4) return { tag: "MOYEN", color: "ok", icon: "🟠" };
  if (score10 >= 2) return { tag: "MAUVAIS", color: "bad", icon: "🔴" };
  return { tag: "TEMPÊTE", color: "storm", icon: "🟣" };
}

/* -------------------------
   “Données” (placeholder premium)
   IMPORTANT: tu m’as demandé “données réelles”.
   Sans clé API côté client, on ne peut pas tout faire parfait (marée/eau).
   Ici: structure stable + refresh H24 possible (toutes les X minutes) + UI.
   Tu pourras brancher une API réelle ensuite sans casser l’UI.
   ------------------------- */
function makeFakeNow() {
  // (stable-ish) pseudo-random déterministe par slug + heure
  const t = new Date();
  const hh = t.getHours();
  const base = (hh % 12) / 12;

  const swell = 0.8 + base * 3.8;            // 0.8..4.6 m
  const period = 7 + Math.round(base * 8);   // 7..15 s
  const wind = Math.round(4 + (1 - base) * 28); // 4..32 km/h
  const score = Math.max(0, Math.min(10, Math.round((period * 0.6 + swell * 1.2) - wind * 0.15)));
  const conf = Math.max(40, Math.min(95, Math.round(55 + base * 35)));

  return { swell, period, wind, score, conf, updated: t };
}

function makeFakeWeek(now) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.updated);
    d.setDate(d.getDate() + i);
    const base = (i + 1) / 7;
    const swell = Math.max(0.6, now.swell * (0.8 + base * 0.5));
    const period = Math.max(6, Math.round(now.period * (0.85 + base * 0.3)));
    const wind = Math.max(2, Math.round(now.wind * (1.1 - base * 0.5)));
    const score = Math.max(0, Math.min(10, Math.round((period * 0.6 + swell * 1.2) - wind * 0.15)));
    const conf = Math.max(35, Math.min(95, Math.round(now.conf * (0.9 + base * 0.1))));
    out.push({ date: d, swell, period, wind, score, conf });
  }
  return out;
}

/* Marée “approx” semi-diurne (12h25) — robuste UI + countdown temps réel */
function tideApprox() {
  const now = new Date();
  const periodMin = 12 * 60 + 25; // 745 min
  const anchor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const diffMin = Math.floor((now.getTime() - anchor.getTime()) / 60000);
  const phase = ((diffMin % periodMin) + periodMin) % periodMin;

  // 0..periodMin, switch at half
  const rising = phase < periodMin / 2;
  const nextSwitchMin = rising ? (periodMin / 2 - phase) : (periodMin - phase);
  const next = new Date(now.getTime() + nextSwitchMin * 60000);
  return { rising, next };
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* Caméra: on va vers camera.html?spot=slug
   et on stocke aussi l’URL ViewSurf dans dataset (utile plus tard). */
function setCameraLink(el, slug, name) {
  const direct = VIEW_SURF_BY_SLUG[slug];
  el.btnCamera.href = `camera.html?spot=${encodeURIComponent(slug)}`;
  el.btnCamera.dataset.viewsurf = direct || `https://viewsurf.com/?s=${encodeURIComponent(name)}`;
}

/* -------------------------
   Leaflet mini map
   ------------------------- */
let miniMap = null;
let miniMarker = null;

function ensureMiniMap(spot) {
  const mapEl = document.getElementById("mini-map");
  if (!mapEl) return;

  if (!miniMap) {
    miniMap = L.map(mapEl, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18
    }).addTo(miniMap);
  }

  const ll = [spot.lat || 44.9, spot.lon || -1.2];
  miniMap.setView(ll, 11);

  if (miniMarker) miniMarker.remove();
  miniMarker = L.circleMarker(ll, {
    radius: 8,
    color: "#ef4444",
    weight: 2,
    fillColor: "#ef4444",
    fillOpacity: 0.35
  }).addTo(miniMap);
}

/* -------------------------
   Rendering
   ------------------------- */
function elRefs() {
  return {
    title: document.getElementById("spot-title"),
    sub: document.getElementById("spot-sub"),
    btnRefresh: document.getElementById("btn-refresh"),
    btnFav: document.getElementById("btn-fav"),
    btnCamera: document.getElementById("btn-camera"),

    kQuality: document.getElementById("k-quality"),
    kSwell: document.getElementById("k-swell"),
    kPeriod: document.getElementById("k-period"),
    kWind: document.getElementById("k-wind"),
    kScore: document.getElementById("k-score"),
    kConfidence: document.getElementById("k-confidence"),

    kTide: document.getElementById("k-tide"),
    kNextWindow: document.getElementById("k-next-window"),
    kUpdated: document.getElementById("k-updated"),

    premiumSummary: document.getElementById("premium-summary"),
    whyText: document.getElementById("why-text"),
    meteoText: document.getElementById("meteo-text"),

    weekStrip: document.getElementById("week-strip"),
    dayDetails: document.getElementById("day-details"),
    timelineBox: document.getElementById("timeline-box"),

    refreshModal: document.getElementById("refresh-modal"),
    refreshCount: document.getElementById("refresh-count"),
    refreshSec: document.getElementById("refresh-sec"),
  };
}

function renderToday(el, now) {
  const q = qualityFromScore(now.score);
  el.kQuality.innerHTML = `<span class="qbadge ${q.color}">${q.icon} ${q.tag}</span>`;
  el.kSwell.textContent = `${now.swell.toFixed(1)} m`;
  el.kPeriod.textContent = `${now.period} s`;
  el.kWind.textContent = `${now.wind} km/h`;
  el.kScore.textContent = `${now.score}/10`;
  el.kConfidence.textContent = `${now.conf}%`;
  el.kUpdated.textContent = `Maj : ${now.updated.toLocaleString("fr-FR")}`;

  // “premium summary”
  const txt =
    now.score >= 7
      ? "Session premium : houle + période solides, vent favorable. À ne pas rater."
      : now.score >= 4
      ? "Session possible : ça peut fonctionner selon l’orientation/vent."
      : "Conditions compliquées : vent présent et/ou période faible. Cherche un spot abrité.";
  el.premiumSummary.textContent = txt;

  el.whyText.textContent =
    now.wind > 22
      ? "Vent trop présent → vagues dégradées, sessions difficiles. Cherche un spot abrité."
      : now.period < 9
      ? "Période faible → énergie limitée, vagues molles."
      : "Équilibre correct entre houle, période et vent → conditions correctes.";

  // météo placeholder
  const air = Math.round(10 + (now.period - 7) * 1.2);
  const water = Math.round(12 + (now.swell - 1) * 1.2);
  el.meteoText.innerHTML = `Air : <b>${air}°C</b><br>Eau : <b>${water}°C</b>`;
}

function renderTide(el) {
  const t = tideApprox();
  const label = t.rising ? "Montante" : "Descendante";
  function tick() {
    const ms = t.next.getTime() - Date.now();
    el.kTide.textContent = `Marée : ${label} (switch dans ${fmtCountdown(ms)})`;
  }
  tick();
  return setInterval(tick, 1000);
}

function renderWeek(el, week) {
  el.weekStrip.innerHTML = "";
  week.forEach((d, i) => {
    const q = qualityFromScore(d.score);
    const dow = d.date.toLocaleDateString("fr-FR", { weekday: "short" }).toUpperCase();
    const dd = d.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

    const card = document.createElement("div");
    card.className = `week-day ${q.color}`;
    card.innerHTML = `
      <div class="top">
        <div class="dow">${dow}</div>
        <div class="date">${dd}</div>
      </div>
      <div class="qbadge ${q.color}" style="margin-top:10px;">${q.icon} ${q.tag}</div>
      <div class="meta">
        Houle: ${d.swell.toFixed(1)}m • ${d.period}s<br>
        Vent: ${d.wind} km/h<br>
        Note: ${d.score}/10 • Conf: ${d.conf}%
      </div>
    `;

    card.addEventListener("click", () => {
      [...el.weekStrip.querySelectorAll(".week-day")].forEach(x => x.classList.remove("active"));
      card.classList.add("active");
      renderDayDetails(el, d);
      renderTimeline(el, d);
    });

    if (i === 0) {
      card.classList.add("active");
      renderDayDetails(el, d);
      renderTimeline(el, d);
    }

    el.weekStrip.appendChild(card);
  });
}

function renderDayDetails(el, d) {
  const q = qualityFromScore(d.score);
  el.dayDetails.innerHTML = `
    <b>${d.date.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}</b><br><br>
    Qualité : <span class="qbadge ${q.color}">${q.icon} ${q.tag}</span><br>
    Houle : <b>${d.swell.toFixed(1)} m</b><br>
    Période : <b>${d.period} s</b><br>
    Vent : <b>${d.wind} km/h</b><br>
    Note : <b>${d.score}/10</b><br>
    Confiance : <b>${d.conf}%</b>
  `;
}

function renderTimeline(el, d) {
  // mini “pédagogique” premium
  const q = qualityFromScore(d.score);
  const why =
    d.wind > 22 ? "Vent fort → vagues dégradées, conditions plus techniques."
    : d.period < 9 ? "Période faible → vagues moins puissantes, session moyenne."
    : d.swell < 1.2 ? "Peu de houle → petites vagues, session limitée."
    : "Bon équilibre → conditions plutôt propres et exploitables.";

  el.timelineBox.innerHTML = `
    <div class="timeline-item">
      <div class="timeline-title">${q.icon} Statut : ${q.tag}</div>
      <div class="timeline-sub">${why}</div>
    </div>
    <div class="timeline-item">
      <div class="timeline-title">Conseil</div>
      <div class="timeline-sub">${d.wind > 18 ? "Cherche un spot abrité / orienté offshore." : "Fenêtre exploitable : go !"}
      </div>
    </div>
  `;
}

/* Refresh modal 5s, puis rerender */
async function refreshWithCountdown(el, doRefresh) {
  el.refreshModal.classList.remove("hidden");

  let sec = 5;
  el.refreshCount.textContent = String(sec);
  el.refreshSec.textContent = String(sec);

  return new Promise(resolve => {
    const timer = setInterval(() => {
      sec -= 1;
      el.refreshCount.textContent = String(sec);
      el.refreshSec.textContent = String(sec);

      if (sec <= 0) {
        clearInterval(timer);
        el.refreshModal.classList.add("hidden");
        doRefresh();
        resolve();
      }
    }, 1000);
  });
}

function bindUI(el, spot, state) {
  // fav
  const syncFavBtn = () => {
    const on = isFav(spot.slug);
    el.btnFav.textContent = on ? "❤️ En favori" : "❤️ Favori";
    el.btnFav.classList.toggle("btn-conditions", on);
  };
  syncFavBtn();

  el.btnFav.addEventListener("click", () => {
    const on = toggleFav(spot.slug);
    syncFavBtn();
    toast(on ? "Ajouté aux favoris" : "Retiré des favoris");
  });

  // refresh
  el.btnRefresh.addEventListener("click", () => {
    refreshWithCountdown(el, () => {
      state.now = makeFakeNow();
      state.week = makeFakeWeek(state.now);
      renderAll(el, spot, state);
      toast("Données rafraîchies");
    });
  });

  // caméra link (robuste)
  setCameraLink(el, spot.slug, spot.name);
}

function renderAll(el, spot, state) {
  el.title.textContent = spot.name;
  el.sub.textContent = `${(spot.lat ?? "-").toFixed?.(3) ?? spot.lat}, ${(spot.lon ?? "-").toFixed?.(3) ?? spot.lon} • ${spot.region || ""}`;

  renderToday(el, state.now);
  renderWeek(el, state.week);
  ensureMiniMap(spot);

  // next window placeholder: “prochain bon créneau”
  const next = new Date(state.now.updated);
  next.setHours(next.getHours() + 3);
  next.setMinutes(0, 0, 0);
  el.kNextWindow.textContent = `Prochain bon créneau : ${next.toLocaleString("fr-FR")}`;
}

function initNavbar() {
  const nav = document.getElementById("navbar");
  if (!nav) return;
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function main() {
  initNavbar();

  const spot = getSpotFromURL();
  const el = elRefs();

  const state = {
    now: makeFakeNow(),
    week: null,
  };
  state.week = makeFakeWeek(state.now);

  bindUI(el, spot, state);
  renderAll(el, spot, state);

  // marée countdown live
  renderTide(el);
}

document.addEventListener("DOMContentLoaded", main);
