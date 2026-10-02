import { json, methodNotAllowed } from "./_lib/http.mjs";
import { isAdmin } from "./_lib/auth.mjs";

export default async (req) => {
  if (req.method !== "GET") return methodNotAllowed("GET");
  return json({ authenticated: isAdmin(req) });
};
