/* camera.js — Caméras LIVE (liste + mapping correct) */

(function(){
  const SPOTS = window.OCEANLY?.SPOTS || [];
  const getSpotBySlug = window.OCEANLY?.getSpotBySlug;
  const cameraLinkFor = window.OCEANLY?.cameraLinkFor;

  const listEl = document.getElementById("camera-spot-list");
  const camName = document.getElementById("cam-name");
  const camMeta = document.getElementById("cam-meta");
  const camOpen = document.getElementById("cam-open");
  const camConditions = document.getElementById("cam-conditions");

  if (!listEl) return;

  function row(spot){
    const btn = document.createElement("button");
    btn.className = "spot-row2";
    btn.type = "button";
    btn.innerHTML = `
      <div class="spot-row2-top">
        <div class="spot-row2-name">${spot.name}</div>
        <div class="spot-row2-right">
          <span class="spot-status ok">LIVE</span>
        </div>
      </div>
      <div class="spot-row2-sub">${spot.region} • ${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}</div>
    `;
    btn.addEventListener("click", () => selectSpot(spot.slug, true));
    return btn;
  }

  function render(){
    listEl.innerHTML = "";
    SPOTS.forEach(s => listEl.appendChild(row(s)));
  }

  function selectSpot(slug, syncUrl){
    const spot = getSpotBySlug(slug);
    if (!spot) return;

    // UI active row
    document.querySelectorAll(".spot-row2").forEach(b => b.classList.remove("active"));
    // (simple : la classe active n’est pas obligatoire, mais tu peux la styler si tu veux)

    camName.textContent = spot.name;
    camMeta.textContent = `${spot.region} • ${spot.lat.toFixed(3)}, ${spot.lon.toFixed(3)}`;

    const link = cameraLinkFor(spot);
    camOpen.href = link;

    camConditions.href = `spot.html?spot=${encodeURIComponent(spot.slug)}`;

    if (syncUrl){
      const u = new URL(location.href);
      u.searchParams.set("spot", spot.slug);
      history.replaceState({}, "", u.toString());
    }
  }

  render();

  // auto-select si ?spot=...
  const params = new URLSearchParams(location.search);
  const slug = params.get("spot");
  if (slug) selectSpot(slug, false);
})();
