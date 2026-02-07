/* =========================================================
   OCEANLY — ACTU
   - RSS via jina.ai proxy (compatible localhost)
   - 3 actus visibles minimum
   - refresh avec modal 5s
   ========================================================= */

const ACTU_SOURCES = [
  "https://www.surf-report.com/rss",
  "https://www.surfer.com/feed/"
];

const el = {
  grid: document.getElementById("actu-grid"),
  status: document.getElementById("actu-status"),
  prev: document.getElementById("actu-prev"),
  next: document.getElementById("actu-next"),
  refresh: document.getElementById("actu-refresh"),
  overlay: document.getElementById("refresh-overlay"),
  count: document.getElementById("refresh-count"),
};

let items = [];
let idx = 0;

function stripHtml(s){ return (s||"").replace(/<[^>]*>/g,"").trim(); }
function formatDate(d){
  try{
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
  }catch{return "";}
}

async function countdown5(){
  el.overlay.classList.remove("hidden");
  let n=5; el.count.textContent=String(n);
  await new Promise(res=>{
    const t=setInterval(()=>{
      n-=1; el.count.textContent=String(n);
      if(n<=0){clearInterval(t);res();}
    },1000);
  });
  el.overlay.classList.add("hidden");
}

async function fetchRss(url){
  const prox = "https://r.jina.ai/http://"+url.replace(/^https?:\/\//,"");
  const res = await fetch(prox,{cache:"no-store"});
  if(!res.ok) throw new Error("fetch failed");
  return res.text();
}

function parseRss(xmlText){
  const raw = xmlText;
  const start = raw.indexOf("<?xml");
  const xml = start >= 0 ? raw.slice(start) : raw;
  const doc = new DOMParser().parseFromString(xml,"text/xml");
  const its = Array.from(doc.querySelectorAll("item")).slice(0, 15);

  return its.map(it=>{
    const title = it.querySelector("title")?.textContent?.trim() || "Actu surf";
    const link = it.querySelector("link")?.textContent?.trim() || "#";
    const pubDate = it.querySelector("pubDate")?.textContent?.trim() || "";
    const desc = it.querySelector("description")?.textContent || "";
    const clean = stripHtml(desc).slice(0, 180);
    const enc = it.querySelector("enclosure");
    const img = enc?.getAttribute("url") || "";
    return { title, link, pubDate, desc:clean, img };
  });
}

function render3(){
  const view = items.slice(idx, idx+3);
  el.grid.innerHTML = "";
  view.forEach(a=>{
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
        </div>
      </div>
    `;
    el.grid.appendChild(card);
  });

  el.status.textContent = items.length
    ? `Actus: ${idx+1}–${Math.min(idx+3, items.length)} / ${items.length}`
    : "Aucune actu (sources indisponibles).";
}

async function load(){
  try{
    el.status.textContent = "Chargement des actus…";
    let all=[];
    for(const src of ACTU_SOURCES){
      try{
        const txt = await fetchRss(src);
        all = all.concat(parseRss(txt));
      }catch{}
    }
    if(!all.length){
      all = [{ title:"Actu indisponible (source/CORS)", link:"#", pubDate:new Date().toISOString(), desc:"Change les sources ACTU_SOURCES dans actu.js", img:"" }];
    }
    all.sort((a,b)=>new Date(b.pubDate)-new Date(a.pubDate));
    items = all.slice(0, 60);
    idx = 0;
    render3();
  }catch{
    el.status.textContent = "Impossible de récupérer les actus.";
  }
}

el.prev.addEventListener("click", ()=>{ idx = Math.max(0, idx-3); render3(); });
el.next.addEventListener("click", ()=>{ idx = Math.min(Math.max(0, items.length-3), idx+3); render3(); });

el.refresh.addEventListener("click", async ()=>{
  await countdown5();
  await load();
});

(function init(){
  document.body.style.paddingTop = "72px";
  load();
})();
