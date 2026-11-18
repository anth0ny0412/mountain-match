"""명산별 사진 후보 수집 → data/raw/photos.json

산림청_산정보 서비스의 '산 이미지 정보 검색'(mntInfoImgOpenAPI2)으로 산마다 사진 파일명을 받고,
각 파일의 실제 해상도(JPEG 헤더)를 재서 가장 큰 사진을 고를 수 있게 저장한다.
사용: python -X utf8 scripts/collect_photos.py
"""
import json
import re
import struct
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from keys import load_keys, mask  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
K = load_keys()
API = "https://apis.data.go.kr/1400000/service/cultureInfoService2/mntInfoImgOpenAPI2"
IMG_BASE = "https://www.forest.go.kr/images/data/down/mountain/"
UA = {"User-Agent": "Mozilla/5.0"}


def jpeg_size(b):
    """JPEG 바이트에서 (가로, 세로). 실패하면 (0, 0)."""
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF:
            i += 1
            continue
        marker = b[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", b[i + 5:i + 9])
            return w, h
        seg = struct.unpack(">H", b[i + 2:i + 4])[0]
        i += 2 + seg
    return 0, 0


def image_files(code):
    p = {"ServiceKey": K["DATA_GO_KR_KEY"], "mntiListNo": code, "pageNo": 1, "numOfRows": 50}
    for _ in range(3):
        try:
            r = requests.get(API, params=p, timeout=30)
            r.encoding = "utf-8"
            return re.findall(r"<imgfilename>\s*([^<]+?)\s*</imgfilename>", r.text)
        except requests.RequestException as e:
            print("  retry:", mask(str(e), K))
            time.sleep(2)
    return []


def main():
    mountains = json.loads((ROOT / "site" / "data" / "mountains.json").read_text(encoding="utf-8"))
    out = {}
    for m in mountains:
        cands = []
        for f in image_files(m["id"]):
            url = IMG_BASE + f
            try:
                r = requests.get(url, headers=UA, timeout=30)
            except requests.RequestException:
                continue
            if r.status_code != 200 or "image" not in r.headers.get("content-type", ""):
                continue
            w, h = jpeg_size(r.content)
            cands.append({"url": url, "bytes": len(r.content), "w": w, "h": h})
        cands.sort(key=lambda c: (c["w"] * c["h"], c["bytes"]), reverse=True)
        out[m["id"]] = cands
        best = cands[0] if cands else None
        print(f"{m['name']:10s} 후보 {len(cands)}  최대 {best['w']}x{best['h']}" if best else f"{m['name']:10s} 없음")
        time.sleep(0.2)
    (ROOT / "data" / "raw" / "photos.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
