const TO_EMAIL = process.env.ORDER_TO_EMAIL || "tpolegat@gmail.com";
const RESEND_FROM = process.env.RESEND_FROM || "FLAKS <onboarding@resend.dev>";
const MIN_ORDER_TOTAL = 2000;
const MAX_ITEMS = 100;
const MAX_QTY = 10000;
// Generated from the same source as the storefront; never trust client prices.
const catalog = require("../lib/order-catalog.json");
// Окна два. Дешёвое считает любые обращения с адреса, строгое — только те, что
// дошли до реальной отправки письма и сообщения. Иначе покупатель, три раза
// споткнувшийся о валидацию, сжигал бы себе квоту на заказ.
const RATE_LIMITS = {
  attempt: { max: 30, windowMs: 15 * 60 * 1000, minGapMs: 2_000 },
  delivery: { max: 5, windowMs: 60 * 60 * 1000, minGapMs: 20_000 },
};
const RATE_LIMIT_MAX_KEYS = 5_000;
const rateLimitBuckets = new Map();

function toNumber(value) {
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
}

function cleanText(value, max = 600) {
  return String(value || "").trim().slice(0, max);
}

function money(value) {
  return new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH", maximumFractionDigits: 2 }).format(toNumber(value));
}

function clientIp(request) {
  // Node приводит имена заголовков к нижнему регистру; на Vercel x-forwarded-for
  // проставляет сама платформа, так что подделать его клиент не может.
  const forwarded = request.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers?.["x-real-ip"] || request.socket?.remoteAddress || "unknown";
}

// Скользящее окно, а не фиксированное: на стыке двух фиксированных окон можно
// было проскочить двойную порцию заявок подряд.
function checkRateLimit(bucketName, ip) {
  const rule = RATE_LIMITS[bucketName];
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  const times = (rateLimitBuckets.get(key) || []).filter((time) => now - time < rule.windowMs);
  const last = times[times.length - 1];

  let retryAfter = 0;
  if (last !== undefined && now - last < rule.minGapMs) {
    retryAfter = Math.ceil((rule.minGapMs - (now - last)) / 1000);
  } else if (times.length >= rule.max) {
    retryAfter = Math.max(1, Math.ceil((rule.windowMs - (now - times[0])) / 1000));
  }

  if (!retryAfter) times.push(now);
  rateLimitBuckets.set(key, times);

  return retryAfter ? { ok: false, retryAfter } : { ok: true };
}

const RATE_LIMIT_MAX_AGE_MS = Math.max(...Object.values(RATE_LIMITS).map((rule) => rule.windowMs));

function pruneRateLimitBuckets() {
  const now = Date.now();
  for (const [key, times] of rateLimitBuckets) {
    const last = times[times.length - 1];
    if (last === undefined || now - last >= RATE_LIMIT_MAX_AGE_MS) rateLimitBuckets.delete(key);
  }
  // Распределённый флуд наплодит ключей быстрее, чем они протухнут: держим потолок.
  while (rateLimitBuckets.size > RATE_LIMIT_MAX_KEYS) {
    rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
  }
}

function validateOrder(body) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, status: 400, message: "Invalid JSON" };
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, status: 400, message: "Invalid JSON" };
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length > MAX_ITEMS) {
    return { ok: false, status: 400, message: "Too many items" };
  }
  const normalizedItems = [];
  const seen = new Set();
  let changed = false;
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.sku !== "string") {
      return { ok: false, status: 400, message: "Invalid cart item" };
    }
    const product = Object.hasOwn(catalog, item.sku) ? catalog[item.sku] : null;
    if (!product || seen.has(item.sku)) {
      return { ok: false, status: 400, message: "Unknown or duplicate SKU" };
    }
    seen.add(item.sku);
    const requestQty = Number(item.requestQty);
    if (!["number", "string"].includes(typeof item.requestQty) || !Number.isInteger(requestQty) || requestQty < 1 || requestQty > MAX_QTY) {
      return { ok: false, status: 400, message: "Invalid quantity" };
    }
    const stock = Math.min(Math.floor(product.stock), MAX_QTY);
    if (stock < 1) return { ok: false, status: 400, message: "Product unavailable" };
    if (requestQty > stock || (item.price !== undefined && Number(item.price) !== product.price)) changed = true;
    normalizedItems.push({ sku: item.sku, ...product, stock, requestQty: Math.min(requestQty, stock) });
  }

  if (!normalizedItems.length) {
    return { ok: false, status: 400, message: "Cart is empty" };
  }

  if (changed) {
    return { ok: false, status: 409, message: "Catalog changed", items: normalizedItems };
  }

  const total = normalizedItems.reduce((sum, item) => sum + Math.round(item.price * 100) * item.requestQty, 0) / 100;
  if (total < MIN_ORDER_TOTAL) {
    return { ok: false, status: 400, message: "Minimum order total is 2000 UAH" };
  }

  const rawEmail = cleanText(body.customer?.email, 140);
  const customer = {
    name: cleanText(body.customer?.name, 140),
    phone: cleanText(body.customer?.phone, 80),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : "",
    city: cleanText(body.customer?.city, 140),
    comment: cleanText(body.customer?.comment, 1200),
  };

  if (!/^\+?[\d\s().-]+$/.test(customer.phone) || !/^\d{7,15}$/.test(customer.phone.replace(/\D/g, ""))) {
    return { ok: false, status: 400, message: "Invalid phone" };
  }

  return {
    ok: true,
    order: {
      language: body.language === "ru" ? "ru" : "uk",
      customer,
      items: normalizedItems,
      total,
      createdAt: new Date().toISOString(),
    },
  };
}

function orderText(order) {
  const isRu = order.language === "ru";
  const lines = [
    isRu ? "Новая заявка FLAKS" : "Нова заявка FLAKS",
    "",
    `${isRu ? "Язык" : "Мова"}: ${order.language.toUpperCase()}`,
    `Дата: ${order.createdAt}`,
    `${isRu ? "Имя" : "Ім'я"}: ${order.customer.name || "-"}`,
    `${isRu ? "Телефон" : "Телефон"}: ${order.customer.phone}`,
    `Email: ${order.customer.email || "-"}`,
    `${isRu ? "Город" : "Місто"}: ${order.customer.city || "-"}`,
    `${isRu ? "Комментарий" : "Коментар"}: ${order.customer.comment || "-"}`,
    "",
    `${isRu ? "Товары" : "Товари"}:`,
  ];

  order.items.forEach((item, index) => {
    lines.push(
      `${index + 1}. ${item.sku}`,
      `   ${isRu ? item.nameRu || item.nameUa : item.nameUa || item.nameRu}`,
      `   ${isRu ? "Цена" : "Ціна"}: ${money(item.price)}`,
      `   ${isRu ? "Наличие" : "Наявність"}: ${item.stock} шт.`,
      `   ${isRu ? "Заказано" : "Замовлено"}: ${item.requestQty} шт.`,
      `   ${isRu ? "Сумма" : "Сума"}: ${money(item.price * item.requestQty)}`,
      "",
    );
  });

  lines.push(`${isRu ? "Итого" : "Разом"}: ${money(order.total)}`);
  lines.push(
    "",
    isRu
      ? "Цены сверены с каталогом сайта. Наличие и резерв подтверждает менеджер."
      : "Ціни звірені з каталогом сайту. Наявність і резерв підтверджує менеджер.",
  );
  return lines.join("\n");
}

function orderHtml(order) {
  const text = orderText(order)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", "<br>");
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">${text}</div>`;
}

async function sendEmail(order) {
  if (!process.env.RESEND_API_KEY) {
    return { skipped: true, reason: "RESEND_API_KEY is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [TO_EMAIL],
      reply_to: order.customer.email || undefined,
      subject: `FLAKS: заявка ${order.items.length} поз., ${money(order.total)}`,
      text: orderText(order),
      html: orderHtml(order),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend HTTP ${response.status}`);
  }

  return response.json();
}

async function sendTelegram(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { skipped: true, reason: "Telegram is not configured" };
  }

  const text = orderText(order);
  // Large wholesale orders must not silently lose lines or their total.
  const attachment = text.length > 3900;
  let body;
  if (attachment) {
    body = new FormData();
    body.set("chat_id", chatId);
    body.set("caption", `FLAKS: ${order.items.length} поз., ${money(order.total)}`);
    body.set("document", new Blob([text], { type: "text/plain;charset=utf-8" }), "flaks-order.txt");
  } else {
    body = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true });
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${attachment ? "sendDocument" : "sendMessage"}`, {
    signal: AbortSignal.timeout(8000),
    method: "POST",
    ...(attachment ? {} : { headers: { "Content-Type": "application/json" } }),
    body,
  });

  if (!response.ok) {
    throw new Error(`Telegram HTTP ${response.status}`);
  }

  return response.json();
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    if (request.headers?.["sec-fetch-site"] === "cross-site") {
      response.status(403).json({ error: "Cross-site requests are not allowed" });
      return;
    }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers?.["content-type"] || "")) {
      response.status(415).json({ error: "Content-Type must be application/json" });
      return;
    }
    const bodyForCheck = typeof request.body === "string" ? request.body : JSON.stringify(request.body || {});
    if (Buffer.byteLength(bodyForCheck, "utf8") > 100_000) {
      response.status(413).json({ error: "Payload too large" });
      return;
    }
    // Считаем до honeypot, иначе бот, заполняющий ловушку, не ограничен ничем:
    // он получал 200 и уходил раньше, чем счётчик его видел.
    const ip = clientIp(request);
    const attempt = checkRateLimit("attempt", ip);
    if (!attempt.ok) {
      response.setHeader("Retry-After", String(attempt.retryAfter));
      response.status(429).json({ error: "Too many order attempts. Please try again later." });
      return;
    }
    pruneRateLimitBuckets();

    let body;
    try { body = JSON.parse(bodyForCheck); } catch {
      response.status(400).json({ error: "Invalid JSON" });
      return;
    }
    // Parse first so JSON strings cannot bypass the honeypot.
    if (body && body.website) {
      response.status(200).json({ ok: true });
      return;
    }

    const parsed = validateOrder(body);
    if (!parsed.ok) {
      response.status(parsed.status).json({ error: parsed.message, ...(parsed.items ? { items: parsed.items } : {}) });
      return;
    }

    if (!process.env.RESEND_API_KEY && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
      response.status(500).json({ error: "Order delivery is not configured" });
      return;
    }

    const deliveryLimit = checkRateLimit("delivery", ip);
    if (!deliveryLimit.ok) {
      response.setHeader("Retry-After", String(deliveryLimit.retryAfter));
      response.status(429).json({ error: "Too many order attempts. Please try again later." });
      return;
    }

    const deliveries = await Promise.allSettled([sendEmail(parsed.order), sendTelegram(parsed.order)]);
    const [emailResult, telegramResult] = deliveries.map((delivery) =>
      delivery.status === "fulfilled" ? delivery.value : { error: delivery.reason?.message || "Delivery failed" },
    );
    const delivered = [emailResult, telegramResult].some((result) => result && !result.skipped && !result.error);

    // Ответы Resend и Telegram наружу не отдаются: в сообщении об ошибке Resend
    // приходит сам API-ключ, а в успешном ответе Telegram — chat_id владельца.
    if (!delivered) {
      console.error("Order delivery failed", { email: emailResult?.skipped ? "skipped" : "failed", telegram: telegramResult?.skipped ? "skipped" : "failed" });
      response.status(500).json({ error: "Order delivery failed" });
      return;
    }

    response.status(200).json({ ok: true });
  } catch (error) {
    // Provider errors can contain tokens, addresses and request bodies.
    console.error("Order handler failed", error?.name || "Error");
    response.status(500).json({ error: "Order delivery failed" });
  }
};
