// spot.js — Conditions H24/7 via Open-Meteo (Marine + Weather)
// + Marée approximative (timer + montante/descendante)
// + Signal session (Session à pas rater / Tempête / etc.)
// Prérequis : spot.html charge data.js AVANT spot.js

const $ = (id) => document.getElementById(id);

/* ----------------------------
   Spot resolver (data.js)
---------------------------- */
function getSlug() {
  const p = new URLSearchParams(location.search);
  return (p.get("spot") || "lacanau-ocean").trim();
}
function getSpot() {
  const slug = getSlug();
  const s = window.OCEANLY?.getSpotBySlug?.(slug) || null;
  if (s) return s;
  return { slug, name: slug.replace(/-/g, " "), lat: 44.994, lon: -1.21, region: "" };
}

/* ----------------------------
   Utils
---------------------------- */
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function fmtUpdated(d) {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}
function nearestIndex(times) {
  const now = Date.now();
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]).getTime();
    const diff = Math.abs(t - now);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}
function scoreFrom(waveM, periodS, windKmh) {
  const s = (periodS * 0.6 + waveM * 1.2) - windKmh * 0.12;
  return clamp(Math.round(s), 0, 10);
}
function quality(score) {
  if (score >= 8) return { tag: "EXCELLENT", css: "good", icon: "⚡" };
  if (score >= 6) return { tag: "BON", css: "good", icon: "✅" };
  if (score >= 4) return { tag: "MOYEN", css: "mid", icon: "➖" };
  if (score >= 2) return { tag: "MAUVAIS", css: "bad", icon: "⚠️" };
  return { tag: "TEMPÊTE", css: "storm", icon: "⛈" };
}

/* ----------------------------
   API Open-Meteo
---------------------------- */
async function fetchMarine(lat, lon) {
  const u = new URL("https://marine-api.open-meteo.com/v1/marine");
  u.searchParams.set("latitude", lat);
  u.searchParams.set("longitude", lon);
  u.searchParams.set("timezone", "Europe/Paris");
  u.searchParams.set("hourly", ["wave_height", "wave_period", "wave_direction"].join(","));
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error("Marine API error");
  return r.json();
}
async function fetchWeather(lat, lon) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", lat);
  u.searchParams.set("longitude", lon);
  u.searchParams.set("timezone", "Europe/Paris");
  u.searchParams.set("hourly", ["wind_speed_10m", "wind_direction_10m", "temperature_2m"].join(","));
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error("Weather API error");
  return r.json();
}

/* ----------------------------
   Marée approximative
---------------------------- */
const TIDE_HALF_CYCLE_MS = 6.2 * 60 * 60 * 1000; // ~6h12
const TIDE_ANCHOR_UTC_MS = Date.UTC(2024, 0, 1, 0, 0, 0);

function msToHMS(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`;
}
function approxTideState() {
  const now = Date.now();
  const elapsed = now - TIDE_ANCHOR_UTC_MS;
  const phase = ((elapsed % TIDE_HALF_CYCLE_MS) + TIDE_HALF_CYCLE_MS) % TIDE_HALF_CYCLE_MS;
  const remaining = TIDE_HALF_CYCLE_MS - phase;

  const halfIndex = Math.floor(elapsed / TIDE_HALF_CYCLE_MS);
  const rising = (halfIndex % 2) === 0; // alternance stable

  const pct = phase / TIDE_HALF_CYCLE_MS;
  const nextChange = new Date(now + remaining);

  return { rising, remaining, pct, nextChange };
}

let tideApproxInterval;
function startApproxTideUI() {
  const stateEl = $("tide-state");
  const nextEl  = $("tide-next");
  const timerEl = $("tide-timer");
  const fillEl  = $("tide-fill");
  if (!stateEl || !nextEl || !timerEl || !fillEl) return;

  const tick = () => {
    const t = approxTideState();
    stateEl.textContent = t.rising ? "Montante ⬆️" : "Descendante ⬇️";
    nextEl.innerHTML = `Changement : ${t.nextChange.toLocaleString("fr-FR", { hour:"2-digit", minute:"2-digit" })} <span class="tide-approx">≈ estimation</span>`;
    timerEl.textContent = `Dans : ${msToHMS(t.remaining)}`;
    fillEl.style.width = `${Math.round(t.pct * 100)}%`;
  };

  if (tideApproxInterval) clearInterval(tideApproxInterval);
  tick();
  tideApproxInterval = setInterval(tick, 1000);
}

/* ----------------------------
   Favoris (local)
---------------------------- */
const LS_FAV = "oceanly:favs";
function getFavs() {
  try { return JSON.parse(localStorage.getItem(LS_FAV) || "[]"); } catch { return []; }
}
function isFav(slug) { return getFavs().includes(slug); }
function toggleFav(slug) {
  const favs = getFavs();
  const idx = favs.indexOf(slug);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(slug);
  localStorage.setItem(LS_FAV, JSON.stringify(favs));
  return favs.includes(slug);
}
function updateFavBtn(spot) {
  const b = $("btn-fav");
  if (!b) return;
  b.textContent = isFav(spot.slug) ? "❤️ Favori ✅" : "❤️ Favori";
}

/* ----------------------------
   Signal Session (auto)
---------------------------- */
function setSignal(kind, icon, title, sub, rightText) {
  const pill = $("signal-pill");
  const ico  = $("signal-ico");
  const t    = $("signal-title");
  const s    = $("signal-sub");
  const r    = $("signal-right");
  if (!pill || !ico || !t || !s || !r) return;

  pill.classList.remove("glow-green","glow-cyan","glow-amber","glow-purple","pulse");
  if (kind === "must") { pill.classList.add("glow-green","pulse"); }
  else if (kind === "good") { pill.classList.add("glow-cyan"); }
  else if (kind === "watch") { pill.classList.add("glow-amber"); }
  else if (kind === "storm") { pill.classList.add("glow-purple","pulse"); }

  ico.textContent = icon;
  t.textContent = title;
  s.textContent = sub;
  r.textContent = rightText;
}

function computeSignal({ waveM, periodS, windKmh }) {
  // règles simples + lisibles (tu peux ajuster)
  const storm = (windKmh >= 30) || (waveM >= 3.8 && windKmh >= 18);
  if (storm) {
    return {
      kind: "storm",
      icon: "⛈",
      title: "TEMPÊTE",
      sub: "Conditions instables / vent fort — prudence.",
      right: "RISQUE"
    };
  }

  const must = (periodS >= 11 && windKmh <= 12 && waveM >= 1.4 && waveM <= 3.2);
  if (must) {
    return {
      kind: "must",
      icon: "🔥",
      title: "SESSION À PAS RATER",
      sub: "Période solide + vent raisonnable = window premium.",
      right: "GO"
    };
  }

  const good = (periodS >= 9 && windKmh <= 18 && waveM >= 1.0);
  if (good) {
    return {
      kind: "good",
      icon: "✅",
      title: "BONNE SESSION",
      sub: "Bonne base — choisis le bon spot (abrité si besoin).",
      right: "OK"
    };
  }

  return {
    kind: "watch",
    icon: "👀",
    title: "À SURVEILLER",
    sub: "Pas optimal — check vent & période avant d’y aller.",
    right: "WAIT"
  };
}

/* ----------------------------
   UI render
---------------------------- */
function applyTodayGlow(score) {
  const q = quality(score);
  const mod = $("module-today");
  if (!mod) return;
  mod.classList.remove("is-good","is-mid","is-bad","is-storm");
  mod.classList.add(`is-${q.css}`);
}

function renderToday(spot, marine, weather) {
  const mi = nearestIndex(marine.hourly.time);
  const wi = nearestIndex(weather.hourly.time);

  const waveM   = marine.hourly.wave_height?.[mi];
  const periodS = marine.hourly.wave_period?.[mi];
  const waveDir = marine.hourly.wave_direction?.[mi];

  const windKmh = weather.hourly.wind_speed_10m?.[wi];
  const windDir = weather.hourly.wind_direction_10m?.[wi];

  const score = scoreFrom(waveM || 0, periodS || 0, windKmh || 0);
  const q = quality(score);

  if ($("spot-title")) $("spot-title").textContent = spot.name;
  if ($("spot-sub")) $("spot-sub").textContent = "Conditions temps réel • mise à jour auto";

  $("k-swell").textContent   = (waveM != null) ? `${waveM.toFixed(1)} m` : "—";
  $("k-period").textContent  = (periodS != null) ? `${Math.round(periodS)} s` : "—";
  $("k-wind").textContent    = (windKmh != null) ? `${Math.round(windKmh)} km/h` : "—";
  $("k-winddir").textContent = (windDir != null) ? `${Math.round(windDir)}°` : "—";
  $("k-wavedir").textContent = (waveDir != null) ? `${Math.round(waveDir)}°` : "—";

  $("k-score").textContent   = `${score}/10`;
  $("k-quality").innerHTML   = `<span class="badge ${q.css}">${q.icon} ${q.tag}</span>`;

  applyTodayGlow(score);

  $("k-next-window").textContent =
    score >= 7 ? "Prochain bon créneau : fin d’après-midi (estimation)"
    : score >= 4 ? "Prochain bon créneau : à surveiller (estimation)"
    : "Prochain bon créneau : prudence / conditions instables";

  $("k-updated").textContent = `Maj : ${fmtUpdated(marine.hourly.time[mi])}`;

  // Signal session
  const sig = computeSignal({
    waveM: Number(waveM || 0),
    periodS: Number(periodS || 0),
    windKmh: Number(windKmh || 0)
  });
  setSignal(sig.kind, sig.icon, sig.title, sig.sub, `${score}/10`);

  // IMPORTANT : on NE TOUCHE PAS aux éléments de marée ici
  // (sinon ça écrase le timer)
}

function renderWeekVertical(marine, weather) {
  const box = $("week-vert");
  if (!box) return;

  const mh = marine.hourly;
  const wh = weather.hourly;
  box.innerHTML = "";

  const items = [];
  for (let i = 0; i < mh.time.length; i++) {
    const t = new Date(mh.time[i]);
    if (t.getHours() !== 14) continue; // lisible : snapshot 14h

    const j = i < wh.time.length ? i : wh.time.length - 1;

    const waveM = mh.wave_height?.[i];
    const periodS = mh.wave_period?.[i];
    const windKmh = wh.wind_speed_10m?.[j];

    const score = scoreFrom(waveM || 0, periodS || 0, windKmh || 0);
    const q = quality(score);

    items.push({ t, waveM, periodS, windKmh, score, q });
  }

  items.slice(0, 7).forEach((d, idx) => {
    const el = document.createElement("div");
    el.className = "week-daycard";
    el.innerHTML = `
      <div class="week-line1">
        <div class="week-date">${d.t.toLocaleDateString("fr-FR", { weekday:"long", day:"2-digit", month:"short" })}</div>
        <span class="badge ${d.q.css}">${d.q.icon} ${d.q.tag}</span>
      </div>
      <div class="week-mini">Score : <b>${d.score}/10</b></div>
      <div class="week-kpis">
        <span class="week-pill">🌊 ${d.waveM != null ? d.waveM.toFixed(1) : "—"} m</span>
        <span class="week-pill">⏱ ${d.periodS != null ? Math.round(d.periodS) : "—"} s</span>
        <span class="week-pill">💨 ${d.windKmh != null ? Math.round(d.windKmh) : "—"} km/h</span>
      </div>
    `;

    el.addEventListener("click", () => {
      const details = $("day-details");
      if (!details) return;
      details.innerHTML = `
        <div style="display:grid; gap:10px;">
          <div><span class="badge ${d.q.css}">${d.q.icon} ${d.q.tag}</span> • J+${idx}</div>
          <div><b>Vagues</b> : ${d.waveM != null ? d.waveM.toFixed(1) : "—"} m</div>
          <div><b>Période</b> : ${d.periodS != null ? Math.round(d.periodS) : "—"} s</div>
          <div><b>Vent</b> : ${d.windKmh != null ? Math.round(d.windKmh) : "—"} km/h</div>
        </div>
      `;
    });

    box.appendChild(el);
  });
}

/* ----------------------------
   Mini-map
---------------------------- */
let miniMap;
function initMiniMap(spot) {
  const el = $("mini-map");
  if (!el || typeof L === "undefined") return;

  if (miniMap) {
    miniMap.setView([spot.lat, spot.lon], 11);
    return;
  }

  miniMap = L.map("mini-map", { zoomControl: true, attributionControl: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(miniMap);

  miniMap.setView([spot.lat, spot.lon], 11);
  L.marker([spot.lat, spot.lon]).addTo(miniMap);

  setTimeout(() => miniMap.invalidateSize(), 250);
}

/* ----------------------------
   Main loader
---------------------------- */
async function loadAll() {
  const spot = getSpot();

  // Header links/buttons
  const cam = $("btn-camera");
  if (cam) {
    cam.href = window.OCEANLY?.cameraLinkFor ? window.OCEANLY.cameraLinkFor(spot) : `camera.html?spot=${encodeURIComponent(spot.slug)}`;
  }

  updateFavBtn(spot);

  // Fetch
  const [marine, weather] = await Promise.all([
    fetchMarine(spot.lat, spot.lon),
    fetchWeather(spot.lat, spot.lon)
  ]);

  renderToday(spot, marine, weather);
  renderWeekVertical(marine, weather);
  initMiniMap(spot);
}

document.addEventListener("DOMContentLoaded", () => {
  const spot = getSpot();

  // Fav click
  const favBtn = $("btn-fav");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFav(spot.slug);
      updateFavBtn(spot);
    });
  }

  // Refresh click
  const ref = $("btn-refresh");
  if (ref) ref.addEventListener("click", () => loadAll().catch(console.error));

  // Start
  loadAll().catch(console.error);

  // Marée approx (timer 1s)
  startApproxTideUI();

  // Auto refresh data
  setInterval(() => loadAll().catch(console.error), 10 * 60 * 1000);
});
