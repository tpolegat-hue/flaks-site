#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
STOP_WORDS = {"flaks", "kupiti", "kupit", "sht", "mm"}
CATEGORY_GROUP_RULES = {
    "metchiki-mr-metricheskie-pravye": ["metchiki mashinno-ruchnye metricheskie", "metchiki"],
    "metchiki-levye": ["metchiki levye", "metchiki"],
    "metchiki-mr-cherez-shag": ["metchiki mashinno-ruchnye metricheskie", "metchiki"],
    "metchiki-g-tr-k-rc-ktr": ["metchiki trubnye", "metchiki"],
    "metchiki-ruchnye": ["metchiki", "metchiki mashinno-ruchnye metricheskie"],
    "metchiki-trapetsiya-i-dr": ["metchiki dlya trapetseidalnoy rezby i drugoe", "metchiki"],
    "metchiki-gaechnye": ["metchiki", "metchiki mashinno-ruchnye metricheskie"],
    "plashki": ["plashki", "plashki kruglyy metricheskie", "plashki kruglye raznye"],
    "sverla-kkh": ["sverla s konicheskim khvostovikom", "sverla"],
    "sverla-kkh-tverdosplavnye": ["sverla kkh tverdosplavnye", "sverla"],
    "sverla-kkh-kitay": ["sverla s konicheskim khvostovikom", "sverla"],
    "sverla-tskh-srednie": ["sverla s tsilindricheskim khvostovikom pravye", "sverla"],
    "sverla-tskh-dlinnye": ["sverla s tsilindricheskim khvostovikom pravye", "sverla"],
    "sverla-tskh-levye": ["sverla s tsilindricheskim khvostovikom pravye", "sverla"],
    "sverla-tsentrovochnye": ["sverla", "sverdla po metallu"],
    "sverla-tverdosplavnye": ["sverla kkh tverdosplavnye", "sverla"],
    "frezy-kontsevye": ["frezy kontsevye s tsilindricheskim khvostovikom", "frezy kontsevye s konicheskim khvostovikom", "frezy"],
    "frezy-diskovye": ["frezy diskovye otreznye proreznye", "frezy"],
    "frezy-chervyachnye-dolbyaki-t-obr": ["frezy chervyachnye raznye dolbyaki raznye frezy t-obraznye", "frezy"],
    "frezy-tortsevye-i-drugoe": ["frezy", "frezy diskovye otreznye proreznye"],
    "razvertki-zenkera-zenkovki": ["razvertki zenkera zenkovki"],
}

TRANSLIT = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh", "з": "z",
    "и": "i", "і": "i", "ї": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch",
    "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya", "є": "e", "ґ": "g",
    "×": "x", "\\": " ", "/": " ", "-": " ", "_": " ", ",": " ", ".": " ", "(": " ", ")": " ",
})


def normalize(value):
    text = str(value or "").casefold().translate(TRANSLIT)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [token for token in text.split() if token not in STOP_WORDS]
    return " ".join(tokens)


def read_xlsx_rows(path, sheet_name):
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read(sheet_name))
    rows = []
    for row in root.findall(".//a:row", NS):
        values = {}
        for cell in row.findall("a:c", NS):
            match = re.match(r"([A-Z]+)", cell.attrib.get("r", ""))
            if not match:
                continue
            col = match.group(1)
            if cell.attrib.get("t") == "inlineStr":
                text = "".join(node.text or "" for node in cell.findall(".//a:t", NS))
            else:
                node = cell.find("a:v", NS)
                text = "" if node is None else node.text or ""
            values[col] = text
        rows.append(values)
    return rows


def read_site_data(path):
    text = path.read_text(encoding="utf-8-sig")
    text = re.sub(r"^window\.FLAKS_DATA\s*=\s*", "", text).rstrip().rstrip(";")
    return json.loads(text)


def image_urls(value):
    return [part.strip() for part in str(value or "").split(",") if part.strip().startswith("http")]


def extension_from_type(content_type, url):
    content_type = (content_type or "").lower()
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    if "gif" in content_type:
        return ".gif"
    if "jpeg" in content_type or "jpg" in content_type:
        return ".jpg"
    suffix = Path(urllib.parse.urlparse(url).path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ".jpg"


def download_image(url, out_dir, timeout=30):
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    cached = sorted(out_dir.glob(f"{digest}.*"))
    if cached:
        target = cached[0]
        return f"/assets/merchant-images/{target.name}", target.stat().st_size
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 FLAKS merchant feed"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read()
        ext = extension_from_type(response.headers.get("Content-Type"), url)
    filename = f"{digest}{ext}"
    target = out_dir / filename
    if not target.exists() or target.read_bytes() != data:
        target.write_bytes(data)
    return f"/assets/merchant-images/{filename}", len(data)


def main():
    parser = argparse.ArgumentParser(description="Build local Merchant Center image manifest from Prom.ua export.")
    parser.add_argument("--prom-xlsx", required=True, help="Path to Prom.ua XLSX export")
    parser.add_argument("--root", default=".", help="Site root")
    parser.add_argument("--limit", type=int, default=0, help="Optional max number of image URLs to download")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    data = read_site_data(root / "data.js")
    products = data["products"]
    categories = data["categories"]
    out_dir = root / "assets" / "merchant-images"
    out_dir.mkdir(parents=True, exist_ok=True)

    prom_product_rows = read_xlsx_rows(args.prom_xlsx, "xl/worksheets/sheet1.xml")[1:]
    prom_group_rows = read_xlsx_rows(args.prom_xlsx, "xl/worksheets/sheet2.xml")[1:]

    prom_by_title = {}
    for row in prom_product_rows:
        urls = image_urls(row.get("O"))
        if not urls:
            continue
        record = {"images": urls, "group": row.get("S", "")}
        for name in (row.get("B"), row.get("C")):
            key = normalize(name)
            if key and key not in prom_by_title:
                prom_by_title[key] = record

    group_images = {}
    for row in prom_group_rows:
        url = row.get("O", "").strip()
        if not url.startswith("http"):
            continue
        for name in (row.get("B"), row.get("C")):
            key = normalize(name)
            if key and key not in group_images:
                group_images[key] = url

    category_image_urls = {}
    for category in categories:
        for candidate in CATEGORY_GROUP_RULES.get(category["slug"], []):
            key = normalize(candidate)
            if key in group_images:
                category_image_urls[category["slug"]] = group_images[key]
                break

    product_image_candidates = {}
    exact_matches = 0
    category_matches = 0
    default_matches = 0
    for product in products:
        candidates = []
        for name in (product.get("nameRu"), product.get("nameUa")):
            record = prom_by_title.get(normalize(name))
            if record:
                candidates.append(record["images"][0])
                exact_matches += 1
                break
        category_image = category_image_urls.get(product.get("categorySlug"))
        if category_image and category_image not in candidates:
            candidates.append(category_image)
            if len(candidates) == 1:
                category_matches += 1
        if not candidates:
            default_matches += 1
        else:
            product_image_candidates[product["sku"]] = candidates

    unique_urls = sorted({url for urls in product_image_candidates.values() for url in urls} | set(category_image_urls.values()))
    if args.limit > 0:
        unique_urls = unique_urls[: args.limit]

    url_to_local = {}
    failures = {}
    for index, url in enumerate(unique_urls, 1):
        try:
            local_path, size = download_image(url, out_dir)
            url_to_local[url] = local_path
            print(f"[{index}/{len(unique_urls)}] {local_path} {size} bytes", flush=True)
        except Exception as error:
            failures[url] = str(error)
            print(f"[{index}/{len(unique_urls)}] FAILED {url}: {error}", file=sys.stderr, flush=True)
        time.sleep(0.05)

    manifest_products = {}
    for sku, urls in product_image_candidates.items():
        for url in urls:
            if url in url_to_local:
                manifest_products[sku] = url_to_local[url]
                break
    manifest_categories = {
        slug: url_to_local[url]
        for slug, url in category_image_urls.items()
        if url in url_to_local
    }

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": Path(args.prom_xlsx).name,
        "stats": {
            "siteProducts": len(products),
            "promProducts": len(prom_product_rows),
            "promTitlesWithImages": len(prom_by_title),
            "exactProductMatches": exact_matches,
            "categoryFallbackMatches": category_matches,
            "defaultFallbackMatches": default_matches,
            "categoryImages": len(manifest_categories),
            "productImages": len(manifest_products),
            "uniqueDownloadedImages": len(url_to_local),
            "failedDownloads": len(failures),
        },
        "products": manifest_products,
        "categoryFallbacks": manifest_categories,
        "failures": failures,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()