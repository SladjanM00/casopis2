import { getStore } from "@netlify/blobs";

export const CHUNK_SIZE = 3 * 1024 * 1024;
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

export function metaStore() {
  return getStore({ name: "school-magazines-meta", consistency: "strong" });
}

export function fileStore() {
  return getStore({ name: "school-magazines-files", consistency: "strong" });
}

export function magazineKey(id) {
  return `magazines/${id}.json`;
}

export function chunkKey(id, index) {
  return `pdf/${id}/chunk-${String(index).padStart(4, "0")}`;
}

export function coverKey(id) {
  return `covers/${id}`;
}

export function validId(value) {
  return /^[a-f0-9-]{36}$/i.test(String(value || ""));
}

export function publicMagazine(item) {
  if (!item) return item;
  return {
    id: item.id,
    title: item.title,
    issue: item.issue || "",
    date: item.date || "",
    description: item.description || "",
    createdAt: item.createdAt,
    type: "pdf",
    storage: "netlify-blobs",
    fileName: item.fileName || "magazine.pdf",
    fileSize: item.fileSize,
    chunkSize: item.chunkSize,
    chunkCount: item.chunkCount,
    coverUrl: item.hasCover ? `/api/cover?id=${encodeURIComponent(item.id)}` : null,
  };
}
