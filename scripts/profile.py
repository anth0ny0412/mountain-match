"""raw XML의 필드별 채움률·예시를 출력."""
import sys, glob, xml.etree.ElementTree as ET
from collections import Counter
def items(name):
    for f in sorted(glob.glob(f"data/raw/{name}/*.xml")):
        for it in ET.parse(f).getroot().iter("item"):
            yield {c.tag: (c.text or "").strip() for c in it}
for name in sys.argv[1:]:
    rows = list(items(name)); fill = Counter(); ex = {}
    for r in rows:
        for k, v in r.items():
            if v: fill[k] += 1; ex.setdefault(k, v)
    keys = sorted({k for r in rows for k in r})
    print(f"\n### {name}: {len(rows)}건")
    for k in keys:
        print(f"{k:28s} {fill[k]:4d}/{len(rows)}  {ex.get(k,'')[:90]!r}")
