const $ = (id) => document.getElementById(id);

const el = {
  grid: $("actu-grid"),
  status: $("actu-status"),
  prev: $("actu-prev"),
  next: $("actu-next"),
  refresh: $("actu-refresh"),
  overlay: $("refresh-overlay"),
  count: $("refresh-count"),
};

let items = [];
let index = 0;

function formatDate(d) {
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("fr-FR", { dateStyle:"medium", timeStyle:"short" });
  } catch { return ""; }
}

function render() {
  if (!el.grid) return;
  const view = items.slice(index, index + 6);
  el.grid.innerHTML = "";

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
        </div>
      </div>
    `;
    el.grid.appendChild(card);
  });

  if (el.status) {
    el.status.textContent = items.length
      ? `Actus: ${index + 1}–${Math.min(index + 6, items.length)} / ${items.length}`
      : "Aucune actu pour le moment.";
  }
}

async function load() {
  try {
    if (el.status) el.status.textContent = "Chargement…";
    const r = await fetch("/.netlify/functions/news", { cache:"no-store" });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "news");
    items = (j.items || []).slice(0, 60);
    index = 0;
    render();
  } catch {
    if (el.status) el.status.textContent = "Impossible de récupérer les actus.";
  }
}

function countdownRefresh() {
  if (!el.overlay || !el.count) return load();
  el.overlay.classList.remove("hidden");
  let n = 3;
  el.count.textContent = String(n);
  const t = setInterval(() => {
    n -= 1;
    el.count.textContent = String(n);
    if (n <= 0) {
      clearInterval(t);
      el.overlay.classList.add("hidden");
      load();
    }
  }, 1000);
}

el.prev?.addEventListener("click", () => { index = Math.max(0, index - 6); render(); });
el.next?.addEventListener("click", () => { index = Math.min(Math.max(0, items.length - 6), index + 6); render(); });
el.refresh?.addEventListener("click", countdownRefresh);

document.addEventListener("DOMContentLoaded", async () => {
  await load();
  setInterval(load, 5 * 60 * 1000); // auto refresh
});
