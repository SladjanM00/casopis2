const form = document.getElementById("loginForm");
const errorEl = document.getElementById("loginError");

fetch("/api/session").then(r => r.json()).then(s => {
  if (s.authenticated) location.href = "/admin";
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  errorEl.textContent = "";
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Prijava...";

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("email").value,
        password: document.getElementById("password").value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Prijava nije uspela.");
    location.href = "/admin";
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = "Prijavi se";
  }
});
