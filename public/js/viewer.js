import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

const params = new URLSearchParams(location.search);
const id = params.get("id");

const titleEl = document.getElementById("viewerTitle");
const metaEl = document.getElementById("viewerMeta");
const loading = document.getElementById("loading");
const loadingTitle = document.getElementById("loadingTitle");
const loadingDetail = document.getElementById("loadingDetail");
const book = document.getElementById("book");
const stage = document.getElementById("bookStage");
const counter = document.getElementById("pageCounter");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const shareBtn = document.getElementById("shareBtn");

let pageFlip = null;
let currentPageIndex = 0;
let pdfDocument = null;
let pdfRatio = 210 / 297;
let pdfPages = [];
let resizeTimer = null;

async function load() {
  if (!id) throw new Error("Nije izabran časopis.");

  const res = await fetch(`/api/magazine?id=${encodeURIComponent(id)}`);
  const m = await res.json();
  if (!res.ok) throw new Error(m.error || "Časopis nije pronađen.");

  document.title = `${m.title}${m.issue ? " — " + m.issue : ""}`;
  titleEl.textContent = m.title;
  metaEl.textContent = [m.issue, m.date].filter(Boolean).join(" • ");

  const pdfBytes = await downloadPdf(m);
  await createPdfBook(pdfBytes);
  loading.style.display = "none";
}

async function downloadPdf(m) {
  const chunkCount = Number(m.chunkCount);
  const chunkSize = Number(m.chunkSize);
  const fileSize = Number(m.fileSize);
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || !Number.isFinite(fileSize) || fileSize <= 0) {
    throw new Error("Podaci o PDF-u nisu ispravni.");
  }

  loadingTitle.textContent = "Učitavanje časopisa...";
  const bytes = new Uint8Array(fileSize);
  let next = 0;
  let done = 0;
  const workers = Math.min(4, chunkCount);

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= chunkCount) return;

      const res = await fetch(`/api/file-chunk?id=${encodeURIComponent(m.id)}&index=${index}`);
      if (!res.ok) throw new Error(`Ne mogu da učitam deo PDF-a ${index + 1}/${chunkCount}.`);
      const buffer = await res.arrayBuffer();
      bytes.set(new Uint8Array(buffer), index * chunkSize);
      done++;
      loadingDetail.textContent = `Preuzimanje originalnog PDF-a: ${done} / ${chunkCount}`;
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return bytes;
}

async function createPdfBook(data) {
  loadingTitle.textContent = "Priprema HD prikaza...";
  loadingDetail.textContent = "Čitanje originalnog PDF-a";

  pdfDocument = await pdfjsLib.getDocument({ data }).promise;
  if (!pdfDocument.numPages) throw new Error("PDF nema stranice.");

  const firstPage = await pdfDocument.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  pdfRatio = firstViewport.width / firstViewport.height;
  firstPage.cleanup();

  book.innerHTML = "";
  pdfPages = [];

  for (let i = 0; i < pdfDocument.numPages; i++) {
    const pageEl = document.createElement("div");
    pageEl.className = "flip-page pdf-flip-page";
    pageEl.dataset.pageIndex = String(i);
    if (i === 0 || i === pdfDocument.numPages - 1) pageEl.dataset.density = "hard";

    const canvas = document.createElement("canvas");
    canvas.className = "pdf-page-canvas";
    canvas.width = 1;
    canvas.height = 1;
    canvas.setAttribute("aria-label", `Strana ${i + 1}`);

    const placeholder = document.createElement("div");
    placeholder.className = "pdf-page-placeholder";
    placeholder.textContent = `Strana ${i + 1}`;

    pageEl.append(canvas, placeholder);
    book.appendChild(pageEl);
    pdfPages.push({ element: pageEl, canvas, placeholder, renderTask: null, renderedWidth: 0, token: 0 });
  }

  createHtmlPageFlip(pdfPages.map(p => p.element), pdfRatio);
  await renderWindow(0, true);
}

function createHtmlPageFlip(elements, ratio) {
  const logicalWidth = 700;
  const logicalHeight = Math.round(logicalWidth / ratio);

  pageFlip = new St.PageFlip(book, {
    width: logicalWidth,
    height: logicalHeight,
    size: "stretch",
    minWidth: 280,
    maxWidth: 980,
    minHeight: 390,
    maxHeight: 1380,
    maxShadowOpacity: 0.44,
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: false,
    flippingTime: 650,
    drawShadow: true,
    autoSize: true,
  });

  pageFlip.loadFromHTML(elements);
  pageFlip.on("init", e => {
    currentPageIndex = Number(e?.data?.page ?? 0) || 0;
    updateCounter(currentPageIndex);
    renderWindow(currentPageIndex, true);
  });
  pageFlip.on("flip", e => {
    currentPageIndex = Number(e.data) || 0;
    updateCounter(currentPageIndex);
    renderWindow(currentPageIndex);
  });

  requestAnimationFrame(() => renderWindow(currentPageIndex, true));
}

function estimateCssPageWidth() {
  const stageRect = stage.getBoundingClientRect();
  const availableW = Math.max(stageRect.width - 24, 280);
  const availableH = Math.max(stageRect.height - 24, 390);
  const widthByHeight = availableH * pdfRatio;
  const twoPageWidth = Math.min(availableW / 2, widthByHeight);
  const onePageWidth = Math.min(availableW, widthByHeight);
  return availableW < 760 ? onePageWidth : twoPageWidth;
}

function targetCanvasWidth(pageInfo) {
  const rect = pageInfo.element.getBoundingClientRect();
  const cssWidth = rect.width > 80 ? rect.width : estimateCssPageWidth();
  const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
  const supersampling = 1.65;
  const wanted = Math.ceil(cssWidth * dpr * supersampling);
  return Math.max(1900, Math.min(wanted, 3600));
}

async function renderPdfPage(index, force = false) {
  const info = pdfPages[index];
  if (!info || !pdfDocument) return;

  const targetWidth = targetCanvasWidth(info);
  if (!force && info.renderedWidth >= targetWidth * 0.92) return;

  const token = ++info.token;
  if (info.renderTask) {
    try { info.renderTask.cancel(); } catch {}
    info.renderTask = null;
  }

  const page = await pdfDocument.getPage(index + 1);
  if (token !== info.token) { page.cleanup(); return; }

  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / base.width });
  const canvas = info.canvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  info.placeholder.classList.remove("hidden");

  const task = page.render({ canvasContext: ctx, viewport, intent: "display", background: "rgb(255,255,255)" });
  info.renderTask = task;

  try {
    await task.promise;
    if (token !== info.token) return;
    info.renderedWidth = canvas.width;
    info.placeholder.classList.add("hidden");
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") console.error(`Greška na strani ${index + 1}:`, error);
  } finally {
    if (info.renderTask === task) info.renderTask = null;
    page.cleanup();
  }
}

async function renderWindow(centerIndex, force = false) {
  if (!pdfDocument) return;
  const keep = new Set();
  for (let i = centerIndex - 2; i <= centerIndex + 3; i++) {
    if (i >= 0 && i < pdfPages.length) keep.add(i);
  }

  loadingDetail.textContent = `HD prikaz strane ${Math.min(centerIndex + 1, pdfPages.length)} / ${pdfPages.length}`;
  await Promise.all([...keep].map(i => renderPdfPage(i, force)));

  pdfPages.forEach((info, index) => {
    if (keep.has(index)) return;
    if (info.renderTask) {
      try { info.renderTask.cancel(); } catch {}
      info.renderTask = null;
    }
    info.token++;
    if (info.canvas.width > 1 || info.canvas.height > 1) {
      info.canvas.width = 1;
      info.canvas.height = 1;
      info.renderedWidth = 0;
      info.placeholder.classList.remove("hidden");
    }
  });
}

function updateCounter(index) {
  if (!pageFlip) return;
  counter.textContent = `Strana ${index + 1} / ${pageFlip.getPageCount()}`;
}

prevBtn.onclick = () => pageFlip?.flipPrev();
nextBtn.onclick = () => pageFlip?.flipNext();
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") pageFlip?.flipPrev();
  if (e.key === "ArrowRight") pageFlip?.flipNext();
});

fullscreenBtn.onclick = async () => {
  if (!document.fullscreenElement) await stage.requestFullscreen();
  else await document.exitFullscreen();
};

shareBtn.onclick = async () => {
  const data = { title: document.title, url: location.href };
  if (navigator.share) {
    try { await navigator.share(data); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(location.href);
    const old = shareBtn.textContent;
    shareBtn.textContent = "Link kopiran ✓";
    setTimeout(() => shareBtn.textContent = old, 1400);
  } catch { prompt("Kopiraj link:", location.href); }
};

function rerenderVisibleAfterLayoutChange() {
  if (!pdfDocument) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderWindow(currentPageIndex, true), 220);
}
window.addEventListener("resize", rerenderVisibleAfterLayoutChange);
document.addEventListener("fullscreenchange", () => setTimeout(() => renderWindow(currentPageIndex, true), 260));

load().catch(err => {
  console.error(err);
  loadingTitle.textContent = "Časopis nije moguće otvoriti";
  loadingDetail.textContent = err.message;
  document.querySelector(".spinner")?.remove();
});
