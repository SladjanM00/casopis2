import { json, methodNotAllowed } from "./_lib/http.mjs";
import { requireAdmin } from "./_lib/auth.mjs";
import {
  metaStore, fileStore, magazineKey, chunkKey, coverKey, validId,
  publicMagazine, CHUNK_SIZE, MAX_FILE_SIZE,
} from "./_lib/stores.mjs";

async function listMagazines() {
  const store = metaStore();
  const { blobs } = await store.list({ prefix: "magazines/" });
  const items = await Promise.all(blobs.map(({ key }) => store.get(key, { type: "json", consistency: "strong" })));
  return items.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(publicMagazine);
}

async function createMagazine(req) {
  const denied = requireAdmin(req); if (denied) return denied;

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Neispravan zahtev." }, 400); }

  const id = String(body?.id || "");
  const title = String(body?.title || "").trim().slice(0, 120);
  const issue = String(body?.issue || "").trim().slice(0, 80);
  const date = String(body?.date || "").trim().slice(0, 80);
  const description = String(body?.description || "").trim().slice(0, 700);
  const fileName = String(body?.fileName || "magazine.pdf").trim().slice(0, 180);
  const fileSize = Number(body?.fileSize);
  const chunkCount = Number(body?.chunkCount);

  if (!validId(id) || !title) return json({ error: "Nedostaje naziv ili je ID neispravan." }, 400);
  if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) return json({ error: "PDF je prevelik ili neispravan." }, 400);

  const expectedChunks = Math.ceil(fileSize / CHUNK_SIZE);
  if (!Number.isInteger(chunkCount) || chunkCount !== expectedChunks || chunkCount < 1) {
    return json({ error: "Broj delova PDF-a nije ispravan." }, 400);
  }

  const files = fileStore();
  const first = await files.getMetadata(chunkKey(id, 0), { consistency: "strong" });
  const last = await files.getMetadata(chunkKey(id, chunkCount - 1), { consistency: "strong" });
  if (!first || !last) return json({ error: "Upload PDF-a nije završen. Pokušaj ponovo." }, 400);

  const cover = await files.getMetadata(coverKey(id), { consistency: "strong" });
  const item = {
    id, title, issue, date, description, fileName, fileSize,
    chunkSize: CHUNK_SIZE,
    chunkCount,
    hasCover: Boolean(cover),
    createdAt: new Date().toISOString(),
  };

  await metaStore().setJSON(magazineKey(id), item, { onlyIfNew: true });
  return json(publicMagazine(item), 201);
}

export default async (req) => {
  if (req.method === "GET") return json(await listMagazines());
  if (req.method === "POST") return createMagazine(req);
  return methodNotAllowed("GET, POST");
};
