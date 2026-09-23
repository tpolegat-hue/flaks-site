(() => {
  const params = new URLSearchParams(window.location.search);
  let stored;
  try { stored = localStorage.getItem("flaks-lang"); } catch { /* Optional preference. */ }
  const initialLang = params.get("lang") === "ru" || params.get("lang") === "uk" ? params.get("lang") : stored === "ru" ? "ru" : "uk";

  function withLang(href, lang) {
    const url = new URL(href, window.location.href);
    if (lang === "ru") url.searchParams.set("lang", "ru");
    else url.searchParams.delete("lang");
    return url.pathname + url.search + url.hash;
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;
    try { localStorage.setItem("flaks-lang", lang); } catch { /* Optional preference. */ }
    // A reload must keep the language the visitor just selected.
    const currentUrl = new URL(window.location.href);
    if (lang === "ru") currentUrl.searchParams.set("lang", "ru");
    else currentUrl.searchParams.delete("lang");
    window.history.replaceState({}, "", currentUrl);

    document.querySelectorAll("[data-lang-content]").forEach((node) => {
      node.hidden = node.dataset.langContent !== lang;
    });

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.classList.toggle("active", button.dataset.lang === lang);
    });

    const title = document.body.dataset[lang === "ru" ? "titleRu" : "titleUk"];
    const description = document.body.dataset[lang === "ru" ? "descriptionRu" : "descriptionUk"];
    if (title) document.title = title;

    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) meta.setAttribute("content", description);

    document.querySelectorAll("a[data-keep-lang], .seo-table-wrap a").forEach((link) => {
      link.setAttribute("href", withLang(link.getAttribute("href"), lang));
    });

    window.dispatchEvent(new CustomEvent("flaks-lang-change", { detail: { lang } }));
  }

  document.querySelectorAll("[data-lang]").forEach((button) => {
    button.addEventListener("click", () => applyLang(button.dataset.lang));
  });

  applyLang(initialLang);
})();
