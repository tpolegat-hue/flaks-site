// Generated pages have their language baked into the URL. Remember it so the
// hand-written pages (about, delivery, cart, articles) open in the same
// language. External file keeps the CSP free of inline scripts.
(() => {
  const lang = document.documentElement.lang === "ru" ? "ru" : "uk";
  try { localStorage.setItem("flaks-lang", lang); } catch { /* Storage may be blocked. */ }
})();
