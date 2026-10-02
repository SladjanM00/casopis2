import crypto from "node:crypto";
import { json, methodNotAllowed } from "./_lib/http.mjs";
import { createSessionCookie, safeEqual } from "./_lib/auth.mjs";

const ADMIN_USERNAME = "adminskole";
const PASSWORD_SALT = "school-magazine-admin-v1";

function passwordHash(password) {
  return crypto
    .scryptSync(String(password ?? ""), PASSWORD_SALT, 64)
    .toString("hex");
}

export default async (req) => {
  if (req.method !== "POST") return methodNotAllowed("POST");

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neispravan zahtev." }, 400);
  }

  const expectedHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedHash) {
    return json({ error: "ADMIN_PASSWORD_HASH nije podešen na serveru." }, 500);
  }

  const usernameOk = safeEqual(body?.email, ADMIN_USERNAME);
  const passwordOk = safeEqual(passwordHash(body?.password), expectedHash);

  if (!usernameOk || !passwordOk) {
    return json({ error: "Pogrešni podaci za prijavu." }, 401);
  }

  return json({ ok: true }, 200, {
    "set-cookie": createSessionCookie(req),
  });
};
