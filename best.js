/* ===============================
   OCEANLY — best.js (UNIFIÉ)
   - Utilise window.OCEANLY.SPOTS (data.js)
   - Plus de liste spot différente
   =============================== */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const dom = {
    navbar: $("navbar"),
    name: $("best-spot-name"),
    tag: $("best-tag"),
    score: $("best-score"),
    swell: $("best-swell"),
    wind: $("best-wind"),
    openCond: $("best-open-conditions"),
    openCam: $("best-open-camera"),
    openMap: $("best-open-map"),
    toast: $("toast")
  };

  const LS_SCORES_CACHE = "oceanly:scores_cache";
  const LS_FOCUS_SPOT = "oceanly:focus_spot";

  const SPOTS = (window.OCEANLY && window.OCEANLY.SPOTS) ? window.OCEANLY.SPOTS : [];
  const getSpotBySlug = window.OCEANLY?.getSpotBySlug;

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

  function toast(msg){
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => dom.toast.classList.add("hidden"), 2200);
  }

  function initNavbarScroll(){
    if (!dom.navbar) return;
    const onScroll = () => dom.navbar.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
  }

  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  function safeJSONParse(v, fallback){
    try { return JSON.parse(v); } catch { return fallback; }
  }

  function scoreDay(wh, wp, wind, gust){
    if ((wind ?? 0) >= 35 || (gust ?? 0) >= 50 || (wh ?? 0) >= 3.5) {
      return { score: 0.0, label: "TEMPÊTE", icon: "🟣" };
    }

    let s = 0;
    if (wh < 0.4) s += 0.4;
    else if (wh < 0.8) s += 2.0;
    else if (wh < 1.5) s += 4.2;
    else if (wh < 2.5) s += 3.4;
    else s += 2.2;

    if (wp < 8) s += 0.6;
    else if (wp < 11) s += 2.0;
    else if (wp < 15) s += 3.4;
    else s += 4.0;

    if (wind < 10) s += 2.2;
    else if (wind < 18) s += 1.4;
    else if (wind < 26) s += 0.7;
    else s += 0.2;

    s -= Math.min(1.5, (gust || 0) / 35);

    const score = clamp(s, 0, 10);
    if (score >= 8.0) return { score, label: "À PAS RATER", icon: "🟢" };
    if (score >= 6.2) return { score, label: "BIEN", icon: "🔵" };
    if (score >= 4.6) return { score, label: "MOYEN", icon: "🟡" };
    return { score, label: "POURRI", icon: "🔴" };
  }

  async function fetchWithTimeout(url, ms = 14000){
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try{
      const res = await fetch(url, { cache:"no-store", signal: ctrl.signal });
      return res;
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchMarineDaily(lat, lon){
    const url = new URL("https://marine-api.open-meteo.com/v1/marine");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("timezone", "Europe/Paris");
    url.searchParams.set("forecast_days", "8");
    url.searchParams.set("daily", "wave_height_max,wave_period_max");
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error("marine");
    return res.json();
  }

  async function fetchWeatherDaily(lat, lon){
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("timezone", "Europe/Paris");
    url.searchParams.set("forecast_days", "8");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("daily", "wind_speed_10m_max,wind_gusts_10m_max");
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) throw new Error("weather");
    return res.json();
  }

  function pickSlug(){
    const fromUrl = getParam("spot");
    if (fromUrl) return fromUrl;

    const cached = safeJSONParse(localStorage.getItem(LS_SCORES_CACHE), null);
    if (cached?.results?.length) return cached.results[0].slug;

    return "lacanau-ocean";
  }

  function getSpot(slug){
    const s = getSpotBySlug ? getSpotBySlug(slug) : null;
    if (s) return s;
    return SPOTS[0] || { slug:"lacanau-ocean", name:"Lacanau Océan", lat:44.994, lon:-1.210, region:"Gironde" };
  }

  function wireButtons(spot){
    if (dom.openCond) dom.openCond.href = `spot.html?spot=${encodeURIComponent(spot.slug)}`;
    if (dom.openCam) dom.openCam.href = `camera.html?spot=${encodeURIComponent(spot.slug)}`;
    if (dom.openMap) {
      dom.openMap.addEventListener("click", () => {
        try { localStorage.setItem(LS_FOCUS_SPOT, spot.slug); } catch {}
        location.href = "index.html#map";
      });
    }
  }

  function render(spot, tag, wh, wp, wind, gust){
    if (dom.name) dom.name.textContent = `Spot #1 : ${spot.name}`;
    if (dom.tag) dom.tag.textContent = `${tag.icon} ${tag.label}`;
    if (dom.score) dom.score.textContent = `${tag.score.toFixed(1)}/10`;
    if (dom.swell) dom.swell.textContent = `${wh.toFixed(1)} m • ${wp.toFixed(0)} s`;
    if (dom.wind) dom.wind.textContent = `${wind.toFixed(0)} km/h • Raf ${gust.toFixed(0)} km/h`;
  }

  async function load(){
    initNavbarScroll();

    const slug = pickSlug();
    const spot = getSpot(slug);

    wireButtons(spot);

    const cached = safeJSONParse(localStorage.getItem(LS_SCORES_CACHE), null);
    const cachedRow = cached?.results?.find(r => r.slug === slug);
    if (cachedRow){
      render(
        spot,
        { icon: cachedRow.icon, label: cachedRow.label, score: cachedRow.score },
        cachedRow.wh ?? 0, cachedRow.wp ?? 0, cachedRow.wind ?? 0, cachedRow.gust ?? 0
      );
    }

    try{
      const [marine, weather] = await Promise.all([
        fetchMarineDaily(spot.lat, spot.lon),
        fetchWeatherDaily(spot.lat, spot.lon)
      ]);

      const wh = marine.daily?.wave_height_max?.[0] ?? 0;
      const wp = marine.daily?.wave_period_max?.[0] ?? 0;
      const wind = weather.daily?.wind_speed_10m_max?.[0] ?? 0;
      const gust = weather.daily?.wind_gusts_10m_max?.[0] ?? 0;

      const tag = scoreDay(wh, wp, wind, gust);
      render(spot, tag, wh, wp, wind, gust);
    } catch (e){
      console.error(e);
      toast("⚠️ Impossible de charger l'API — affichage cache si dispo.");
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();
