"""Re-encode the source sticker losslessly; requires Pillow with WebP support."""
from pathlib import Path
from hashlib import sha256
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "assets/source/wheel.png"
target = root / "public/stickers/wheel.webp"
image = Image.open(source)
pixels = image.convert("RGBA").tobytes()
image.save(target, format="WEBP", lossless=True, quality=100, method=6,
           exact=True, icc_profile=image.info.get("icc_profile", b""),
           exif=image.info.get("exif", b""))
assert Image.open(target).convert("RGBA").tobytes() == pixels, "Codec changed pixels"
print(f"{source.stat().st_size} -> {target.stat().st_size} bytes; "
      f"RGBA SHA-256 {sha256(pixels).hexdigest()} unchanged")
