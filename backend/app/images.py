"""Upload validation and image helpers."""

from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


async def load_upload(file: UploadFile) -> Image.Image:
    """Read an uploaded file into an RGB Pillow image, or raise a 4xx.

    EXIF orientation is applied so width/height match what the browser shows
    (phone photos are often stored sideways with a rotate flag).
    """
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"Image larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(400, "Empty upload")
    try:
        img = Image.open(BytesIO(data))
        fmt = img.format
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "File is not a readable image")
    if fmt not in ALLOWED_FORMATS:
        raise HTTPException(400, f"Unsupported image format {fmt}; use JPEG, PNG or WEBP")
    return ImageOps.exif_transpose(img).convert("RGB")
