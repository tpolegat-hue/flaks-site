// Loads the 6.8 MB catalog and the interactive search only when they are
// needed: the catalog anchor, a search query, or the first interaction with a
// filter. Extracted from index.html so the page needs no inline JavaScript.
(() => {
  // The hashed data file name lives in the script tag so build-seo.mjs can keep
  // it in sync with data.js without rewriting this file.
  const scriptTag = document.currentScript || document.querySelector("[data-catalog-data]");
  const dataFile = scriptTag?.dataset.catalogData || "data.js";
  const scripts = [dataFile, "app.js"];
  let loading;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function loadCatalog() {
    if (!loading) {
      loading = scripts.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve());
    }
    return loading;
  }

  function handleCatalogTrigger(event) {
    const node = event.currentTarget;
    const replayClick = event.type === "click" && node.matches("[data-lang], [data-view], #resetFilters");
    if (replayClick) event.preventDefault();
    loadCatalog().then(() => {
      if (replayClick) node.click();
    });
  }

  document.querySelectorAll('a[href="#catalog"], a[href$="#catalog"], input, select, [data-lang], [data-view], #resetFilters').forEach((node) => {
    node.addEventListener("pointerenter", handleCatalogTrigger, { once: true, passive: true });
    node.addEventListener("focus", handleCatalogTrigger, { once: true, passive: true });
    node.addEventListener("click", handleCatalogTrigger, { once: true });
  });

  const params = new URLSearchParams(window.location.search);
  let initialLang = params.get("lang");
  if (initialLang !== "uk" && initialLang !== "ru") {
    try { initialLang = localStorage.getItem("flaks-lang"); } catch { /* Optional preference. */ }
  }
  if (initialLang === "ru") {
    document.querySelectorAll("a[data-keep-lang]").forEach((link) => {
      const url = new URL(link.getAttribute("href"), window.location.href);
      url.searchParams.set("lang", "ru");
      link.setAttribute("href", url.pathname + url.search + url.hash);
    });
  }
  if (window.location.hash === "#catalog" || params.has("q")) {
    loadCatalog();
  }
})();
