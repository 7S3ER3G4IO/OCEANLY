export default async (req) => {
  try {
    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) return json({ ok:false, error:"Missing lat/lon" }, 400);

    const api = new URL("https://marine-api.open-meteo.com/v1/marine");
    api.searchParams.set("latitude", lat);
    api.searchParams.set("longitude", lon);
    api.searchParams.set("hourly", [
      "wave_height",
      "wave_period",
      "wave_direction",
      "wind_wave_height",
      "wind_wave_period",
      "wind_wave_direction"
    ].join(","));
    api.searchParams.set("timezone", "Europe/Paris");

    const r = await fetch(api.toString(), { headers: { "accept":"application/json" }});
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    const data = await r.json();

    return json({ ok:true, data }, 200, 600); // cache 10 min
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
