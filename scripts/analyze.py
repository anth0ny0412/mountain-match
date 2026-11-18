"""명산·식물 텍스트 필드에서 추천에 쓸 값이 얼마나 뽑히는지 확인."""
import re, glob, html, xml.etree.ElementTree as ET
from collections import Counter


def items(name):
    for f in sorted(glob.glob(f"data/raw/{name}/*.xml")):
        for it in ET.parse(f).getroot().iter("item"):
            yield {c.tag: html.unescape((c.text or "").strip()) for c in it}


M = list(items("mountains"))
P = list(items("plants"))
TIME = re.compile(r"(\d+)\s*시간(?:\s*(\d+)\s*분)?|(\d+)\s*분")


def courses(txt):
    parts = [p.strip() for p in re.split(r"<br\s*/?>|\n", txt) if p.strip()]
    out = []
    for p in parts:
        ts = list(TIME.finditer(p))
        if not ts:
            out.append((p, None))
            continue
        m = ts[-1]
        mins = int(m.group(1)) * 60 + int(m.group(2) or 0) if m.group(1) else int(m.group(3))
        out.append((p, mins))
    return out


nc = nt = mts_with = 0
mins_all = []
for m in M:
    cs = courses(m.get("etccourse", ""))
    nc += len(cs)
    t = [x for _, x in cs if x]
    nt += len(t)
    mts_with += bool(t)
    mins_all += t
print(f"코스 줄 {nc}개 중 시간 파싱 {nt}개, 시간 있는 산 {mts_with}/100")
mins_all.sort()
print("소요분 min/중앙/max:", mins_all[0], mins_all[len(mins_all) // 2], mins_all[-1])
print("구간별:", Counter("~2h" if x <= 120 else "~3h" if x <= 180 else "~4h" if x <= 240 else "~5h" if x <= 300 else "5h+" for x in mins_all))
print("파싱 실패 예:", [p[:60] for m in M for p, x in courses(m.get("etccourse", "")) if x is None][:6])

tr = Counter()
for m in M:
    t = m["transport"]
    tr["역 언급"] += bool(re.search(r"역|KTX|기차", t))
    tr["버스"] += "버스" in t
    tr["지하철/전철"] += bool(re.search(r"지하철|전철|\d호선", t))
print("\n교통 키워드(산 수):", dict(tr))

KW = {"계곡": r"계곡|폭포", "암릉": r"암릉|암봉|바위|기암|암벽", "단풍": r"단풍",
      "조망": r"조망|전망|일출|운해|바다", "꽃": r"철쭉|진달래|억새|야생화"}
kc = Counter()
for m in M:
    t = m.get("details", "") + m.get("overview", "") + m.get("aeatreason", "")
    for k, p in KW.items():
        kc[k] += bool(re.search(p, t))
print("분위기 키워드(산 수):", dict(kc))
print("시도:", Counter(m["areanm"].split()[0] for m in M).most_common())
h = sorted(int(float(m["mntheight"])) for m in M if m["mntheight"])
print("높이 min/중앙/max:", h[0], h[len(h) // 2], h[-1])

mon = Counter()
fl = 0
for p in P:
    ms = re.findall(r"(\d{1,2})\s*(?:~\s*\d{1,2})?\s*월에?\s*(?:꽃|핀|피)", p["fslifetime"])
    if ms:
        fl += 1
        mon[int(ms[0])] += 1
print(f"\n식물 개화월 파싱 {fl}/{len(P)}:", sorted(mon.items()))
print("서식지:", Counter(p["fsinhabit"] for p in P).most_common(12))
print("구분:", Counter(p["fsgbn"] for p in P))
