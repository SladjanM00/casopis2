import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { fileStore, chunkKey, validId } from "./_lib/stores.mjs";

export default async (req) => {
  if (req.method !== "GET") return methodNotAllowed("GET");
  const q = getQuery(req);
  const id = q.get("id");
  const index = Number(q.get("index"));
  if (!validId(id) || !Number.isInteger(index) || index < 0) return json({ error: "Neispravan zahtev." }, 400);

  const data = await fileStore().get(chunkKey(id, index), { type: "arrayBuffer" });
  if (!data) return json({ error: "Deo PDF-a nije pronađen." }, 404);

  return new Response(data, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(data.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
