import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { fileStore, coverKey, validId } from "./_lib/stores.mjs";

const ALLOWED = new Set(["image/webp", "image/png", "image/jpeg"]);

export default async (req) => {
  if (req.method !== "POST") return methodNotAllowed("POST");
  const denied = requireAdmin(req); if (denied) return denied;

  const id = getQuery(req).get("id");
  if (!validId(id)) return json({ error: "Neispravan ID." }, 400);

  const contentType = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED.has(contentType)) return json({ error: "Naslovnica mora biti PNG, JPG ili WebP." }, 400);

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > 2 * 1024 * 1024) {
    return json({ error: "Naslovnica je prevelika (maksimalno 2 MB)." }, 413);
  }

  await fileStore().set(coverKey(id), data, {
    metadata: { contentType, bytes: data.byteLength, uploadedAt: Date.now() },
  });
  return json({ ok: true });
};
