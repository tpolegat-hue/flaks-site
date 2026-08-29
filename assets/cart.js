(() => {
  const STORAGE_KEY = "flaks-cart";
  const SUCCESS_KEY = "flaks-cart-success";
  const MIN_ORDER_TOTAL = 2000;
  const TELEPHONE = "+380675453115";
  const EMAIL = "tpolegat@gmail.com";

  const texts = {
    uk: {
      cart: "Кошик",
      cartTitle: "Кошик-заявка",
      close: "Закрити",
      empty: "Кошик порожній. Додайте інструмент із каталогу.",
      add: "Додати в кошик",
      added: "Додано",
      checkout: "Оформити заявку",
      continue: "Продовжити вибір",
      clear: "Очистити",
      remove: "Видалити",
      total: "Разом",
      minimum: "Мінімальна сума замовлення 2 000 грн.",
      minimumLeft: "До мінімального замовлення залишилось",
      minimumReached: "Мінімальна сума досягнута",
      qty: "Кількість",
      stock: "Наявність",
      price: "Ціна без ПДВ",
      sku: "Код",
      name: "Ім'я",
      phone: "Телефон",
      email: "Email",
      city: "Місто",
      comment: "Коментар",
      phoneRequired: "Вкажіть телефон.",
      stockLimit: "Не можна замовити більше, ніж є на складі.",
      minOrderBlock: "Заявку можна відправити від 2 000 грн.",
      tooMany: "Забагато заявок з вашої адреси. Спробуйте за кілька хвилин або зателефонуйте нам.",
      submit: "Відправити заявку",
      sending: "Відправляємо...",
      sent: "Заявку відправлено. Ми зв'яжемося з вами найближчим часом.",
      sentTitle: "Заявку відправлено",
      failed: "Не вдалося відправити заявку. Спробуйте ще раз або напишіть на пошту.",
      call: "Зателефонувати",
      write: "Написати email",
    },
    ru: {
      cart: "Корзина",
      cartTitle: "Корзина-заявка",
      close: "Закрыть",
      empty: "Корзина пустая. Добавьте инструмент из каталога.",
      add: "Добавить в корзину",
      added: "Добавлено",
      checkout: "Оформить заявку",
      continue: "Продолжить выбор",
      clear: "Очистить",
      remove: "Удалить",
      total: "Итого",
      minimum: "Минимальная сумма заказа 2 000 грн.",
      minimumLeft: "До минимального заказа осталось",
      minimumReached: "Минимальная сумма достигнута",
      qty: "Количество",
      stock: "Наличие",
      price: "Цена без НДС",
      sku: "Код",
      name: "Имя",
      phone: "Телефон",
      email: "Email",
      city: "Город",
      comment: "Комментарий",
      phoneRequired: "Укажите телефон.",
      stockLimit: "Нельзя заказать больше, чем есть на складе.",
      minOrderBlock: "Заявку можно отправить от 2 000 грн.",
      tooMany: "Слишком много заявок с вашего адреса. Попробуйте через несколько минут или позвоните нам.",
      submit: "Отправить заявку",
      sending: "Отправляем...",
      sent: "Заявка отправлена. Мы свяжемся с вами в ближайшее время.",
      sentTitle: "Заявка отправлена",
      failed: "Не удалось отправить заявку. Попробуйте еще раз или напишите на почту.",
      call: "Позвонить",
      write: "Написать email",
    },
  };

  const money = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 });

  function lang() {
    const pageLang = document.documentElement.lang;
    if (pageLang === "ru" || pageLang === "uk") return pageLang;
    const params = new URLSearchParams(window.location.search);
    const queryLang = params.get("lang");
    if (queryLang === "ru" || queryLang === "uk") return queryLang;
    return localStorage.getItem("flaks-lang") === "ru" ? "ru" : "uk";
  }

  function t(key) {
    return texts[lang()][key] || key;
  }

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readSuccessMessage() {
    return sessionStorage.getItem(SUCCESS_KEY) === "1";
  }

  function setSuccessMessage(active) {
    if (active) sessionStorage.setItem(SUCCESS_KEY, "1");
    else sessionStorage.removeItem(SUCCESS_KEY);
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("flaks-cart-change"));
  }

  function toNumber(value) {
    const number = Number(String(value || "0").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function cleanQty(value, stock) {
    const requested = Math.max(1, Math.floor(toNumber(value)));
    return Math.min(requested, Math.max(0, Math.floor(toNumber(stock))));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function itemName(item) {
    return lang() === "uk" ? item.nameUa || item.nameRu : item.nameRu || item.nameUa;
  }

  function cartTotal(items = readCart()) {
    return items.reduce((sum, item) => sum + toNumber(item.price) * toNumber(item.requestQty), 0);
  }

  function cartCount(items = readCart()) {
    return items.reduce((sum, item) => sum + toNumber(item.requestQty), 0);
  }

  function addItem(product) {
    const stock = Math.floor(toNumber(product.stock));
    if (stock <= 0) return;
    setSuccessMessage(false);

    const items = readCart();
    const index = items.findIndex((item) => item.sku === product.sku);
    if (index >= 0) {
      items[index].requestQty = cleanQty(toNumber(items[index].requestQty) + 1, items[index].stock);
    } else {
      items.push({
        sku: product.sku,
        nameUa: product.nameUa,
        nameRu: product.nameRu,
        price: toNumber(product.price),
        stock,
        requestQty: 1,
      });
    }
    writeCart(items);
  }

  function updateQty(sku, qty) {
    const items = readCart();
    const item = items.find((entry) => entry.sku === sku);
    if (!item) return;
    item.requestQty = cleanQty(qty, item.stock);
    writeCart(items);
  }

  function removeItem(sku) {
    writeCart(readCart().filter((item) => item.sku !== sku));
  }

  function productFromButton(button) {
    return {
      sku: button.dataset.cartSku,
      nameUa: button.dataset.cartNameUa,
      nameRu: button.dataset.cartNameRu,
      price: button.dataset.cartPrice,
      stock: button.dataset.cartStock,
    };
  }

  function decorateButtons() {
    const items = readCart();
    document.querySelectorAll("[data-cart-add]").forEach((button) => {
      const inCart = items.some((item) => item.sku === button.dataset.cartSku);
      button.textContent = inCart ? t("added") : t("add");
      button.classList.toggle("is-added", inCart);
      button.disabled = toNumber(button.dataset.cartStock) <= 0;
    });
  }

  function drawerHtml() {
    return `<div class="cart-overlay" data-cart-close hidden></div>
      <aside class="cart-drawer" id="cartDrawer" aria-label="${escapeHtml(t("cartTitle"))}" hidden>
        <div class="cart-drawer-head">
          <div>
            <p class="eyebrow" data-cart-label="cart">${escapeHtml(t("cart"))}</p>
            <h2 data-cart-label="cartTitle">${escapeHtml(t("cartTitle"))}</h2>
          </div>
          <button class="icon-button" type="button" data-cart-close aria-label="${escapeHtml(t("close"))}">×</button>
        </div>
        <div class="cart-drawer-body" data-cart-drawer-body></div>
      </aside>
      <button class="cart-fab" type="button" data-cart-open aria-label="${escapeHtml(t("cart"))}">
        <span data-cart-label="cart">${escapeHtml(t("cart"))}</span>
        <strong data-cart-count>0</strong>
      </button>`;
  }

  function itemHtml(item) {
    return `<article class="cart-item" data-cart-item="${escapeHtml(item.sku)}">
      <div>
        <strong>${escapeHtml(itemName(item))}</strong>
        <small>${escapeHtml(t("sku"))}: ${escapeHtml(item.sku)} · ${escapeHtml(t("stock"))}: ${escapeHtml(item.stock)} шт.</small>
        <small>${escapeHtml(t("price"))}: ${escapeHtml(money.format(toNumber(item.price)))}</small>
      </div>
      <div class="cart-item-controls">
        <label>
          <span>${escapeHtml(t("qty"))}</span>
          <input type="number" min="1" max="${escapeHtml(item.stock)}" value="${escapeHtml(item.requestQty)}" data-cart-qty="${escapeHtml(item.sku)}">
        </label>
        <button type="button" class="secondary-button" data-cart-remove="${escapeHtml(item.sku)}">${escapeHtml(t("remove"))}</button>
      </div>
    </article>`;
  }

  function totalsHtml(items) {
    const total = cartTotal(items);
    const left = Math.max(0, MIN_ORDER_TOTAL - total);
    const minimumClass = total >= MIN_ORDER_TOTAL ? "cart-minimum ok" : "cart-minimum";
    return `<div class="cart-total">
      <span>${escapeHtml(t("total"))}</span>
      <strong>${escapeHtml(money.format(total))}</strong>
    </div>
    <p class="${minimumClass}">${escapeHtml(left > 0 ? `${t("minimum")} ${t("minimumLeft")}: ${money.format(left)}.` : t("minimumReached"))}</p>`;
  }

  // Форма верстается один раз и дальше не пересобирается, поэтому подписи
  // помечены ключами и переводятся на месте: собери её заново — и всё, что
  // человек уже вписал, пропадёт.
  function checkoutFormHtml() {
    return `<form class="cart-form" data-cart-form>
      <div class="form-grid">
        <label><span data-cart-text="name">${escapeHtml(t("name"))}</span><input name="name" autocomplete="name"></label>
        <label><span data-cart-text="phone" data-cart-text-required>${escapeHtml(t("phone"))} *</span><input name="phone" autocomplete="tel" required></label>
        <label><span data-cart-text="email">${escapeHtml(t("email"))}</span><input name="email" type="email" autocomplete="email"></label>
        <label><span data-cart-text="city">${escapeHtml(t("city"))}</span><input name="city" autocomplete="address-level2"></label>
      </div>
      <label><span data-cart-text="comment">${escapeHtml(t("comment"))}</span><textarea name="comment" rows="4"></textarea></label>
      <input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
      <button class="primary-button" type="submit" data-cart-text="submit" disabled>${escapeHtml(t("submit"))}</button>
      <p class="cart-status" data-cart-status></p>
    </form>`;
  }

  function translateForm(form) {
    form.querySelectorAll("[data-cart-text]").forEach((node) => {
      const label = t(node.dataset.cartText);
      node.textContent = node.hasAttribute("data-cart-text-required") ? `${label} *` : label;
    });
  }

  // Обновляет состояние существующей формы, не трогая введённые значения.
  function syncCheckoutForm(host, items) {
    if (!items.length) {
      host.innerHTML = "";
      return;
    }
    if (!host.querySelector("[data-cart-form]")) host.innerHTML = checkoutFormHtml();

    const form = host.querySelector("[data-cart-form]");
    translateForm(form);
    if (form.dataset.cartSubmitting === "1") return;

    const belowMinimum = cartTotal(items) < MIN_ORDER_TOTAL;
    form.querySelector("button[type='submit']").disabled = belowMinimum;

    // Сообщение о неудачной отправке держится до следующей попытки; всё
    // остальное место в строке статуса занимает подсказка про минимум.
    const status = form.querySelector("[data-cart-status]");
    if (status.dataset.cartSticky === "1") return;
    status.textContent = belowMinimum ? t("minOrderBlock") : "";
  }

  function cartBodyHtml(items, mode) {
    if (readSuccessMessage() && !items.length) {
      return `<div class="cart-success">
        <strong>${escapeHtml(t("sentTitle"))}</strong>
        <p>${escapeHtml(t("sent"))}</p>
      </div>
      <div class="hero-actions">
        <a class="primary-button" href="/index.html#catalog">${escapeHtml(t("continue"))}</a>
        <a class="secondary-button" href="tel:${TELEPHONE}">${escapeHtml(t("call"))}</a>
      </div>`;
    }

    if (!items.length) {
      return `<p class="cart-empty">${escapeHtml(t("empty"))}</p>
        <div class="hero-actions">
          <a class="primary-button" href="/index.html#catalog">${escapeHtml(t("continue"))}</a>
          <a class="secondary-button" href="tel:${TELEPHONE}">${escapeHtml(t("call"))}</a>
        </div>`;
    }

    return `<div class="cart-list">${items.map(itemHtml).join("")}</div>
      ${totalsHtml(items)}
      <div class="hero-actions">
        ${mode === "drawer" ? `<a class="primary-button" href="${cartPageHref()}">${escapeHtml(t("checkout"))}</a>` : ""}
        <button class="secondary-button" type="button" data-cart-clear>${escapeHtml(t("clear"))}</button>
      </div>`;
  }

  function cartContactHtml(items) {
    if (!items.length) return "";
    return `<div class="cart-quick-contact">
        <a href="tel:${TELEPHONE}">${escapeHtml(t("call"))}</a>
        <a href="mailto:${EMAIL}">${escapeHtml(t("write"))}</a>
      </div>`;
  }

  function renderCartSurface(target, mode = "drawer") {
    if (!target) return;
    const items = readCart();

    if (mode !== "page") {
      target.innerHTML = cartBodyHtml(items, mode) + cartContactHtml(items);
      return;
    }

    // Страница оформления разбита на три узла: перерисовывается только список,
    // форма между ними живёт своей жизнью.
    if (!target.querySelector("[data-cart-body]")) {
      target.innerHTML = `<div data-cart-body></div><div data-cart-form-host></div><div data-cart-contact></div>`;
    }

    const active = document.activeElement;
    const focusedSku = active && active.matches && active.matches("[data-cart-qty]") ? active.dataset.cartQty : null;

    target.querySelector("[data-cart-body]").innerHTML = cartBodyHtml(items, mode);
    syncCheckoutForm(target.querySelector("[data-cart-form-host]"), items);
    target.querySelector("[data-cart-contact]").innerHTML = cartContactHtml(items);

    if (focusedSku) target.querySelector(`[data-cart-qty="${CSS.escape(focusedSku)}"]`)?.focus();
  }

  function cartPageHref() {
    return lang() === "ru" ? "/cart.html?lang=ru" : "/cart.html";
  }

  function updateBadges() {
    document.querySelectorAll("[data-cart-count]").forEach((node) => {
      const previous = node.textContent;
      node.textContent = String(cartCount());
      if (previous !== node.textContent && node.textContent !== "0") {
        node.classList.remove("cart-count-pulse");
        window.requestAnimationFrame(() => node.classList.add("cart-count-pulse"));
      }
    });
  }

  function updateCartChrome() {
    document.querySelectorAll('[data-cart-label="cart"]').forEach((node) => {
      node.textContent = t("cart");
    });
    document.querySelectorAll('[data-cart-label="cartTitle"]').forEach((node) => {
      node.textContent = t("cartTitle");
    });
    document.querySelectorAll("[data-cart-open]").forEach((node) => {
      node.setAttribute("aria-label", t("cart"));
    });
    const drawer = document.querySelector("#cartDrawer");
    if (drawer) drawer.setAttribute("aria-label", t("cartTitle"));
  }

  function renderAll() {
    updateCartChrome();
    decorateButtons();
    updateBadges();
    renderCartSurface(document.querySelector("[data-cart-drawer-body]"), "drawer");
    renderCartSurface(document.querySelector("[data-cart-page]"), "page");
  }

  function openDrawer() {
    renderAll();
    document.querySelector(".cart-overlay")?.removeAttribute("hidden");
    document.querySelector(".cart-drawer")?.removeAttribute("hidden");
    document.body.classList.add("cart-open");
  }

  function closeDrawer() {
    document.querySelector(".cart-overlay")?.setAttribute("hidden", "");
    document.querySelector(".cart-drawer")?.setAttribute("hidden", "");
    document.body.classList.remove("cart-open");
  }

  async function submitOrder(form) {
    const status = form.querySelector("[data-cart-status]");
    const items = readCart();
    const total = cartTotal(items);
    const phone = new FormData(form).get("phone")?.toString().trim();
    delete status.dataset.cartSticky;

    if (!phone) {
      status.dataset.cartSticky = "1";
      status.textContent = t("phoneRequired");
      return;
    }
    if (total < MIN_ORDER_TOTAL) {
      status.textContent = t("minOrderBlock");
      return;
    }

    const formData = new FormData(form);
    const payload = {
      language: lang(),
      customer: {
        name: formData.get("name")?.toString().trim(),
        phone,
        email: formData.get("email")?.toString().trim(),
        city: formData.get("city")?.toString().trim(),
        comment: formData.get("comment")?.toString().trim(),
      },
      website: formData.get("website")?.toString() || "",
      items,
      total,
    };

    status.textContent = t("sending");
    form.dataset.cartSubmitting = "1";
    form.querySelector("button[type='submit']").disabled = true;

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // 429 — это не поломка, а лимит частоты: своё сообщение вместо технического.
      if (response.status === 429) {
        delete form.dataset.cartSubmitting;
        status.dataset.cartSticky = "1";
        status.textContent = t("tooMany");
        form.querySelector("button[type='submit']").disabled = false;
        return;
      }
      if (!response.ok) {
        let message = "";
        try { message = (await response.json()).error || ""; } catch {}
        throw new Error(message || "Order failed");
      }
      delete form.dataset.cartSubmitting;
      setSuccessMessage(true);
      form.reset();
      writeCart([]);
      renderAll();
      const pageStatus = document.querySelector("[data-cart-page-status]");
      if (pageStatus) pageStatus.textContent = t("sent");
    } catch (error) {
      delete form.dataset.cartSubmitting;
      status.dataset.cartSticky = "1";
      status.textContent = error && error.message && error.message !== "Order failed"
        ? `${t("failed")} (${error.message})`
        : t("failed");
      form.querySelector("button[type='submit']").disabled = false;
    }
  }

  function bind() {
    document.addEventListener("click", (event) => {
      const addButton = event.target.closest("[data-cart-add]");
      if (addButton) {
        event.preventDefault();
        addItem(productFromButton(addButton));
        openDrawer();
        return;
      }

      if (event.target.closest("[data-cart-open]")) {
        event.preventDefault();
        openDrawer();
        return;
      }

      if (event.target.closest("[data-cart-close]")) {
        event.preventDefault();
        closeDrawer();
        return;
      }

      const removeButton = event.target.closest("[data-cart-remove]");
      if (removeButton) {
        removeItem(removeButton.dataset.cartRemove);
        return;
      }

      if (event.target.closest("[data-cart-clear]")) {
        writeCart([]);
      }
    });

    document.addEventListener("input", (event) => {
      const input = event.target.closest("[data-cart-qty]");
      if (!input) return;
      const max = toNumber(input.getAttribute("max"));
      if (max > 0 && toNumber(input.value) > max) input.value = String(max);
    });

    document.addEventListener("change", (event) => {
      const input = event.target.closest("[data-cart-qty]");
      if (!input) return;
      updateQty(input.dataset.cartQty, input.value);
    });

    document.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-cart-form]");
      if (!form) return;
      event.preventDefault();
      submitOrder(form);
    });

    window.addEventListener("flaks-cart-change", renderAll);
    window.addEventListener("flaks-lang-change", renderAll);
    window.addEventListener("storage", renderAll);
  }

  function init() {
    document.body.insertAdjacentHTML("beforeend", drawerHtml());
    bind();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
