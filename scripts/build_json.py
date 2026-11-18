"""data/raw/의 API 원본 XML → site/data/*.json (사이트가 읽는 정제 데이터).

사용: python -X utf8 scripts/build_json.py
"""
import glob
import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "site" / "data"

# 권역: 출발지 질문 선택지와 맞춘다
REGION = [
    ("수도권", r"서울|경기|인천"),
    ("강원", r"강원"),
    ("충청", r"충청|충북|충남|대전|세종"),
    ("영남", r"경상|경북|경남|부산|대구|울산"),
    ("호남", r"전라|전북|전남|광주"),
    ("제주", r"제주"),
]
# 분위기 키워드: 명산 설명문(details+overview+aeatreason)에서 찾는다
MOOD = {
    "계곡": r"계곡|폭포",
    "암릉": r"암릉|암봉|바위|기암|암벽",
    "조망": r"조망|전망|일출|운해|바다",
    "꽃": r"철쭉|진달래|억새|야생화",
    "단풍": r"단풍",
}
TIME = re.compile(r"(\d+)\s*시간(?:\s*(\d+)\s*분)?|(\d+)\s*분")


def items(name):
    for f in sorted(glob.glob(str(ROOT / "data" / "raw" / name / "*.xml"))):
        for it in ET.parse(f).getroot().iter("item"):
            yield {c.tag: html.unescape((c.text or "").strip()) for c in it}


def strip_tags(s):
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("\xa0", " ")
    return "\n".join(line.strip() for line in s.splitlines() if line.strip())


def parse_courses(txt):
    out = []
    for line in strip_tags(txt).splitlines():
        ts = list(TIME.finditer(line))
        if not ts:
            continue
        m = ts[-1]  # 줄 끝의 "(총 4시간 30분)"
        mins = int(m.group(1)) * 60 + int(m.group(2) or 0) if m.group(1) else int(m.group(3))
        route = line[: m.start()].rstrip(" (（약총:").strip()
        route = re.sub(r"^[①-⑩\d\.\)\s]+", "", route).strip(" -")
        route = re.sub(r"\s*-\s*", " - ", route)
        if route and 30 <= mins <= 24 * 60:
            out.append({"route": route, "minutes": mins})
    return out


def transport_info(txt):
    t = strip_tags(txt)
    # "지역", "행정구역", 지명 "역내리"는 제외
    rail = bool(re.search(r"지하철|전철|\d호선|[가-힣]역(?!내)(?<!지역)(?<!행정구역)", t))
    hub = re.search(r"(?:기점은|출발점\s*:)\s*([가-힣, ]+?)(?:이다|다|이며|\.|\n|$)", t)
    return {
        "text": t,
        "hub": hub.group(1).strip(" ,") if hub else "",
        "summary": re.split(r"(?<=[.다])\s|\n", t)[0][:80],
        "rail": rail,  # 지하철·기차역 언급
        "bus": "버스" in t,
        "subway": bool(re.search(r"지하철|전철|\d호선", t)),
    }


def gw_index():
    """산림청_산 정보 조회_GW: 산명 → 후보 목록 (사진·관리기관 보강용)"""
    idx = {}
    for r in items("mtinfo_gw"):
        idx.setdefault(r["mntnnm"], []).append(r)
    return idx


def gw_match(idx, name, height):
    cands = idx.get(name) or idx.get(name.split("(")[0]) or []
    cands = [r for r in cands if r.get("mntninfohght")]
    if not cands:
        return None
    best = min(cands, key=lambda r: abs(float(r["mntninfohght"]) - height))
    return best if abs(float(best["mntninfohght"]) - height) < 30 else None  # 동명이산은 높이로 구분


def build_mountains():
    idx = gw_index()
    res = []
    for m in items("mountains"):
        courses = parse_courses(m.get("etccourse", ""))
        if not courses:
            continue  # 소요시간을 뽑을 수 없는 산은 추천 대상에서 제외
        desc = " ".join(m.get(k, "") for k in ("details", "overview", "aeatreason"))
        moods = {k: len(re.findall(p, desc)) for k, p in MOOD.items()}
        regions = [name for name, p in REGION if re.search(p, m["areanm"])]
        g = gw_match(idx, m["mntnm"], float(m["mntheight"]))
        photo = ""
        if g and "getImage.do" in g.get("mntnattchimageseq", ""):
            photo = g["mntnattchimageseq"].replace("http://", "https://", 1)
        admin = strip_tags(g.get("mntninfomngmemnbdnm", "")) if g else ""
        admin_tel = strip_tags(g.get("mntninfomangrtlno", "")) if g else ""
        res.append({
            "photo": photo,  # 결과 화면 전용 (카드에는 넣지 않음: CORS)
            "admin": " ".join(x for x in (admin, admin_tel) if x),
            "id": m.get("mntncd") or m["mntnm"],
            "name": m["mntnm"],
            "sub": strip_tags(m.get("subnm", "")),
            "height": round(float(m["mntheight"])),
            "area": m["areanm"],
            "regions": regions,
            "courses": sorted(courses, key=lambda c: c["minutes"]),
            "transport": transport_info(m.get("transport", "")),
            "moods": {k: v for k, v in moods.items() if v},
            "details": strip_tags(m.get("details", ""))[:300],
            "reason": strip_tags(m.get("aeatreason", ""))[:200],
        })
    return res


def build_plants():
    res = []
    for p in items("plants"):
        bloom = re.findall(r"(\d{1,2})\s*(?:~\s*\d{1,2})?\s*월에?\s*(?:꽃|핀|피)", p["fslifetime"])
        res.append({
            "id": p["fslistno"],
            "name": p["fskname"],
            "family": p["fsclassname"],
            "type": p["fsgbn"],
            "habitat": p["fsinhabit"],
            "bloomMonth": int(bloom[0]) if bloom else None,
            "intro": strip_tags(p.get("fsoffer", ""))[:80],
            "guide": p.get("fsguide", ""),
        })
    return res


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    ms, ps = build_mountains(), build_plants()
    (OUT / "mountains.json").write_text(json.dumps(ms, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "plants.json").write_text(json.dumps(ps, ensure_ascii=False, indent=1), encoding="utf-8")
    stats = {
        "mountains": len(ms),
        "courses": sum(len(m["courses"]) for m in ms),
        "plants": len(ps),
        "photos": sum(bool(m["photo"]) for m in ms),
        "source": ["산림청_명산등산로_GW", "산림청_숲에 사는 식물 정보_GW", "산림청_산 정보 조회_GW"],
    }
    (OUT / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(stats)
    print("권역 없는 산:", [m["name"] for m in ms if not m["regions"]])
    print("코스 예:", ms[0]["name"], ms[0]["courses"][:2])
