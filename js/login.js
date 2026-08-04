document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("staff-login-form");
  const status = document.getElementById("login-status");
  if (!form || !status) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    status.textContent = ""; status.className = "form-status"; button.disabled = true;
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ password: form.elements.password.value }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to sign in. Please try again.");
      const requested = new URLSearchParams(window.location.search).get("redirect");
      const safePath = requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/shift-notes.html";
      window.location.assign(safePath);
    } catch (error) {
      status.textContent = error.message; status.className = "form-status is-error"; button.disabled = false;
    }
  });
});
