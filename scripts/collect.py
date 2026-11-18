"""API 원본을 data/raw/에 페이지별 XML로 저장한다. 사용: python scripts/collect.py mountains|plants|trails|mtinfo|mtinfo_gw"""
import sys, time, re, requests
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from keys import load_keys, mask

K = load_keys()
BASE = "https://apis.data.go.kr/1400000/"
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
TARGETS = {
    "mountains": "cultureInfoService/gdTrailInfoOpenAPI",   # 명산등산로
    "plants": "cultureInfoService/fStoryOpenAPI",           # 숲에 사는 식물
    "trails": "trailInfoService/getforestspatialdataservice",  # 등산로 공간정보
    "mtinfo": "service/cultureInfoService2/mntInfoOpenAPI2",  # 산정보 서비스(3,368개 설명)
    "mtinfo_gw": "trailInfoService/getforeststoryservice",  # 산 정보 조회_GW
}

def fetch(path, page, rows, **extra):
    p = {"serviceKey": K["DATA_GO_KR_KEY"], "pageNo": page, "numOfRows": rows, **extra}
    for attempt in range(3):
        try:
            r = requests.get(BASE + path, params=p, timeout=60)
            r.encoding = "utf-8"
            return r.status_code, r.text
        except requests.RequestException as e:
            print("  retry:", mask(str(e), K)); time.sleep(2)
    raise SystemExit("요청 실패")

def main(name, rows=100):
    path = TARGETS[name]
    out = RAW / name; out.mkdir(parents=True, exist_ok=True)
    page, total = 1, None
    while True:
        s, t = fetch(path, page, rows)
        if s != 200 or "<resultCode>00</resultCode>" not in t:
            print(f"[{name}] p{page} 오류 {s}:", mask(t[:300], K)); return
        (out / f"p{page:03d}.xml").write_text(t, encoding="utf-8")
        if total is None:
            m = re.search(r"<totalCount>(\d+)</totalCount>", t); total = int(m.group(1)) if m else 0
            print(f"[{name}] totalCount={total}")
        if page * rows >= total: break
        page += 1; time.sleep(0.3)
    print(f"[{name}] {page}페이지 저장 → {out}")

if __name__ == "__main__":
    for n in sys.argv[1:]: main(n)
