(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initReveal() {
    const nodes = document.querySelectorAll(
      ".stats, .company-intro, .category-index, .popular-searches, .catalog-shell, .faq-section, .content-section, .article-card, .seo-hero, .seo-table-wrap, .cart-page-panel",
    );

    if (reduceMotion || !("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    nodes.forEach((node) => node.classList.add("reveal-on-scroll"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    nodes.forEach((node) => observer.observe(node));
    window.requestAnimationFrame(() => {
      nodes.forEach((node) => {
        if (node.classList.contains("is-visible")) return;
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
          node.classList.add("is-visible");
          observer.unobserve(node);
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }
})();
