// Google Analytics 4. Kept in a file instead of an inline snippet so the same
// code is cached once for all 24k pages and the site can run a strict CSP
// without 'unsafe-inline'.
(() => {
  if (window.__flaksGaLoaded) return;
  window.__flaksGaLoaded = true;

  const id = "G-675L0XL19Y";
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);
})();
