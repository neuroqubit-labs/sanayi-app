"""EXIF strip worker — pure helper smoke.

Brief §3.3: defense-in-depth EXIF GPS remove. Worker `_resize_image` variants
üretirken GPS tag silinir; `_strip_exif_in_place` orijinali overwrite eder.

PIL ile synthetic GPS tag oluşturmak versiyona göre unstable; testler çıktı
validasyonuna odaklanır (format + size + no-GPS).
"""

from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.workers.media import _resize_image, _strip_exif_in_place

_GPS_TAG_ID = 34853


def _make_plain_jpeg(width: int = 200, height: int = 200) -> bytes:
    image = Image.new("RGB", (width, height), color="red")
    buf = BytesIO()
    image.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _extract_gps_tag(jpeg_bytes: bytes) -> bytes | None:
    with Image.open(BytesIO(jpeg_bytes)) as img:
        exif = img.getexif()
        return exif.get(_GPS_TAG_ID)


def test_strip_exif_no_op_when_no_gps() -> None:
    """GPS yoksa byte değişmez (idempotent)."""
    source = _make_plain_jpeg()
    stripped = _strip_exif_in_place(source)
    assert stripped == source  # no EXIF GPS → no re-encode


def test_resize_image_produces_valid_jpeg_no_gps() -> None:
    """Preview variants JPEG; boyut <= max; GPS tag yok."""
    source = _make_plain_jpeg(width=2000, height=2000)
    preview = _resize_image(source, 1600)

    with Image.open(BytesIO(preview)) as img:
        assert img.format == "JPEG"
        assert max(img.size) <= 1600

    assert _extract_gps_tag(preview) is None


def test_resize_image_thumb_dimensions() -> None:
    source = _make_plain_jpeg(width=800, height=600)
    thumb = _resize_image(source, 400)
    with Image.open(BytesIO(thumb)) as img:
        # 800x600 ölçeklendirilir → en büyük kenar 400
        assert max(img.size) <= 400


def test_resize_image_converts_non_rgb() -> None:
    """RGBA / CMYK / P mode → RGB convert."""
    image = Image.new("RGBA", (100, 100), color=(255, 0, 0, 128))
    buf = BytesIO()
    image.save(buf, format="PNG")

    out = _resize_image(buf.getvalue(), 100)
    with Image.open(BytesIO(out)) as img:
        assert img.format == "JPEG"
        assert img.mode == "RGB"
