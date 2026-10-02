import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { fileStore, coverKey, validId } from "./_lib/stores.mjs";

export default async (req) => {
  if (req.method !== "DELETE") return methodNotAllowed("DELETE");
  const denied = requireAdmin(req); if (denied) return denied;
  const id = getQuery(req).get("id");
  if (!validId(id)) return json({ error: "Neispravan ID." }, 400);

  const store = fileStore();
  const { blobs } = await store.list({ prefix: `pdf/${id}/` });
  await Promise.all(blobs.map(({ key }) => store.delete(key)));
  await store.delete(coverKey(id));
  return json({ ok: true });
};
