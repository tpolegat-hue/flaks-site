"""Recompresses the product photos and rewrites the manifest to match.

The photos came off Prom.ua at full size: 356 files, 33.5 MB, ten of them over a
megabyte and the heaviest a 2.5 MB PNG — all displayed in a 360 px slot. One
photo is shared by up to 1471 products, so a single heavy file slows thousands
of pages, mobile visitors worst of all.

    python optimize-images.py            # dry run, prints what would change
    python optimize-images.py --write

Writes WebP at most MAX_SIDE px on the long side. WebP is served by every
current browser and accepted by Google Merchant Center.
"""

import json
import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
IMAGE_DIR = ROOT / "assets" / "merchant-images"
MANIFEST = IMAGE_DIR / "manifest.json"
MAX_SIDE = 600
QUALITY = 82

write = "--write" in sys.argv


def convert(source: Path) -> tuple[Path, int, int]:
    """Returns (new path, bytes before, bytes after)."""
    before = source.stat().st_size
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        # Flatten any transparency onto white: these are catalogue photos, and a
        # transparent PNG turned into WebP would otherwise show black edges.
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            flat = Image.new("RGB", image.size, (255, 255, 255))
            flat.paste(image, mask=image.split()[-1])
            image = flat
        else:
            image = image.convert("RGB")

        if max(image.size) > MAX_SIDE:
            ratio = MAX_SIDE / max(image.size)
            image = image.resize(
                (max(1, round(image.width * ratio)), max(1, round(image.height * ratio))),
                Image.LANCZOS,
            )

        if write:
            image.save(target, "WEBP", quality=QUALITY, method=6)
    after = target.stat().st_size if write and target.exists() else 0
    return target, before, after


def rewrite(value: str, mapping: dict[str, str]) -> str:
    return mapping.get(value, value)


def main() -> int:
    if not MANIFEST.exists():
        print(f"manifest not found: {MANIFEST}")
        return 1

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sources = sorted(p for p in IMAGE_DIR.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
    if not sources:
        print("nothing to convert")
        return 0

    mapping: dict[str, str] = {}
    total_before = total_after = 0
    for source in sources:
        target, before, after = convert(source)
        total_before += before
        total_after += after
        mapping[f"/assets/merchant-images/{source.name}"] = f"/assets/merchant-images/{target.name}"

    def fix_dict(section: str) -> None:
        if section in manifest and isinstance(manifest[section], dict):
            manifest[section] = {
                key: (
                    [rewrite(v, mapping) for v in value]
                    if isinstance(value, list)
                    else rewrite(value, mapping)
                )
                for key, value in manifest[section].items()
            }

    for section in ("products", "categoryFallbacks", "additionalProducts"):
        fix_dict(section)

    print(f"файлов: {len(sources)}")
    print(f"было : {total_before / 1024 / 1024:.1f} МБ")
    if write:
        print(f"стало: {total_after / 1024 / 1024:.1f} МБ  ({100 - total_after * 100 / total_before:.0f}% экономии)")
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
        for source in sources:
            source.unlink()
        print("манифест обновлён, исходники удалены")
    else:
        print("пробный прогон — запустите с --write")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
