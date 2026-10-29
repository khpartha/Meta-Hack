"""Run from backend/: python -m pytest -q"""

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def jpeg(w: int, h: int, orientation: int | None = None) -> bytes:
    buf = BytesIO()
    img = Image.new("RGB", (w, h), (120, 120, 120))
    if orientation:
        exif = Image.Exif()
        exif[0x0112] = orientation
        img.save(buf, "JPEG", exif=exif)
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def post(data: bytes, mock: str | None = None, name: str = "a.jpg"):
    params = {"mock": mock} if mock else {}
    return client.post("/api/inspect", params=params, files={"image": (name, data, "image/jpeg")})


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_mock_hazards_native_size_keeps_fixture_boxes():
    r = post(jpeg(1600, 1059), "hazards")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "possible_hazards_found"
    assert (body["image_width"], body["image_height"]) == (1600, 1059)
    assert body["findings"][0]["bounding_box"] == [428, 669, 792, 942]
    assert body["findings"][3]["bounding_box"] is None
    assert all(f["requires_human_review"] for f in body["findings"])
    assert body["inspection_id"].startswith("mock-")


def test_mock_hazards_scales_boxes_to_upload():
    body = post(jpeg(800, 530), "hazards").json()
    x1, y1, x2, y2 = body["findings"][0]["bounding_box"]
    assert (x1, x2) == (214, 396)
    for f in body["findings"]:
        if f["bounding_box"]:
            bx1, by1, bx2, by2 = f["bounding_box"]
            assert 0 <= bx1 < bx2 <= 800 and 0 <= by1 < by2 <= 530


def test_mock_clean():
    body = post(jpeg(640, 480), "clean").json()
    assert body["status"] == "no_hazards_found" and body["findings"] == []


def test_exif_rotation_swaps_reported_size():
    # orientation 6 = rotate 90 CW: stored 1000x500, displayed 500x1000
    body = post(jpeg(1000, 500, orientation=6), "clean").json()
    assert (body["image_width"], body["image_height"]) == (500, 1000)


def test_real_mode_not_implemented_yet():
    assert post(jpeg(100, 100)).status_code == 501


def test_bad_mock_value():
    assert post(jpeg(100, 100), "nope").status_code == 422


def test_not_an_image():
    assert post(b"hello", "hazards", name="a.txt").status_code == 400


def test_too_large():
    assert post(b"\0" * (10 * 1024 * 1024 + 1), "hazards").status_code == 413


def test_missing_file():
    assert client.post("/api/inspect?mock=hazards").status_code == 422
