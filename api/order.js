const TO_EMAIL = process.env.ORDER_TO_EMAIL || "tpolegat@gmail.com";
const RESEND_FROM = process.env.RESEND_FROM || "FLAKS <onboarding@resend.dev>";
const MIN_ORDER_TOTAL = 2000;

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

function validateOrder(body) {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return { ok: false, status: 400, message: "Invalid JSON" };
    }
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const normalizedItems = items
    .map((item) => {
      const stock = Math.max(0, Math.floor(toNumber(item.stock)));
      const requestQty = Math.max(1, Math.floor(toNumber(item.requestQty)));
      return {
        sku: cleanText(item.sku, 80),
        nameUa: cleanText(item.nameUa, 500),
        nameRu: cleanText(item.nameRu, 500),
        price: toNumber(item.price),
        stock,
        requestQty,
      };
    })
    .filter((item) => item.sku && item.price >= 0 && item.stock > 0 && item.requestQty > 0);

  if (!normalizedItems.length) {
    return { ok: false, status: 400, message: "Cart is empty" };
  }

  if (normalizedItems.some((item) => item.requestQty > item.stock)) {
    return { ok: false, status: 400, message: "Requested quantity exceeds stock" };
  }

  const total = normalizedItems.reduce((sum, item) => sum + item.price * item.requestQty, 0);
  if (total < MIN_ORDER_TOTAL) {
    return { ok: false, status: 400, message: "Minimum order total is 2000 UAH" };
  }

  const customer = {
    name: cleanText(body.customer?.name, 140),
    phone: cleanText(body.customer?.phone, 80),
    email: cleanText(body.customer?.email, 140),
    city: cleanText(body.customer?.city, 140),
    comment: cleanText(body.customer?.comment, 1200),
  };

  if (!customer.phone) {
    return { ok: false, status: 400, message: "Phone is required" };
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
    `${isRu ? "Дата" : "Дата"}: ${order.createdAt}`,
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
    throw new Error(`Resend error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function sendTelegram(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { skipped: true, reason: "Telegram is not configured" };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: orderText(order).slice(0, 3900),
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram error: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const parsed = validateOrder(request.body || {});
    if (!parsed.ok) {
      response.status(parsed.status).json({ error: parsed.message });
      return;
    }

    if (!process.env.RESEND_API_KEY && (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID)) {
      response.status(500).json({ error: "Order delivery is not configured" });
      return;
    }

    const deliveries = await Promise.allSettled([sendEmail(parsed.order), sendTelegram(parsed.order)]);
    const [emailResult, telegramResult] = deliveries.map((delivery) =>
      delivery.status === "fulfilled" ? delivery.value : { error: delivery.reason?.message || "Delivery failed" },
    );
    const delivered = [emailResult, telegramResult].some((result) => result && !result.skipped && !result.error);

    if (!delivered) {
      response.status(500).json({ error: "Order delivery failed", email: emailResult, telegram: telegramResult });
      return;
    }

    response.status(200).json({ ok: true, email: emailResult, telegram: telegramResult });
  } catch (error) {
    console.error(error);
    response.status(500).json({ error: "Order delivery failed" });
  }
};
