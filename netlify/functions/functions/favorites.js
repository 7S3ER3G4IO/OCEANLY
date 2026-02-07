import { getStore } from "@netlify/blobs";

const favStore = getStore("oceanly-favorites");
const sessionsStore = getStore("oceanly-sessions");

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(data)
  };
}

async function getEmailFromAuth(event) {
  const token = (event.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const sess = await sessionsStore.get(token, { type: "json" });
  if (!sess) return null;

  if (sess.expiresAt && Date.now() > sess.expiresAt) return null;
  return sess.email || null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  const email = await getEmailFromAuth(event);
  if (!email) return json(401, { ok: false, error: "Non autorisé (token manquant/invalide)" });

  if (event.httpMethod === "GET") {
    const favs = (await favStore.get(email, { type: "json" })) || [];
    return json(200, { ok: true, favs });
  }

  if (event.httpMethod === "POST") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}

    const slug = (body.slug || "").trim();
    if (!slug) return json(400, { ok: false, error: "slug manquant" });

    const favs = (await favStore.get(email, { type: "json" })) || [];
    const idx = favs.indexOf(slug);
    let on;
    if (idx >= 0) { favs.splice(idx, 1); on = false; }
    else { favs.push(slug); on = true; }

    await favStore.setJSON(email, favs);
    return json(200, { ok: true, on, favs });
  }

  return json(405, { ok: false, error: "Method not allowed" });
}
