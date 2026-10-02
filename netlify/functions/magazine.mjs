import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { metaStore, fileStore, magazineKey, coverKey, validId, publicMagazine } from "./_lib/stores.mjs";

async function removeByPrefix(store, prefix) {
  const { blobs } = await store.list({ prefix });
  await Promise.all(blobs.map(({ key }) => store.delete(key)));
}

export default async (req) => {
  const id = getQuery(req).get("id");
  if (!validId(id)) return json({ error: "Neispravan ID časopisa." }, 400);

  if (req.method === "GET") {
    const item = await metaStore().get(magazineKey(id), { type: "json", consistency: "strong" });
    if (!item) return json({ error: "Časopis nije pronađen." }, 404);
    return json(publicMagazine(item));
  }

  if (req.method === "DELETE") {
    const denied = requireAdmin(req); if (denied) return denied;
    const meta = metaStore();
    const item = await meta.get(magazineKey(id), { type: "json", consistency: "strong" });
    if (!item) return json({ error: "Časopis nije pronađen." }, 404);

    const files = fileStore();
    await removeByPrefix(files, `pdf/${id}/`);
    await files.delete(coverKey(id));
    await meta.delete(magazineKey(id));
    return json({ ok: true });
  }

  return methodNotAllowed("GET, DELETE");
};
