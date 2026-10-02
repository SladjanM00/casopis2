import { json, methodNotAllowed, getQuery } from "./_lib/http.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import { fileStore, chunkKey, validId, CHUNK_SIZE } from "./_lib/stores.mjs";

export default async (req) => {
  if (req.method !== "POST") return methodNotAllowed("POST");
  const denied = requireAdmin(req); if (denied) return denied;

  const q = getQuery(req);
  const id = q.get("id");
  const index = Number(q.get("index"));
  if (!validId(id) || !Number.isInteger(index) || index < 0 || index > 1000) {
    return json({ error: "Neispravan upload zahtev." }, 400);
  }

  const data = await req.arrayBuffer();
  if (!data.byteLength || data.byteLength > CHUNK_SIZE + 1024) {
    return json({ error: "Deo fajla je prevelik ili prazan." }, 413);
  }

  await fileStore().set(chunkKey(id, index), data, {
    metadata: { index, bytes: data.byteLength, uploadedAt: Date.now() },
  });

  return json({ ok: true, index, bytes: data.byteLength });
};
