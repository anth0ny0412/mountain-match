/* 추천 로직: 질문 답 → 산림청 명산등산로 데이터 값으로 필터·정렬.
   브라우저(window.Recommend)와 node(require) 양쪽에서 쓴다. */
(function (root) {
  // 질문 정의. 선택지 값은 모두 데이터 필드 조건으로 바뀐다.
  const QUESTIONS = [
    {
      id: "time", title: "산행에 쓸 수 있는 시간은?",
      field: "코스 소요시간 (etccourse)",
      options: [
        { v: "short", label: "3시간 이내로 가볍게", min: 0, max: 180 },
        { v: "half", label: "반나절 (3~5시간)", min: 181, max: 300 },
        { v: "long", label: "하루 종일도 OK (5시간+)", min: 301, max: 9999 },
      ],
    },
    {
      id: "fitness", title: "체력은 어느 정도?",
      field: "산 높이 (mntheight)",
      options: [
        { v: "low", label: "오르막은 아직 무서워", min: 0, max: 799 },
        { v: "mid", label: "보통이에요", min: 800, max: 1199 },
        { v: "high", label: "높을수록 좋아", min: 1200, max: 9999 },
      ],
    },
    {
      id: "move", title: "어떻게 갈 거예요?",
      field: "대중교통 정보 (transport)",
      options: [
        { v: "rail", label: "기차·지하철로", test: (m) => m.transport.rail },
        { v: "bus", label: "버스도 괜찮아", test: (m) => m.transport.bus || m.transport.rail },
        { v: "car", label: "자가용", test: () => true },
      ],
    },
    {
      id: "region", title: "어느 쪽 산이 좋아요?",
      field: "소재지 (areanm)",
      options: ["수도권", "강원", "충청", "영남", "호남", "제주"].map((r) => ({ v: r, label: r }))
        .concat([{ v: "any", label: "어디든" }]),
    },
    {
      id: "mood", title: "어떤 풍경이 끌려요?",
      field: "명산 설명문 키워드 (details·overview)",
      options: [
        { v: "계곡", label: "시원한 계곡·폭포" },
        { v: "암릉", label: "웅장한 바위 능선" },
        { v: "조망", label: "탁 트인 전망" },
        { v: "꽃", label: "철쭉·억새 같은 꽃길" },
        { v: "단풍", label: "단풍" },
        { v: "any", label: "상관없어요" },
      ],
    },
  ];

  const opt = (qid, v) => QUESTIONS.find((q) => q.id === qid).options.find((o) => o.v === v);

  // 조건 하나하나를 산 단위 테스트로 표현
  function makeFilters(ans) {
    const t = opt("time", ans.time), f = opt("fitness", ans.fitness), mv = opt("move", ans.move);
    return [
      // 완화 순서: 앞에서부터 하나씩 빼본다
      { id: "mood", label: "풍경", on: ans.mood && ans.mood !== "any", test: (m) => (m.moods[ans.mood] || 0) > 0 },
      { id: "region", label: "지역", on: ans.region && ans.region !== "any", test: (m) => m.regions.includes(ans.region) },
      { id: "move", label: "이동수단", on: !!mv, test: (m) => mv.test(m) },
      { id: "fitness", label: "체력", on: !!f, test: (m) => m.height >= f.min && m.height <= f.max },
      { id: "time", label: "시간", on: !!t, test: (m) => m.courses.some((c) => c.minutes >= t.min && c.minutes <= t.max) },
    ].filter((x) => x.on);
  }

  // 사용자 시간에 가장 잘 맞는 코스 하나
  function pickCourse(m, ans) {
    const t = opt("time", ans.time);
    if (!t) return m.courses[0];
    const mid = t.max > 1000 ? 420 : (t.min + t.max) / 2;
    const inRange = m.courses.filter((c) => c.minutes >= t.min && c.minutes <= t.max);
    const pool = inRange.length ? inRange : m.courses;
    return pool.slice().sort((a, b) => Math.abs(a.minutes - mid) - Math.abs(b.minutes - mid))[0];
  }

  function score(m, ans, course) {
    let s = 0;
    if (ans.mood && ans.mood !== "any") s += Math.min(m.moods[ans.mood] || 0, 5) * 10;
    else s += Object.keys(m.moods).length * 3;
    const t = opt("time", ans.time);
    if (t && course.minutes >= t.min && course.minutes <= t.max) s += 20;
    if (ans.move === "rail" && m.transport.subway) s += 5;
    return s;
  }

  // 결과 유형: 코스 시간(4시간) × 산 높이(1000m) 2×2.  이름은 디자인 담당이 바꿀 자리.
  const TYPES = {
    "short-low": { name: "가볍게 한 바퀴형", desc: "짧은 코스, 부담 없는 높이" },
    "short-high": { name: "짧고 굵게형", desc: "짧지만 1000m 넘는 산" },
    "long-low": { name: "느긋한 능선 산책형", desc: "길게 걷되 높지 않은 산" },
    "long-high": { name: "정상 정복 원정형", desc: "긴 코스, 1000m 넘는 산" },
  };
  function typeOf(m, course) {
    const key = (course.minutes <= 240 ? "short" : "long") + "-" + (m.height < 1000 ? "low" : "high");
    return { key, ...TYPES[key] };
  }

  function recommend(mountains, ans, n = 3) {
    const filters = makeFilters(ans);
    const relaxed = [];
    let active = filters.slice();
    let cands = [];
    for (;;) {
      cands = mountains.filter((m) => active.every((f) => f.test(m)));
      if (cands.length || !active.length) break;
      const drop = active.shift(); // 우선순위 낮은 조건부터 완화
      relaxed.push(drop.label);
    }
    const ranked = cands
      .map((m) => { const course = pickCourse(m, ans); return { m, course, s: score(m, ans, course) }; })
      .sort((a, b) => b.s - a.s || a.m.height - b.m.height);
    return {
      relaxed,
      total: cands.length,
      results: ranked.slice(0, n).map((r) => ({ mountain: r.m, course: r.course, type: typeOf(r.m, r.course), score: r.s })),
    };
  }

  // "왜 이 산인가" — 카드에 그대로 찍을 데이터 값
  function reasons(m, course, ans) {
    const h = Math.floor(course.minutes / 60), mm = course.minutes % 60;
    const out = [
      { k: "소요", v: `${h ? h + "시간" : ""}${mm ? " " + mm + "분" : ""}`.trim() },
      { k: "높이", v: `${m.height.toLocaleString()}m` },
    ];
    if (m.transport.hub) out.push({ k: "기점", v: m.transport.hub + (m.transport.bus ? " · 버스" : "") });
    if (ans.mood && ans.mood !== "any" && m.moods[ans.mood]) out.push({ k: "풍경", v: ans.mood });
    return out;
  }

  const fmtMin = (x) => { const h = Math.floor(x / 60), m = x % 60; return `${h ? h + "시간" : ""}${m ? " " + m + "분" : ""}`.trim(); };

  // 지금까지 답한 조건을 모두 만족하는 산 수 (완화 없이)
  function count(mountains, ans) {
    const fs = makeFilters(ans);
    return mountains.filter((m) => fs.every((f) => f.test(m))).length;
  }

  // 데이터 값을 일상 비유로 (높이·시간은 데이터, 기준값은 아래 상수)
  const REF = { tower: 555, towerName: "롯데월드타워", halla: 1947, movie: 120 };
  function compare(m, course) {
    const towers = Math.round((m.height / REF.tower) * 10) / 10;
    const movies = Math.round((course.minutes / REF.movie) * 2) / 2; // 0.5편 단위
    return {
      towers,
      movies,
      hallaPct: Math.round((m.height / REF.halla) * 100),
      heightText: `${REF.towerName} ${towers}개 높이`,
      timeText: movies >= 1 ? `영화 ${movies}편 볼 시간` : "영화 한 편보다 짧아요",
    };
  }

  // 풍경 답 → 카드 색 테마 (CSS의 [data-theme])
  function themeOf(ans, m) {
    if (ans.mood && ans.mood !== "any") return ans.mood;
    const top = Object.entries(m.moods).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "기본";
  }

  const api = { QUESTIONS, TYPES, REF, recommend, reasons, pickCourse, typeOf, fmtMin, count, compare, themeOf };
  if (typeof module !== "undefined") module.exports = api;
  else root.Recommend = api;
})(this);
