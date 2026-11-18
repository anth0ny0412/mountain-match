/* 화면 흐름: 시작 → 질문 5개 → 결과 → 카드 저장 */
(function () {
  const R = window.Recommend;
  const $ = (id) => document.getElementById(id);
  const state = { step: 0, ans: {}, mountains: [], plants: [], last: null };

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  async function load() {
    const [m, p, s] = await Promise.all(
      ["mountains", "plants", "stats"].map((n) => fetch(`data/${n}.json`).then((r) => r.json()))
    );
    state.mountains = m; state.plants = p;
    $("stats").textContent = `명산 ${s.mountains}곳 · 코스 ${s.courses}개 · 숲 식물 ${s.plants}종 데이터로 추천`;
  }

  // ---------- 질문 ----------
  function renderQ() {
    const q = R.QUESTIONS[state.step];
    $("bar").style.width = `${(state.step / R.QUESTIONS.length) * 100}%`;
    $("qnum").textContent = `${state.step + 1} / ${R.QUESTIONS.length}`;
    $("qtitle").textContent = q.title;
    $("qfield").textContent = `사용 데이터: ${q.field}`;
    $("back").style.visibility = state.step ? "visible" : "hidden";
    const box = $("options");
    box.innerHTML = "";
    q.options.forEach((o) => {
      const b = document.createElement("button");
      b.textContent = o.label;
      b.onclick = () => {
        state.ans[q.id] = o.v;
        if (state.step < R.QUESTIONS.length - 1) { state.step++; renderQ(); }
        else showResult();
      };
      box.appendChild(b);
    });
  }

  // ---------- 식물: 산과 연결 필드가 없어 "이 계절 숲" 기준으로 고른다 ----------
  function pickPlant(seed) {
    const month = new Date().getMonth() + 1;
    let pool = state.plants.filter((p) => p.bloomMonth === month);
    let title = "이 계절 숲에서 볼 수 있는 꽃";
    if (!pool.length) {
      pool = state.plants.filter((p) => p.type === "목본류");
      title = "숲에서 만날 수 있는 나무";
    }
    let h = 0;
    for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { plant: pool[h % pool.length], title };
  }

  // ---------- 결과 ----------
  function showResult() {
    const out = R.recommend(state.mountains, state.ans);
    const top = out.results[0];
    const { mountain: m, course: c, type } = top;
    state.last = { out, top };

    // 산 사진 (산림청_산 정보 조회_GW). 못 불러오면 숨김
    const ph = $("rphoto");
    ph.hidden = !m.photo;
    ph.onerror = () => { ph.hidden = true; };
    if (m.photo) { ph.src = m.photo; ph.alt = `${m.name} 사진`; }

    $("rtype").textContent = type.name;
    $("rname").textContent = m.name;
    $("rsub").textContent = m.sub || m.area;
    const rel = $("relaxed");
    rel.hidden = !out.relaxed.length;
    rel.textContent = `딱 맞는 산이 없어 '${out.relaxed.join(", ")}' 조건을 빼고 가장 가까운 산을 골랐어요.`;

    const reasons = R.reasons(m, c, state.ans);
    $("rreasons").innerHTML = reasons.map((r) => `<li><b>${r.k}</b>${r.v}</li>`).join("");
    $("rcourse").textContent = `${c.route}\n(${R.fmtMin(c.minutes)})`;
    $("rtransport").textContent = m.transport.text;
    $("rdetails").textContent = m.details;

    const { plant, title } = pickPlant(m.id);
    $("plantTitle").textContent = title;
    $("rplant").textContent = `${plant.name} (${plant.family}) — ${plant.habitat}에서 자라요.`;

    const alts = out.results.slice(1);
    $("altBlock").hidden = !alts.length;
    $("ralts").innerHTML = alts
      .map((a) => `<li>${a.mountain.name} · ${R.fmtMin(a.course.minutes)} · ${a.mountain.height}m</li>`).join("");

    // 카드 채우기
    $("ctype").textContent = type.name;
    $("cname").textContent = m.name;
    $("csub").textContent = m.sub || m.area;
    $("creasons").innerHTML = reasons.map((r) => `<li><b>${r.k}</b>${r.v}</li>`).join("");
    $("ccourse").textContent = c.route;
    $("cplant").innerHTML = `${title}<br><b>${plant.name}</b> · ${plant.habitat}`;

    $("bar").style.width = "100%";
    show("result");
  }

  // ---------- 카드 저장 ----------
  async function saveCard() {
    const btn = $("save");
    btn.disabled = true; btn.textContent = "이미지 만드는 중…";
    try {
      await document.fonts.ready;
      const canvas = await html2canvas($("card"), { width: 1080, height: 1920, scale: 1, backgroundColor: null });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const name = `나랑맞는산_${state.last.top.mountain.name}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "나랑 맞는 산" }); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      const url = URL.createObjectURL(blob);
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        $("previewImg").src = url; $("preview").hidden = false; // 길게 눌러 저장
      } else {
        const a = document.createElement("a");
        a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } finally {
      btn.disabled = false; btn.textContent = "스토리 카드 저장";
    }
  }

  $("start").onclick = () => { state.step = 0; state.ans = {}; renderQ(); show("quiz"); };
  $("back").onclick = () => { if (state.step) { state.step--; renderQ(); } };
  $("retry").onclick = () => show("intro");
  $("save").onclick = saveCard;
  $("closePreview").onclick = () => { $("preview").hidden = true; };
  // 점검용: #a=half,mid,rail,수도권,암릉 → 바로 결과, 뒤에 &card 붙이면 카드만 표시
  function devHash() {
    const m = decodeURIComponent(location.hash).match(/^#a=([^&]+)(&card)?/);
    if (!m) return;
    m[1].split(",").forEach((v, i) => { state.ans[R.QUESTIONS[i].id] = v; });
    showResult();
    if (m[2]) { const card = $("card"); document.body.innerHTML = ""; document.body.appendChild(card); }
  }
  load().then(devHash).catch(() => { $("stats").textContent = "데이터를 불러오지 못했어요. 새로고침 해주세요."; });
})();
