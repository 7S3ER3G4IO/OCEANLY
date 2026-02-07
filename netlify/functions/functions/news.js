function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    },
    body: JSON.stringify(data)
  };
}

const SOURCES = [
  { name: "Surf-Report", url: "https://www.surf-report.com/rss" },
  { name: "Surfer", url: "https://www.surfer.com/feed/" }
];

// parsing simple RSS (suffisant pour une UI)
function stripHtml(s) { return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function parseItems(xml, sourceName) {
  const items = [];
  const chunks = xml.split(/<item>/i).slice(1);
  for (const c of chunks) {
    const part = c.split(/<\/item>/i)[0] || "";
    const title = stripHtml(getTag(part, "title"));
    const link = stripHtml(getTag(part, "link"));
    const pubDate = stripHtml(getTag(part, "pubDate")) || "";
    const descRaw = getTag(part, "description");
    const desc = stripHtml(descRaw).slice(0, 180);
    if (title && link) items.push({ title, link, pubDate, desc, source: sourceName });
  }
  return items;
}

export async function handler() {
  try {
    const all = [];
    for (const s of SOURCES) {
      try {
        const r = await fetch(s.url, { headers: { "user-agent": "OCEANLY/1.0" } });
        const text = await r.text();
        all.push(...parseItems(text, s.name));
      } catch {}
    }

    // tri par date si possible
    all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return json(200, { ok: true, items: all.slice(0, 30) });
  } catch (e) {
    return json(500, { ok: false, error: String(e) });
  }
}
