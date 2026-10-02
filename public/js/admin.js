import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const CHUNK_SIZE = 3 * 1024 * 1024;
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const form = document.getElementById("uploadForm");
const dropZone = document.getElementById("dropZone");
const magazineInput = document.getElementById("magazineFile");
const coverInput = document.getElementById("coverFile");
const selectedFile = document.getElementById("selectedFile");
const coverPreview = document.getElementById("coverPreview");
const publishBtn = document.getElementById("publishBtn");
const progress = document.getElementById("uploadProgress");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");
const message = document.getElementById("uploadMessage");
const list = document.getElementById("adminList");
const logoutBtn = document.getElementById("logoutBtn");

let magazineFile = null;
let autoCoverBlob = null;
let manualCoverBlob = null;
let adminPage = 1;
const ADMIN_ITEMS_PER_PAGE = 3;

function notifyMagazineUpdate() {
  try {
    const channel = new BroadcastChannel("school-magazines");
    channel.postMessage({ type: "magazines-updated", at: Date.now() });
    channel.close();
  } catch {}
  try { localStorage.setItem("school-magazines-updated", String(Date.now())); } catch {}
}

const session = await fetch("/api/session").then(r => r.json()).catch(() => ({ authenticated: false }));
if (!session.authenticated) location.href = "/login.html";

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function setMagazine(file) {
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "pdf") {
    message.textContent = "Netlify verzija prima PDF fajlove. Izvezi časopis kao PDF i ubaci ga ovde.";
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    message.textContent = "PDF je veći od 100 MB. Smanji ga pre uploada.";
    return;
  }

  magazineFile = file;
  autoCoverBlob = null;
  manualCoverBlob = null;
  selectedFile.hidden = false;
  selectedFile.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${formatBytes(file.size)}</span>`;
  message.textContent = "";
  makePdfCover(file);
}

async function makePdfCover(file) {
  coverPreview.innerHTML = "<span>Priprema naslovnice...</span>";
  try {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const targetWidth = 1200;
    const viewport = page.getViewport({ scale: targetWidth / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    autoCoverBlob = await canvasToBlob(canvas, "image/webp", 0.9);
    showCover(autoCoverBlob);
  } catch (err) {
    console.warn(err);
    coverPreview.innerHTML = "<span>Automatska naslovnica nije uspela. Dodaj je ručno.</span>";
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Ne mogu da napravim naslovnicu.")), type, quality);
  });
}

async function normalizeCover(file) {
  const bitmap = await createImageBitmap(file);
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvasToBlob(canvas, "image/webp", 0.9);
}

function showCover(blob) {
  coverPreview.innerHTML = "";
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  img.onload = () => URL.revokeObjectURL(img.src);
  coverPreview.appendChild(img);
}

["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, e => {
  e.preventDefault();
  dropZone.classList.add("dragging");
}));
["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, e => {
  e.preventDefault();
  dropZone.classList.remove("dragging");
}));
dropZone.addEventListener("drop", e => setMagazine(e.dataTransfer.files?.[0]));
dropZone.addEventListener("click", () => magazineInput.click());
dropZone.addEventListener("keydown", e => { if (["Enter", " "].includes(e.key)) magazineInput.click(); });
magazineInput.addEventListener("change", () => setMagazine(magazineInput.files?.[0]));

coverInput.addEventListener("change", async () => {
  const file = coverInput.files?.[0];
  if (!file) return;
  try {
    manualCoverBlob = await normalizeCover(file);
    autoCoverBlob = null;
    showCover(manualCoverBlob);
  } catch (err) {
    message.textContent = "Naslovnica nije mogla da se obradi.";
  }
});

async function uploadOneChunk(id, file, index, total) {
  const start = index * CHUNK_SIZE;
  const end = Math.min(file.size, start + CHUNK_SIZE);
  const blob = file.slice(start, end, "application/octet-stream");
  const res = await fetch(`/api/upload-chunk?id=${encodeURIComponent(id)}&index=${index}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload dela ${index + 1}/${total} nije uspeo.`);
}

async function uploadChunks(id, file, onProgress) {
  const total = Math.ceil(file.size / CHUNK_SIZE);
  let nextIndex = 0;
  let done = 0;
  const workers = Math.min(3, total);

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= total) return;
      await uploadOneChunk(id, file, index, total);
      done++;
      onProgress(done, total);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return total;
}

async function uploadCover(id, blob) {
  if (!blob) return false;
  const res = await fetch(`/api/upload-cover?id=${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "image/webp" },
    body: blob,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload naslovnice nije uspeo.");
  return true;
}

async function cleanupUpload(id) {
  try { await fetch(`/api/upload-cleanup?id=${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch {}
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!magazineFile) {
    message.textContent = "Prvo dodaj PDF časopisa.";
    return;
  }

  const title = document.getElementById("title").value.trim();
  if (!title) return;

  const id = crypto.randomUUID();
  publishBtn.disabled = true;
  progress.hidden = false;
  progressBar.style.width = "2%";
  progressText.textContent = "Priprema uploada...";
  message.textContent = "";

  try {
    const totalChunks = await uploadChunks(id, magazineFile, (done, total) => {
      const pct = 5 + Math.round((done / total) * 78);
      progressBar.style.width = `${pct}%`;
      progressText.textContent = `Upload PDF-a: ${done} / ${total} delova`;
    });

    progressBar.style.width = "88%";
    progressText.textContent = "Čuvanje naslovnice...";
    await uploadCover(id, manualCoverBlob || autoCoverBlob);

    progressBar.style.width = "94%";
    progressText.textContent = "Objavljivanje...";
    const res = await fetch("/api/magazines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title,
        issue: document.getElementById("issue").value,
        date: document.getElementById("date").value,
        description: document.getElementById("description").value,
        fileName: magazineFile.name,
        fileSize: magazineFile.size,
        chunkCount: totalChunks,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Objavljivanje nije uspelo.");

    progressBar.style.width = "100%";
    progressText.textContent = "Objavljeno ✓";
    message.textContent = "Časopis je uspešno objavljen. Pripremam formu za sledeći broj...";

    // Obavesti javni dashboard (ako je otvoren u drugom tabu/prozoru)
    // i zatim osveži admin stranicu da prethodni PDF više ne ostane aktivan.
    notifyMagazineUpdate();
    setTimeout(() => location.reload(), 700);
  } catch (err) {
    console.error(err);
    message.textContent = err.message;
    progressText.textContent = "Greška";
    progressBar.style.width = "0";
    await cleanupUpload(id);
  } finally {
    publishBtn.disabled = false;
  }
});

async function loadList(page = adminPage) {
  const res = await fetch("/api/magazines");
  const items = await res.json();
  if (!items.length) {
    adminPage = 1;
    list.innerHTML = '<div class="empty-admin">Još nema objavljenih časopisa.</div>';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / ADMIN_ITEMS_PER_PAGE));
  adminPage = Math.max(1, Math.min(page, totalPages));
  const start = (adminPage - 1) * ADMIN_ITEMS_PER_PAGE;
  const visibleItems = items.slice(start, start + ADMIN_ITEMS_PER_PAGE);

  const cards = visibleItems.map(m => {
    const link = `/viewer.html?id=${encodeURIComponent(m.id)}`;
    const cover = m.coverUrl ? `<img src="${m.coverUrl}" alt="">` : `<div class="mini-fallback">ČASOPIS</div>`;
    return `<article class="admin-item" data-id="${m.id}">
      <div class="admin-thumb">${cover}</div>
      <div class="admin-item-info">
        <strong>${escapeHtml(m.title)}</strong>
        <span>${escapeHtml([m.issue, m.date].filter(Boolean).join(" • "))}</span>
      </div>
      <div class="admin-item-actions">
        <a href="${link}" target="_blank">Otvori</a>
        <button data-copy="${link}">Kopiraj link</button>
        <button class="danger" data-delete="${m.id}">Obriši</button>
      </div>
    </article>`;
  }).join("");

  let pager = "";
  if (totalPages > 1) {
    const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1)
      .map(p => `<button type="button" class="admin-page-btn${p === adminPage ? " active" : ""}" data-admin-page="${p}" aria-label="Strana ${p}">${p}</button>`)
      .join("");

    pager = `<nav class="admin-pagination" aria-label="Paginacija objavljenih časopisa">
      <button type="button" class="admin-page-btn admin-page-arrow" data-admin-page="${adminPage - 1}" ${adminPage === 1 ? "disabled" : ""}>←</button>
      ${pageButtons}
      <button type="button" class="admin-page-btn admin-page-arrow" data-admin-page="${adminPage + 1}" ${adminPage === totalPages ? "disabled" : ""}>→</button>
      <span class="admin-page-info">Prikazana 3 po stranici</span>
    </nav>`;
  }

  list.innerHTML = cards + pager;
}

const escapeHtml = (v = "") => String(v)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

list.addEventListener("click", async e => {
  const pageBtn = e.target.closest("[data-admin-page]");
  if (pageBtn && !pageBtn.disabled) {
    await loadList(Number(pageBtn.dataset.adminPage));
    list.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const copy = e.target.closest("[data-copy]");
  if (copy) {
    const url = new URL(copy.dataset.copy, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = "Kopirano ✓";
      setTimeout(() => copy.textContent = "Kopiraj link", 1200);
    } catch { prompt("Kopiraj link:", url); }
  }

  const del = e.target.closest("[data-delete]");
  if (del) {
    if (!confirm("Obrisati ovaj časopis?")) return;
    const res = await fetch(`/api/magazine?id=${encodeURIComponent(del.dataset.delete)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Brisanje nije uspelo.");
      return;
    }
    notifyMagazineUpdate();
    await loadList(adminPage);
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  location.href = "/login.html";
});

loadList();
