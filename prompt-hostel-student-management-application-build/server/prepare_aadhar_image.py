"""Normalize an Aadhar image for more reliable local OCR."""
import sys
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

source, target = sys.argv[1], sys.argv[2]
with Image.open(source) as image:
    image = ImageOps.exif_transpose(image).convert("L")
    if image.width < 1800:
        scale = 1800 / image.width
        image = image.resize((1800, int(image.height * scale)), Image.Resampling.LANCZOS)
    image = ImageOps.autocontrast(image)
    image = ImageEnhance.Contrast(image).enhance(1.35)
    image = image.filter(ImageFilter.SHARPEN)
    image.save(target, "PNG", optimize=True)
