// spot.js — DA d'origine conservée + données temps réel (Open-Meteo)
// + Marée approximative (timer + montante/descendante)
// + Signal session (session à pas rater / tempête / etc.)
// Prérequis: spot.html charge data.js AVANT spot.js

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

/* ----------------------------
  Scoring + Qualité
---------------------------- */
// score simple mais stable (on ajuste ensuite si tu veux)
function scoreFrom(waveM, periodS, windKmh) {
  const s = (periodS * 0.7 + waveM * 1.2) - windKmh * 0.10;
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
  Marée approximative (timer)
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
  const rising = (halfIndex % 2) === 0;

  const pct = phase / TIDE_HALF_CYCLE_MS;
  const nextChange = new Date(now + remaining);

  return { rising, remaining, pct, nextChange };
}

let tideInterval;
function startApproxTideUI() {
  const box = $("k-tide");
  if (!box) return;

  const tick = () => {
    const t = approxTideState();
    const state = t.rising ? "Montante ⬆️" : "Descendante ⬇️";
    const hhmm = t.nextChange.toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="font-weight:950;">Marée</div>
        <div style="font-weight:950;">${state}</div>
      </div>
      <div style="margin-top:8px;opacity:.9;">
        Changement : <b>${hhmm}</b> <span class="tide-approx">≈ estimation</span>
      </div>
      <div style="margin-top:6px;font-weight:950;">
        Dans : ${msToHMS(t.remaining)}
      </div>
      <div style="margin-top:10px;height:10px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden;">
        <div style="height:100%;width:${Math.round(t.pct * 100)}%;border-radius:999px;background:rgba(168,85,247,.85);box-shadow:0 0 18px rgba(168,85,247,.25);"></div>
      </div>
      <div style="margin-top:8px;opacity:.78;font-size:12px;line-height:1.35;">
        Basé sur un cycle moyen (≈ 6h12). Vérifie un tableau local si session critique.
      </div>
    `;
  };

  if (tideInterval) clearInterval(tideInterval);
  tick();
  tideInterval = setInterval(tick, 1000);
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
  Signal session (LIVE)
---------------------------- */
function setSignal(kind, icon, title, sub, rightText) {
  const pill = $("signal-box");
  const ico  = $("signal-ico");
  const t    = $("signal-title");
  const s    = $("signal-sub");
  const r    = $("signal-right");
  if (!pill || !ico || !t || !s || !r) return;

  pill.classList.remove("glow-green","glow-cyan","glow-amber","glow-purple","pulse");

  if (kind === "must") pill.classList.add("glow-green","pulse");
  if (kind === "good") pill.classList.add("glow-cyan");
  if (kind === "watch") pill.classList.add("glow-amber");
  if (kind === "storm") pill.classList.add("glow-purple","pulse");

  ico.textContent = icon;
  t.textContent = title;
  s.textContent = sub;
  r.textContent = rightText;
}

// règles simples MAIS cohérentes (tu veux : “session à pas rater” quand c’est parfait)
function computeSignal({ waveM, periodS, windKmh, score }) {
  const storm = (windKmh >= 34) || (waveM >= 4.0);
  if (storm) {
    return {
      kind: "storm",
      icon: "⛈",
      title: "TEMPÊTE",
      sub: "Vent fort / grosse mer — prudence (niveau avancé).",
      right: `${score}/10`
    };
  }

  const must = (score >= 8 && periodS >= 10 && windKmh <= 14);
  if (must) {
    return {
      kind: "must",
      icon: "🔥",
      title: "SESSION À PAS RATER",
      sub: "Période solide + vent OK = fenêtre premium.",
      right: `${score}/10`
    };
  }

  const good = (score >= 6 && periodS >= 8 && windKmh <= 20);
  if (good) {
    return {
      kind: "good",
      icon: "✅",
      title: "BONNE SESSION",
      sub: "Bon potentiel — adapte le spot selon direction/vent.",
      right: `${score}/10`
    };
  }

  return {
    kind: "watch",
    icon: "👀",
    title: "À SURVEILLER",
    sub: "Pas optimal — check vent & période avant d’y aller.",
    right: `${score}/10`
  };
}

/* ----------------------------
  Map
---------------------------- */
let map;
function initMiniMap(spot) {
  const el = $("mini-map");
  if (!el || typeof L === "undefined") return;

  if (map) {
    map.setView([spot.lat, spot.lon], 11);
    return;
  }

  map = L.map("mini-map", { zoomControl: true, attributionControl: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  map.setView([spot.lat, spot.lon], 11);
  L.marker([spot.lat, spot.lon]).addTo(map);

  setTimeout(() => map.invalidateSize(), 250);
}

/* ----------------------------
  Render
---------------------------- */
function setQualityUI(q) {
  // k-quality = badge
  const el = $("k-quality");
  if (el) el.innerHTML = `<span class="badge ${q.css}">${q.icon} ${q.tag}</span>`;

  // live badge rouge lueur
  const live = $("live-badge");
  if (live) {
    live.className = `badge ${q.css}`;
    live.textContent = "LIVE";
  }
}

function renderToday(spot, marine, weather) {
  const mi = nearestIndex(marine.hourly.time);
  const wi = nearestIndex(weather.hourly.time);

  const waveM   = marine.hourly.wave_height?.[mi];
  const periodS = marine.hourly.wave_period?.[mi];
  const waveDir = marine.hourly.wave_direction?.[mi];

  const windKmh = weather.hourly.wind_speed_10m?.[wi];
  const windDir = weather.hourly.wind_direction_10m?.[wi];
  const tempC   = weather.hourly.temperature_2m?.[wi];

  const score = scoreFrom(waveM || 0, periodS || 0, windKmh || 0);
  const q = quality(score);

  $("spot-title").textContent = spot.name;
  $("spot-sub").textContent = "Conditions temps réel • mise à jour auto";

  setQualityUI(q);

  $("k-swell").textContent   = (waveM != null) ? `${waveM.toFixed(1)} m` : "—";
  $("k-period").textContent  = (periodS != null) ? `${Math.round(periodS)} s` : "—";
  $("k-wind").textContent    = (windKmh != null) ? `${Math.round(windKmh)} km/h` : "—";
  $("k-winddir").textContent = (windDir != null) ? `${Math.round(windDir)}°` : "—";
  $("k-wavedir").textContent = (waveDir != null) ? `${Math.round(waveDir)}°` : "—";

  // signal session
  const sig = computeSignal({
    waveM: Number(waveM || 0),
    periodS: Number(periodS || 0),
    windKmh: Number(windKmh || 0),
    score
  });
  setSignal(sig.kind, sig.icon, sig.title, sig.sub, sig.right);

  // prochain créneau (estimation simple)
  $("k-next-window").textContent =
    score >= 8 ? "Prochain bon créneau : maintenant (premium)"
    : score >= 6 ? "Prochain bon créneau : à surveiller (1–3h)"
    : sig.kind === "storm" ? "Prochain bon créneau : après la baisse du vent"
    : "Prochain bon créneau : à vérifier plus tard";

  // premium summary
  $("premium-summary").innerHTML = `
    <b>${sig.icon} ${sig.title}</b> — Score <b>${score}/10</b><br>
    🌊 ${waveM != null ? waveM.toFixed(1) : "—"} m • ⏱ ${periodS != null ? Math.round(periodS) : "—"} s • 💨 ${windKmh != null ? Math.round(windKmh) : "—"} km/h
  `;

  $("why-text").textContent =
    sig.kind === "must" ? "Période solide + vent modéré = énergie propre, meilleure forme des vagues."
    : sig.kind === "good" ? "Base correcte. La qualité dépend surtout du vent et du spot choisi."
    : sig.kind === "storm" ? "Vent fort / taille élevée = mer agitée, conditions difficiles."
    : "Conditions pas encore optimales. Surveille l’évolution du vent et de la période.";

  $("meteo-text").innerHTML = `Air : ${tempC != null ? Math.round(tempC) : "—"}°C<br>Vent : ${windKmh != null ? Math.round(windKmh) : "—"} km/h`;

  $("k-updated").textContent = `Maj : ${fmtUpdated(marine.hourly.time[mi])}`;

  // timeline premium (simple)
  $("timeline-box").innerHTML =
    `• Maintenant : ${sig.title}<br>` +
    `• +2h : re-check vent / période<br>` +
    `• Ce soir : si le vent baisse → qualité monte`;
}

function renderWeekStrip(marine, weather) {
  const strip = $("week-strip");
  if (!strip) return;

  const mh = marine.hourly;
  const wh = weather.hourly;

  strip.innerHTML = "";

  // un point par jour (14h) pour lisibilité
  const items = [];
  for (let i = 0; i < mh.time.length; i++) {
    const t = new Date(mh.time[i]);
    if (t.getHours() !== 14) continue;

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
    el.className = "week-day";
    el.innerHTML = `
      <div class="week-top">
        <div class="week-dow">${d.t.toLocaleDateString("fr-FR", { weekday:"short" })}</div>
        <span class="badge ${d.q.css}">${d.q.icon} ${d.q.tag}</span>
      </div>
      <div class="week-meta">
        🌊 ${d.waveM != null ? d.waveM.toFixed(1) : "—"} m<br>
        ⏱ ${d.periodS != null ? Math.round(d.periodS) : "—"} s<br>
        💨 ${d.windKmh != null ? Math.round(d.windKmh) : "—"} km/h<br>
        <b>Score:</b> ${d.score}/10
      </div>
    `;

    el.addEventListener("click", () => {
      const box = $("day-details");
      if (!box) return;
      box.innerHTML = `
        <b>J+${idx} — ${d.t.toLocaleDateString("fr-FR", { weekday:"long", day:"2-digit", month:"short" })}</b><br><br>
        🌊 <b>Vagues</b> : ${d.waveM != null ? d.waveM.toFixed(1) : "—"} m<br>
        ⏱ <b>Période</b> : ${d.periodS != null ? Math.round(d.periodS) : "—"} s<br>
        💨 <b>Vent</b> : ${d.windKmh != null ? Math.round(d.windKmh) : "—"} km/h<br>
        ⭐ <b>Score</b> : ${d.score}/10
      `;
    });

    strip.appendChild(el);
  });
}

/* ----------------------------
  Main
---------------------------- */
async function loadAll() {
  const spot = getSpot();

  // liens
  const cam = $("btn-camera");
  if (cam) cam.href = window.OCEANLY?.cameraLinkFor ? window.OCEANLY.cameraLinkFor(spot) : `camera.html?spot=${encodeURIComponent(spot.slug)}`;

  updateFavBtn(spot);

  const [marine, weather] = await Promise.all([
    fetchMarine(spot.lat, spot.lon),
    fetchWeather(spot.lat, spot.lon)
  ]);

  renderToday(spot, marine, weather);
  renderWeekStrip(marine, weather);
  initMiniMap(spot);
}

document.addEventListener("DOMContentLoaded", () => {
  const spot = getSpot();

  // favoris
  const favBtn = $("btn-fav");
  if (favBtn) {
    favBtn.addEventListener("click", () => {
      toggleFav(spot.slug);
      updateFavBtn(spot);
    });
  }

  // refresh
  const ref = $("btn-refresh");
  if (ref) ref.addEventListener("click", () => loadAll().catch(console.error));

  // start
  loadAll().catch(console.error);

  // marée approx (timer)
  startApproxTideUI();

  // auto refresh
  setInterval(() => loadAll().catch(console.error), 10 * 60 * 1000);
});
