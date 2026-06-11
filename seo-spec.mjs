// seo-spec.mjs — extracts structured specifications from FLAKS product names and
// builds SEO content (rich descriptions + characteristic tables) for each product.
//
// Pure module: no file I/O, no side effects. Parsing is done from the Russian name
// (most consistent source); display labels are provided in Ukrainian and Russian.
// Imported by build-seo.mjs and exercised by seo-spec.test.mjs.

const COMPANY_CITY = { ua: "Харкові", ru: "Харькове" };

// ---------------------------------------------------------------------------
// Tool kinds: purpose copy used to give every category a meaningful description.
// ---------------------------------------------------------------------------
const TOOL_KINDS = {
  tap: {
    ru: "Метчик", ua: "Мітчик",
    purposeRu: "нарезания внутренней метрической резьбы в отверстиях",
    purposeUa: "нарізання внутрішньої метричної різьби в отворах",
  },
  tapRoll: {
    ru: "Метчик-раскатник (бесстружечный)", ua: "Мітчик-розкатник (безстружковий)",
    purposeRu: "накатывания внутренней резьбы без снятия стружки в пластичных металлах",
    purposeUa: "накатування внутрішньої різьби без зняття стружки у пластичних металах",
  },
  tapNut: {
    ru: "Метчик гаечный", ua: "Мітчик гайковий",
    purposeRu: "нарезания резьбы в гайках и сквозных отверстиях с длинной заборной частью",
    purposeUa: "нарізання різьби в гайках і наскрізних отворах із довгою забірною частиною",
  },
  die: {
    ru: "Плашка", ua: "Плашка",
    purposeRu: "нарезания наружной резьбы на прутках, болтах и шпильках",
    purposeUa: "нарізання зовнішньої різьби на прутках, болтах і шпильках",
  },
  drill: {
    ru: "Сверло", ua: "Свердло",
    purposeRu: "сверления отверстий в металле",
    purposeUa: "свердління отворів у металі",
  },
  drillCenter: {
    ru: "Сверло центровочное", ua: "Свердло центрувальне",
    purposeRu: "выполнения центровых отверстий под установку детали в центрах",
    purposeUa: "виконання центрових отворів під встановлення деталі в центрах",
  },
  drillInsert: {
    ru: "Сверло с механическим креплением пластин", ua: "Свердло з механічним кріпленням пластин",
    purposeRu: "высокопроизводительного сверления отверстий сменными твердосплавными пластинами",
    purposeUa: "високопродуктивного свердління отворів змінними твердосплавними пластинами",
  },
  reamer: {
    ru: "Развёртка", ua: "Розгортка",
    purposeRu: "чистовой обработки и калибровки отверстий по точному размеру",
    purposeUa: "чистової обробки та калібрування отворів за точним розміром",
  },
  counterbore: {
    ru: "Зенкер", ua: "Зенкер",
    purposeRu: "чернового и получистового зенкерования отверстий под развёртывание",
    purposeUa: "чорнового та напівчистового зенкерування отворів під розгортання",
  },
  countersink: {
    ru: "Зенковка", ua: "Зенківка",
    purposeRu: "снятия фасок и обработки опорных поверхностей под головки крепежа",
    purposeUa: "зняття фасок та обробки опорних поверхонь під головки кріплення",
  },
  arbor: {
    ru: "Оправка", ua: "Оправка",
    purposeRu: "установки насадного инструмента — развёрток, зенкеров и фрез",
    purposeUa: "встановлення насадного інструмента — розгорток, зенкерів і фрез",
  },
  endmill: {
    ru: "Фреза концевая", ua: "Фреза кінцева",
    purposeRu: "фрезерования пазов, уступов, контуров и карманов",
    purposeUa: "фрезерування пазів, уступів, контурів і кишень",
  },
  discmill: {
    ru: "Фреза дисковая", ua: "Фреза дискова",
    purposeRu: "отрезки заготовок и прорезки пазов",
    purposeUa: "відрізання заготовок і прорізання пазів",
  },
  facemill: {
    ru: "Фреза торцевая", ua: "Фреза торцева",
    purposeRu: "торцевого фрезерования плоскостей",
    purposeUa: "торцевого фрезерування площин",
  },
  gearTool: {
    ru: "Зуборезный инструмент", ua: "Зуборізний інструмент",
    purposeRu: "нарезания зубьев зубчатых колёс",
    purposeUa: "нарізання зубів зубчастих коліс",
  },
  cutter: {
    ru: "Резец", ua: "Різець",
    purposeRu: "токарной обработки металла сменными режущими пластинами",
    purposeUa: "токарної обробки металу змінними різальними пластинами",
  },
  gauge: {
    ru: "Калибр", ua: "Калібр",
    purposeRu: "контроля размеров и резьбы деталей",
    purposeUa: "контролю розмірів і різьби деталей",
  },
  tool: {
    ru: "Металлорежущий инструмент", ua: "Металорізальний інструмент",
    purposeRu: "металлообработки",
    purposeUa: "металообробки",
  },
};

// ---------------------------------------------------------------------------
// Materials: code + human label + which metals the material is suited for.
// Order matters — more specific grades are tested first.
// ---------------------------------------------------------------------------
const MATERIALS = [
  { re: /Р6М5К5/i, code: "Р6М5К5", ru: "кобальтовая быстрорежущая сталь Р6М5К5", ua: "кобальтова швидкорізальна сталь Р6М5К5",
    cutsRu: "нержавеющих, жаропрочных и труднообрабатываемых сталей", cutsUa: "нержавіючих, жароміцних і важкооброблюваних сталей" },
  { re: /Р18/i, code: "Р18", ru: "быстрорежущая сталь Р18", ua: "швидкорізальна сталь Р18",
    cutsRu: "конструкционных и легированных сталей", cutsUa: "конструкційних і легованих сталей" },
  { re: /Р6М5/i, code: "Р6М5", ru: "быстрорежущая сталь Р6М5", ua: "швидкорізальна сталь Р6М5",
    cutsRu: "конструкционных и легированных сталей, чугуна и цветных металлов", cutsUa: "конструкційних і легованих сталей, чавуну та кольорових металів" },
  { re: /Р9/i, code: "Р9", ru: "быстрорежущая сталь Р9", ua: "швидкорізальна сталь Р9",
    cutsRu: "конструкционных и углеродистых сталей", cutsUa: "конструкційних і вуглецевих сталей" },
  { re: /HSS[-\s]?E\b/i, code: "HSS-E", ru: "кобальтовая сталь HSS-E", ua: "кобальтова сталь HSS-E",
    cutsRu: "нержавеющих и жаропрочных сталей", cutsUa: "нержавіючих і жароміцних сталей" },
  { re: /HSCO|HSS[-\s]?Co/i, code: "HSS-Co", ru: "кобальтовая сталь HSS-Co", ua: "кобальтова сталь HSS-Co",
    cutsRu: "нержавеющих и жаропрочных сталей", cutsUa: "нержавіючих і жароміцних сталей" },
  { re: /HSS/i, code: "HSS", ru: "быстрорежущая сталь HSS", ua: "швидкорізальна сталь HSS",
    cutsRu: "сталей и цветных металлов", cutsUa: "сталей та кольорових металів" },
  { re: /Т15К6/i, code: "Т15К6", ru: "твёрдый сплав Т15К6", ua: "твердий сплав Т15К6",
    cutsRu: "углеродистых и легированных сталей", cutsUa: "вуглецевих і легованих сталей" },
  { re: /Т5К10/i, code: "Т5К10", ru: "твёрдый сплав Т5К10", ua: "твердий сплав Т5К10",
    cutsRu: "сталей при черновой и прерывистой обработке", cutsUa: "сталей при чорновій та переривчастій обробці" },
  { re: /ВК8/i, code: "ВК8", ru: "твёрдый сплав ВК8", ua: "твердий сплав ВК8",
    cutsRu: "чугуна, закалённых и абразивных материалов", cutsUa: "чавуну, загартованих і абразивних матеріалів" },
  { re: /ВК6/i, code: "ВК6", ru: "твёрдый сплав ВК6", ua: "твердий сплав ВК6",
    cutsRu: "чугуна и цветных металлов", cutsUa: "чавуну та кольорових металів" },
];

const BRANDS = [
  "ТИЗ", "ВИЗ", "СИЗ", "ХИЗ", "МИЗ", "Владивосток", "Сестрорецк", "Фрезер", "Вильнюс",
  "Gühring", "Guhring", "Guehring", "Dormer", "Poldi", "Bucovice", "Бучовице", "Presto", "Большевик",
];

const ORIGINS = [
  { re: /Китай/i, ua: "Китай", ru: "Китай" },
  { re: /Болгари/i, ua: "Болгарія", ru: "Болгария" },
  { re: /Германи|Німеччин/i, ua: "Німеччина", ru: "Германия" },
  { re: /Япони|Японі/i, ua: "Японія", ru: "Япония" },
  { re: /Польщ|Польш/i, ua: "Польща", ru: "Польша" },
  { re: /Чехи|Чехі/i, ua: "Чехія", ru: "Чехия" },
  { re: /Венгри|Угорщин/i, ua: "Угорщина", ru: "Венгрия" },
  { re: /СССР|СРСР/i, ua: "СРСР", ru: "СССР" },
];

function num(value) {
  return value ? value.replace(",", ".") : value;
}

function detectKindId(product) {
  const slug = product.categorySlug || "";
  const text = `${product.nameRu || ""} ${product.nameUa || ""} ${product.sectionRu || ""}`;
  if (slug.startsWith("metchiki")) {
    if (/раскатник|бесстружеч|розкатник|безстружк/i.test(text)) return "tapRoll";
    if (slug === "metchiki-gaechnye" || /гаечн|гайков/i.test(text)) return "tapNut";
    return "tap";
  }
  if (slug === "plashki") return "die";
  if (slug === "kalibry") return "gauge";
  if (slug.startsWith("sverla")) {
    if (slug === "sverla-tsentrovochnye" || /центровочн|центрувальн/i.test(text)) return "drillCenter";
    if (/мех\.?\s*креплен|механическим креплен|механічним кріплен|многогранных пластин/i.test(text)) return "drillInsert";
    return "drill";
  }
  if (slug === "razvertki-zenkera-zenkovki") {
    if (/оправк/i.test(text)) return "arbor";
    if (/зенковк|зенківк/i.test(text)) return "countersink";
    if (/зенкер/i.test(text)) return "counterbore";
    if (/развертк|розгортк/i.test(text)) return "reamer";
    return "reamer";
  }
  if (slug === "frezy-kontsevye") return "endmill";
  if (slug === "frezy-diskovye") return "discmill";
  if (slug === "frezy-chervyachnye-dolbyaki-t-obr") {
    if (/резц|резец|різц|різець/i.test(text)) return "cutter";
    return "gearTool";
  }
  if (slug === "frezy-tortsevye-i-drugoe") {
    if (/резц|резец|різц|різець/i.test(text)) return "cutter";
    if (/торцев|торців/i.test(text)) return "facemill";
    return "endmill";
  }
  return "tool";
}

// ---------------------------------------------------------------------------
// parseSpecs — extract a structured spec set from a product.
// ---------------------------------------------------------------------------
export function parseSpecs(product) {
  const text = String(product.nameRu || product.nameUa || "");
  const kindId = detectKindId(product);

  // Shank diameter first, then strip it so it does not shadow the main diameter.
  const shankMatch =
    text.match(/(?:ф\s*хвостовика|фхвостовика|хвостовик[а-я]*\s*ф)\s*=?\s*(\d+(?:[.,]\d+)?)/i) ||
    text.match(/хвостовик[а-я]*\s*=?\s*(\d+(?:[.,]\d+)?)\s*мм/i);
  const shankDia = shankMatch ? num(shankMatch[1]) : "";
  const work = shankMatch ? text.replace(shankMatch[0], " ") : text;

  // Main diameter (ф / Ø / диаметр), not part of the shank.
  const diaMatch = work.match(/(?:ф|Ø|⌀|диаметр|діаметр)\s*=?\s*(\d+(?:[.,]\d+)?)/i);
  const diameter = diaMatch ? num(diaMatch[1]) : "";

  // Metric thread: М 12, М 2х0.4 (avoid Морзе "КМ1" via preceding-char guard).
  const metric = text.match(/(?:^|[\s(\/\\])М\s*(\d+(?:[.,]\d+)?)(?:\s*[хx]\s*(\d+(?:[.,]\d+)?))?/);
  // Inch / pipe / special thread systems.
  const special = text.match(/\b(UNC|UNF|UNEF|BSW|BSF|Rp|Rc|Rd|Тр|Tr)\s*\.?\s*(\d+(?:[\\/]\d+)?(?:[.,]\d+)?)/i) ||
    text.match(/\b(G|W|K)\s*(\d+(?:[\\/]\d+)?(?:[.,]\d+)?)/);
  let thread = "";
  let threadKind = "";
  if (metric) {
    thread = `M${num(metric[1])}${metric[2] ? `×${num(metric[2])}` : ""}`;
    threadKind = "metric";
  } else if (special) {
    thread = `${special[1]} ${special[2].replace("\\", "/")}`.trim();
    threadKind = "special";
  }
  const pitch = metric && metric[2] ? num(metric[2]) : "";
  const tpi = text.match(/(\d+)\s*нит(?:ок|ки|ь)?\s*на\s*дюйм/i)?.[1] || "";

  const materials = [];
  for (const m of MATERIALS) {
    if (m.re.test(text) && !materials.some((x) => x.code === m.code)) materials.push(m);
  }

  const morse = text.match(/КМ\s*(\d)/i)?.[1] || "";
  let shankType = "";
  if (/к[\\/]\s*х|конически/i.test(text)) shankType = "cone";
  else if (/ц[\\/]\s*х|цилиндрически/i.test(text)) shankType = "cyl";

  const teeth = text.match(/\bz\s*=?\s*(\d+)/i)?.[1] || "";
  // NB: JS \b is ASCII-only and never matches a Cyrillic boundary, so spec
  // markers in Cyrillic must be detected without \b (substring + morphology).
  const type = text.match(/тип\s*(\d+)/i)?.[1] || "";
  const ispolnenie = text.match(/исп\.?\s*(\d+)/i)?.[1] || "";
  const hand = /лев(?:ый|ая|ое|ые|ого|ом|им)|лів(?:ий|а|е|і)/i.test(text) ? "left" : (threadKind ? "right" : "");
  let hole = "";
  if (/глух/i.test(text)) hole = "blind";
  else if (/сквозн|наскрізн/i.test(text)) hole = "through";

  const lengthOverall = text.match(/L\s*(?:общ|заг)?\s*=?\s*(\d+(?:[.,]\d+)?)/i)?.[1] || "";
  // Disc-mill style dimensions next to the diameter: ф 22х1х8.
  const dims = diaMatch
    ? work.slice(diaMatch.index).match(/(\d+(?:[.,]\d+)?)\s*[хx]\s*(\d+(?:[.,]\d+)?)(?:\s*[хx]\s*(\d+(?:[.,]\d+)?))?/)
    : null;
  const dimensions = dims ? dims[0].replace(/\s+/g, "").replace(/х/gi, "×") : "";

  const brand = BRANDS.find((b) => new RegExp(b.replace("ü", "u").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text.replace("ü", "u"))) || "";
  const origin = ORIGINS.find((o) => o.re.test(text)) || null;
  const condition = /(?:^|[\s(])б\s*[\\/.]\s*у(?:[\s).,]|$)/i.test(text) ? "used" : "new";

  let series = "";
  if (/длин|довг/i.test(text)) series = "long";
  else if (/средн|серед/i.test(text)) series = "medium";
  const set = /комплект|к-т|комплект із|набор|набір/i.test(text);

  return {
    kindId, kind: TOOL_KINDS[kindId],
    diameter, shankDia, thread, threadKind, pitch, tpi,
    materials, morse, shankType, teeth, type, ispolnenie,
    hand, hole, lengthOverall, dimensions, brand, origin, condition, series, set,
  };
}

// ---------------------------------------------------------------------------
// buildSpecRows — characteristic table rows. Only present specs are emitted.
// Each row: { labelUa, labelRu, valueUa, valueRu }.
// ---------------------------------------------------------------------------
export function buildSpecRows(product, specs) {
  const rows = [];
  const push = (labelUa, labelRu, valueUa, valueRu = valueUa) => {
    if (valueUa || valueRu) rows.push({ labelUa, labelRu, valueUa, valueRu });
  };

  push("Тип інструменту", "Тип инструмента", specs.kind.ua, specs.kind.ru);
  push("Категорія", "Категория", product.categoryUa, product.categoryRu);
  if (specs.thread) push("Різьба", "Резьба", specs.thread, specs.thread);
  if (specs.pitch) push("Крок різьби", "Шаг резьбы", `${specs.pitch} мм`, `${specs.pitch} мм`);
  if (specs.tpi) push("Ниток на дюйм", "Ниток на дюйм", specs.tpi, specs.tpi);
  if (specs.diameter) push("Діаметр Ø", "Диаметр Ø", `${specs.diameter} мм`, `${specs.diameter} мм`);
  if (specs.dimensions && specs.dimensions !== `${specs.diameter}`) push("Розміри", "Размеры", `${specs.dimensions} мм`, `${specs.dimensions} мм`);
  if (specs.lengthOverall) push("Загальна довжина", "Общая длина", `${specs.lengthOverall} мм`, `${specs.lengthOverall} мм`);
  if (specs.teeth) push("Кількість зубів z", "Количество зубьев z", specs.teeth, specs.teeth);
  if (specs.materials.length) {
    const codes = specs.materials.map((m) => m.code).join(" / ");
    push("Матеріал", "Материал", codes, codes);
  }
  if (specs.shankType === "cone") push("Хвостовик", "Хвостовик", "конічний", "конический");
  else if (specs.shankType === "cyl") push("Хвостовик", "Хвостовик", "циліндричний", "цилиндрический");
  if (specs.morse) push("Конус Морзе", "Конус Морзе", `КМ${specs.morse}`, `КМ${specs.morse}`);
  if (specs.shankDia) push("Ø хвостовика", "Ø хвостовика", `${specs.shankDia} мм`, `${specs.shankDia} мм`);
  if (specs.hand === "left") push("Напрямок різьби", "Направление резьбы", "ліва", "левая");
  else if (specs.hand === "right") push("Напрямок різьби", "Направление резьбы", "права", "правая");
  if (specs.hole === "blind") push("Тип отвору", "Тип отверстия", "глухий", "глухой");
  else if (specs.hole === "through") push("Тип отвору", "Тип отверстия", "наскрізний", "сквозной");
  if (specs.ispolnenie) push("Виконання", "Исполнение", specs.ispolnenie, specs.ispolnenie);
  if (specs.type) push("Тип", "Тип", specs.type, specs.type);
  if (specs.brand) push("Виробник", "Производитель", specs.brand, specs.brand);
  if (specs.origin) push("Країна", "Страна", specs.origin.ua, specs.origin.ru);
  push("Стан", "Состояние", specs.condition === "used" ? "вживаний (б/в)" : "новий", specs.condition === "used" ? "б/у" : "новый");
  push("Код товару", "Код товара", product.sku, product.sku);
  push("Наявність", "Наличие", `${product.qty} шт.`, `${product.qty} шт.`);
  return rows;
}

function joinList(items, lang) {
  const and = lang === "ua" ? " та " : " и ";
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + and + items[items.length - 1];
}

// ---------------------------------------------------------------------------
// buildDescription — 300–800 char SEO description (plain text), per language.
// ---------------------------------------------------------------------------
export function buildDescription(product, specs, lang) {
  const ua = lang === "ua";
  const purpose = ua ? specs.kind.purposeUa : specs.kind.purposeRu;
  const name = (ua ? product.nameUa : product.nameRu) || product.nameRu;
  const price = Math.round(Number(product.price));
  const qty = product.qty;

  const sentences = [];

  // 1. What it is + purpose. The name already carries the tool kind, so we do
  // not repeat it; we lead with the full product name for keyword relevance.
  sentences.push(
    ua
      ? `${name} — професійний металорізальний інструмент для ${purpose}.`
      : `${name} — профессиональный металлорежущий инструмент для ${purpose}.`,
  );

  // 2. Key parameters.
  const params = [];
  if (specs.thread) params.push(ua ? `різьба ${specs.thread}` : `резьба ${specs.thread}`);
  if (specs.diameter) params.push(ua ? `діаметр Ø ${specs.diameter} мм` : `диаметр Ø ${specs.diameter} мм`);
  if (specs.dimensions && specs.dimensions !== specs.diameter) params.push(ua ? `розмір ${specs.dimensions} мм` : `размер ${specs.dimensions} мм`);
  if (specs.lengthOverall) params.push(ua ? `довжина ${specs.lengthOverall} мм` : `длина ${specs.lengthOverall} мм`);
  if (specs.teeth) params.push(ua ? `кількість зубів z${specs.teeth}` : `число зубьев z${specs.teeth}`);
  if (specs.morse) params.push(`КМ${specs.morse}`);
  else if (specs.shankType === "cone") params.push(ua ? "конічний хвостовик" : "конический хвостовик");
  else if (specs.shankType === "cyl") params.push(ua ? "циліндричний хвостовик" : "цилиндрический хвостовик");
  if (specs.hand === "left") params.push(ua ? "ліве виконання" : "левое исполнение");
  if (params.length) {
    sentences.push((ua ? "Основні параметри: " : "Основные параметры: ") + joinList(params, lang) + ".");
  }

  // 3. Material + which metals it machines.
  if (specs.materials.length) {
    const m = specs.materials[0];
    const matName = ua ? m.ua : m.ru;
    const cuts = ua ? m.cutsUa : m.cutsRu;
    sentences.push(
      ua
        ? `Виготовлено з матеріалу ${matName}, що забезпечує стійкість різальної кромки при обробці ${cuts}.`
        : `Изготовлен из материала ${matName}, что обеспечивает стойкость режущей кромки при обработке ${cuts}.`,
    );
  }

  // 4. Brand / origin trust signal.
  if (specs.brand || specs.origin) {
    const maker = specs.brand || (ua ? specs.origin.ua : specs.origin.ru);
    sentences.push(
      ua
        ? `Виробник: ${maker}. Інструмент перевірений і готовий до відвантаження.`
        : `Производитель: ${maker}. Инструмент проверен и готов к отгрузке.`,
    );
  }

  // 5. Commercial / availability (grounded facts only).
  sentences.push(
    ua
      ? `В наявності ${qty} шт. на складі у ${COMPANY_CITY.ua}. Ціна ${price} грн без ПДВ. Опт і роздріб, відправлення по всій Україні. Замовлення від 2 000 грн.`
      : `В наличии ${qty} шт. на складе в ${COMPANY_CITY.ru}. Цена ${price} грн без НДС. Опт и розница, отправка по всей Украине. Заказ от 2 000 грн.`,
  );

  let text = sentences.join(" ").replace(/\s+/g, " ").trim();
  // Keep within the 300–800 character target; pad short ones with a generic CTA.
  if (text.length < 300) {
    text += ua
      ? " Уточнюйте наявність, аналоги та технічні характеристики за телефоном або e-mail — допоможемо підібрати інструмент під вашу операцію."
      : " Уточняйте наличие, аналоги и технические характеристики по телефону или e-mail — поможем подобрать инструмент под вашу операцию.";
  }
  if (text.length > 800) text = text.slice(0, 797).replace(/\s+\S*$/, "") + "…";
  return text;
}

// Short meta description (<=160 chars) — single language, no cross-language mixing.
export function buildMetaDescription(product, specs, lang) {
  const ua = lang === "ua";
  const name = (ua ? product.nameUa : product.nameRu) || product.nameRu;
  const price = Math.round(Number(product.price));
  const tail = ua
    ? `Ціна ${price} грн без ПДВ, в наявності ${product.qty} шт. Доставка по Україні. Код ${product.sku}.`
    : `Цена ${price} грн без НДС, в наличии ${product.qty} шт. Доставка по Украине. Код ${product.sku}.`;
  let text = `${name}. ${tail}`;
  if (text.length > 165) text = text.slice(0, 162).replace(/\s+\S*$/, "") + "…";
  return text;
}

export { TOOL_KINDS };
