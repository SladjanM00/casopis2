import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { fileStore, coverKey, validId } from "./_lib/stores.mjs";

export default async (req) => {
  if (req.method !== "GET") return methodNotAllowed("GET");
  const id = getQuery(req).get("id");
  if (!validId(id)) return json({ error: "Neispravan ID." }, 400);

  const entry = await fileStore().getWithMetadata(coverKey(id), { type: "arrayBuffer" });
  if (!entry) return json({ error: "Naslovnica nije pronađena." }, 404);

  const contentType = entry.metadata?.contentType || "image/webp";
  return new Response(entry.data, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
      etag: entry.etag,
    },
  });
};
