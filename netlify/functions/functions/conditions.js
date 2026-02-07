export default async (req) => {
  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) return json({ ok:false, error:"Missing lat/lon" }, 400);

    const key = process.env.STORMGLASS_API_KEY;
    if (!key) return json({ ok:false, error:"Missing STORMGLASS_API_KEY in Netlify env" }, 500);

    // 3 jours suffisent pour timer (prochaine pleine/basse mer)
    const start = new Date();
    const end = new Date(Date.now() + 3*24*60*60*1000);

    const api = new URL("https://api.stormglass.io/v2/tide/extremes/point");
    api.searchParams.set("lat", lat);
    api.searchParams.set("lng", lon);
    api.searchParams.set("start", String(Math.floor(start.getTime()/1000)));
    api.searchParams.set("end", String(Math.floor(end.getTime()/1000)));

    const r = await fetch(api.toString(), {
      headers: { "Authorization": key, "accept":"application/json" }
    });

    if (!r.ok) {
      const txt = await r.text().catch(()=> "");
      throw new Error(`Stormglass ${r.status} ${txt.slice(0,120)}`);
    }

    const data = await r.json();
    return json({ ok:true, data }, 200, 900); // cache 15 min
  } catch (e) {
    return json({ ok:false, error:String(e.message || e) }, 500);
  }
};

function json(body, status=200, cacheSeconds=0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store"
    }
  });
}
