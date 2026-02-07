import crypto from "crypto";
import { getStore } from "@netlify/blobs";

const usersStore = getStore("oceanly-users");
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

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const action = (body.action || "").toLowerCase();
  const email = (body.email || "").trim().toLowerCase();
  const password = (body.password || "").trim();

  if (!email || !password) return json(400, { ok: false, error: "Email et mot de passe requis" });

  if (action === "register") {
    const existing = await usersStore.get(email, { type: "json" });
    if (existing) return json(409, { ok: false, error: "Compte déjà existant" });

    await usersStore.setJSON(email, {
      email,
      pwHash: hashPassword(password),
      createdAt: Date.now()
    });

    // auto-login
    const token = makeToken();
    await sessionsStore.setJSON(token, {
      email,
      createdAt: Date.now(),
      // 30 jours
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    return json(200, { ok: true, email, token });
  }

  if (action === "login") {
    const user = await usersStore.get(email, { type: "json" });
    if (!user) return json(401, { ok: false, error: "Compte inconnu" });

    if (user.pwHash !== hashPassword(password)) {
      return json(401, { ok: false, error: "Mot de passe incorrect" });
    }

    const token = makeToken();
    await sessionsStore.setJSON(token, {
      email,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
    });

    return json(200, { ok: true, email, token });
  }

  return json(400, { ok: false, error: "Action invalide (register/login)" });
}
