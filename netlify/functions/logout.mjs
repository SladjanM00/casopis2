import { json, methodNotAllowed } from "./_lib/http.mjs";
import { clearSessionCookie } from "./_lib/auth.mjs";

export default async (req) => {
  if (req.method !== "POST") return methodNotAllowed("POST");
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(req) });
};
