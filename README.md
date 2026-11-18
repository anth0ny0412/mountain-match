# 나랑 맞는 산 찾기

내 시간·체력·이동수단에 맞는 산과 코스를 **산림청 공공데이터**로 추천하고, 결과를 인스타 스토리 카드로 저장하는 서비스.
산림청 「산림공공데이터 어디까지 써봤니」 공모 출품작.

- 사이트: `site/` (정적 HTML/JS, `site/data/*.json`만 읽음) — `main`에 push하면 GitHub Pages로 자동 배포
- 데이터: 산림청_명산등산로_GW, 산림청_산 정보 조회_GW, 산림청_숲에 사는 식물 정보_GW (공공데이터포털)
- 수집·정제: `scripts/collect.py` → `scripts/build_json.py` (인증키는 `.env`, 저장소에 포함하지 않음)
- 로컬 실행: `cd site && python -m http.server 8765` → http://localhost:8765/
