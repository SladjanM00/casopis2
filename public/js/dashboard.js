const grid = document.getElementById("magazineGrid");
const pagination = document.getElementById("pagination");
const emptyState = document.getElementById("emptyState");
const ITEMS_PER_PAGE = 4;
let magazines = [];
let currentPage = 1;

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function loadMagazines() {
  const res = await fetch("/api/magazines");
  if (!res.ok) throw new Error("Ne mogu da učitam časopise.");
  magazines = await res.json();

  // Najnoviji časopisi prvi, ako API vraća datum kreiranja.
  // Ako timestamp ne postoji, zadržava se redosled koji vraća API.
  magazines = magazines
    .map((m, index) => ({ ...m, __originalIndex: index }))
    .sort((a, b) => {
      const aTime = Date.parse(a.createdAt || a.created_at || a.publishedAt || "");
      const bTime = Date.parse(b.createdAt || b.created_at || b.publishedAt || "");
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return bTime - aTime;
      return a.__originalIndex - b.__originalIndex;
    });

  renderPage(1);
}

function card(m) {
  const url = `/viewer.html?id=${encodeURIComponent(m.id)}`;
  const cover = m.coverUrl
    ? `<img src="${m.coverUrl}" alt="${escapeHtml(m.title)}">`
    : `<div class="cover-fallback"><span>ŠKOLSKI<br>ČASOPIS</span></div>`;

  const el = document.createElement("article");
  el.className = "magazine-card";
  el.innerHTML = `
    <a class="cover-link" href="${url}"><div class="cover-frame">${cover}</div></a>
    <div class="card-content">
      <p class="card-date">${escapeHtml(m.date || "")}</p>
      <h2>${escapeHtml(m.title)}</h2>
      <p class="card-issue">${escapeHtml(m.issue || "")}</p>
      <p class="card-description">${escapeHtml(m.description || "")}</p>
      <div class="card-actions">
        <a class="primary-link" href="${url}">Otvori</a>
        <button class="copy-link-btn" data-url="${url}">Kopiraj link</button>
      </div>
    </div>`;
  return el;
}

function renderPage(page) {
  const totalPages = Math.max(1, Math.ceil(magazines.length / ITEMS_PER_PAGE));
  currentPage = Math.max(1, Math.min(page, totalPages));
  grid.innerHTML = "";

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  magazines.slice(start, start + ITEMS_PER_PAGE).forEach(m => grid.appendChild(card(m)));

  emptyState.hidden = magazines.length !== 0;
  pagination.hidden = totalPages <= 1;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  pagination.innerHTML = "";
  if (totalPages <= 1) return;

  const make = (label, page, active = false, disabled = false) => {
    const b = document.createElement("button");
    b.className = `page-btn${active ? " active" : ""}`;
    b.textContent = label;
    b.disabled = disabled;
    b.onclick = () => {
      renderPage(page);
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return b;
  };

  pagination.appendChild(make("←", currentPage - 1, false, currentPage === 1));
  for (let p = 1; p <= totalPages; p++) pagination.appendChild(make(String(p), p, p === currentPage));
  pagination.appendChild(make("→", currentPage + 1, false, currentPage === totalPages));
}

document.addEventListener("click", async e => {
  const btn = e.target.closest(".copy-link-btn");
  if (!btn) return;
  const url = new URL(btn.dataset.url, location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    const old = btn.textContent;
    btn.textContent = "Kopirano ✓";
    setTimeout(() => btn.textContent = old, 1400);
  } catch {
    prompt("Kopiraj link:", url);
  }
});

loadMagazines().catch(err => {
  grid.innerHTML = `<div class="error-card">${escapeHtml(err.message)}</div>`;
});


// Ako admin objavi ili obriše časopis u drugom tabu, javni dashboard se odmah osvežava.
try {
  const magazineChannel = new BroadcastChannel("school-magazines");
  magazineChannel.addEventListener("message", e => {
    if (e.data?.type === "magazines-updated") location.reload();
  });
} catch {}

window.addEventListener("storage", e => {
  if (e.key === "school-magazines-updated") location.reload();
});
