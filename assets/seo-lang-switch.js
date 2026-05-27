(() => {
  const params = new URLSearchParams(window.location.search);
  const stored = localStorage.getItem("flaks-lang");
  const initialLang = params.get("lang") === "ru" || params.get("lang") === "uk" ? params.get("lang") : stored === "ru" ? "ru" : "uk";

  function withLang(href, lang) {
    const url = new URL(href, window.location.href);
    if (lang === "ru") url.searchParams.set("lang", "ru");
    else url.searchParams.delete("lang");
    return url.pathname + url.search + url.hash;
  }

  function applyLang(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem("flaks-lang", lang);

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
