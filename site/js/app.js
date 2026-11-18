/* 화면 흐름: 시작 → 질문 5개(남은 산 수 표시) → 결과(후보 넘겨보기·링크 공유) → 카드 저장 */
(function () {
  const R = window.Recommend;
  const $ = (id) => document.getElementById(id);
  const state = { step: 0, ans: {}, mountains: [], plants: [], out: null, idx: 0, shown: 0 };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // 선택지 아이콘 (화면 장식용, 추천에는 영향 없음)
  const ICONS = {
    time: { short: "🍃", half: "🌤️", long: "🏕️" },
    fitness: { low: "🐢", mid: "🚶", high: "🧗" },
    move: { rail: "🚆", bus: "🚌", car: "🚗" },
    region: { 수도권: "🏙️", 강원: "🌲", 충청: "🌾", 영남: "🏯", 호남: "🍵", 제주: "🍊", any: "🧭" },
    mood: { 계곡: "💦", 암릉: "🪨", 조망: "🌅", 꽃: "🌸", 단풍: "🍁", any: "🎲" },
  };

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("on"), 2200);
  }

  async function load() {
    const [m, p, s] = await Promise.all(
      ["mountains", "plants", "stats"].map((n) => fetch(`data/${n}.json`).then((r) => r.json()))
    );
    state.mountains = m; state.plants = p;
    $("stats").textContent = `명산 ${s.mountains}곳 · 코스 ${s.courses}개 · 숲 식물 ${s.plants}종 데이터로 추천`;
    buildRange();
  }

  // ---------- 산맥: 산 하나 = 삼각형 하나, 크기는 실제 높이(mntheight) ----------
  function buildRange() {
    const hs = state.mountains.map((m) => m.height), lo = Math.min(...hs), hi = Math.max(...hs);
    const box = $("range");
    box.innerHTML = "";
    state.mountains.forEach((m) => {
      const el = document.createElement("i");
      el.className = "peak";
      el.dataset.id = m.id;
      el.style.setProperty("--h", (0.35 + 0.65 * (m.height - lo) / (hi - lo)).toFixed(3));
      box.appendChild(el);
    });
  }
  // 이 답 조합에서 조건을 하나도 빼지 않고 남는 산만 진하게
  function paintRange(ans) {
    const keep = new Set(state.mountains.filter((m) => R.count([m], ans) === 1).map((m) => m.id));
    $("range").querySelectorAll(".peak").forEach((el) => el.classList.toggle("off", !keep.has(el.dataset.id)));
  }

  // ---------- 1. 질문: 남은 산 수 + 등반 진행바 ----------
  const TRAIL = [[10, 86], [70, 70], [130, 72], [180, 48], [230, 50], [270, 14]]; // svg viewBox 320×90

  function moveClimber(step) {
    const [x, y] = TRAIL[Math.min(step, TRAIL.length - 1)];
    const c = $("climber");
    c.style.left = `${(x / 320) * 100}%`;
    c.style.top = `${(y / 90) * 100}%`;
    // 선 길이 비율만큼 그린다 (pathLength=1)
    const seg = TRAIL.slice(1).map((p, k) => Math.hypot(p[0] - TRAIL[k][0], p[1] - TRAIL[k][1]));
    const total = seg.reduce((a, b) => a + b, 0);
    const done = seg.slice(0, Math.min(step, seg.length)).reduce((a, b) => a + b, 0);
    $("trail").style.strokeDashoffset = String(1 - done / total);
  }

  function animateNumber(el, to) {
    const from = state.shown;
    const t0 = performance.now();
    const dur = 450;
    function tick(now) {
      const k = Math.min(1, (now - t0) / dur);
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      el.innerHTML = `조건에 맞는 산 <b>${v}</b>곳`;
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    state.shown = to;
  }

  function renderQ() {
    const q = R.QUESTIONS[state.step];
    const now = R.count(state.mountains, state.ans);
    animateNumber($("remain"), now);
    moveClimber(state.step);
    $("qnum").textContent = `${state.step + 1} / ${R.QUESTIONS.length}`;
    $("qtitle").textContent = q.title;
    $("qfield").textContent = `사용 데이터: ${q.field}`;
    $("back").style.visibility = state.step ? "visible" : "hidden";
    paintRange(state.ans);
    const box = $("options");
    box.innerHTML = "";
    q.options.forEach((o, i) => {
      const next = { ...state.ans, [q.id]: o.v };
      const n = R.count(state.mountains, next);
      const b = document.createElement("button");
      b.style.setProperty("--i", i);
      b.innerHTML = `<span class="ico">${(ICONS[q.id] || {})[o.v] || "⛰️"}</span><span class="lbl">${o.label}</span><small>${n ? n + "곳" : "가까운 산 추천"}</small>`;
      // 고르기 전 미리보기: 이 답을 고르면 산맥이 어떻게 줄어드는지
      const preview = () => paintRange(next);
      const reset = () => paintRange(state.ans);
      b.addEventListener("pointerenter", preview);
      b.addEventListener("focus", preview);
      b.addEventListener("pointerleave", reset);
      b.addEventListener("blur", reset);
      b.onclick = async () => {
        state.ans[q.id] = o.v;
        b.classList.add("picked");
        box.classList.add("locked");
        paintRange(state.ans);
        await sleep(reduceMotion ? 0 : 380);
        box.classList.remove("locked");
        if (state.step < R.QUESTIONS.length - 1) { state.step++; renderQ(); }
        else finish();
      };
      box.appendChild(b);
    });
  }

  // 정상 도착 → 후보 이름 사이를 돌다가 1위에서 멈추는 추첨 연출 → 결과
  async function finish() {
    moveClimber(TRAIL.length - 1);
    animateNumber($("remain"), R.count(state.mountains, state.ans));
    await sleep(reduceMotion ? 0 : 500);
    const all = R.recommend(state.mountains, state.ans, 30);
    const names = all.results.map((r) => r.mountain.name);
    $("rcount").textContent = all.relaxed.length
      ? `조건을 조금 풀어서 ${all.total}곳 중에서 고르는 중…`
      : `${all.total}곳 중에서 나랑 가장 맞는 산 고르는 중…`;
    $("rchips").innerHTML = names.map((n) => `<span class="chip">${n}</span>`).join("");
    show("reveal");
    const chips = [...$("rchips").children];
    if (!reduceMotion && chips.length > 1) {
      let k = 0;
      const steps = Math.min(18, 8 + chips.length);
      for (let s = 0; s < steps; s++) {
        chips.forEach((c) => c.classList.remove("hot"));
        k = (k + 1 + Math.floor(Math.random() * (chips.length - 1))) % chips.length;
        chips[k].classList.add("hot");
        await sleep(60 + s * s * 2.2);
      }
    }
    chips.forEach((c) => c.classList.remove("hot"));
    if (chips[0]) chips[0].classList.add("win");
    await sleep(reduceMotion ? 0 : 650);
    showResult(0);
    if (!reduceMotion) burst();
  }

  // 결과 화면 진입 효과 (나뭇잎)
  function burst() {
    const layer = $("burst");
    layer.innerHTML = "";
    const leaves = ["🍃", "🌿", "🍂", "🌱"];
    for (let k = 0; k < 18; k++) {
      const el = document.createElement("span");
      el.textContent = leaves[k % leaves.length];
      el.style.left = Math.random() * 100 + "%";
      el.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
      el.style.setProperty("--dx", (Math.random() * 80 - 40).toFixed(0) + "px");
      layer.appendChild(el);
    }
    setTimeout(() => { layer.innerHTML = ""; }, 2600);
  }

  // ---------- 식물: 산과 연결 필드가 없어 "이 계절 숲" 기준 ----------
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

  // ---------- 2. 산 실루엣: 데이터 높이 vs 한라산·롯데월드타워 ----------
  function drawSilhouette(canvas, m, el, big) {
    const css = getComputedStyle(el);
    const fill = css.getPropertyValue("--sil-fill").trim() || "#2f6b4f";
    const ref = css.getPropertyValue("--sil-ref").trim() || "rgba(0,0,0,.25)";
    const ink = css.getPropertyValue("--sil-ink").trim() || "#1d2a22";
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const base = H - (big ? 56 : 34), top = big ? 40 : 26, usable = base - top;
    const y = (h) => base - (h / R.REF.halla) * usable;
    const font = (px, w = 600) => `${w} ${px}px Pretendard, sans-serif`;
    ctx.clearRect(0, 0, W, H);

    // 한라산 기준선(점선 산)
    ctx.setLineDash([big ? 12 : 6, big ? 10 : 5]);
    ctx.lineWidth = big ? 4 : 2;
    ctx.strokeStyle = ref;
    ctx.beginPath();
    ctx.moveTo(W * 0.42, base); ctx.lineTo(W * 0.66, y(R.REF.halla)); ctx.lineTo(W * 0.92, base);
    ctx.stroke();
    ctx.setLineDash([]);

    // 추천 산(채운 산)
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(W * 0.04, base); ctx.lineTo(W * 0.2, y(m.height * 0.82)); ctx.lineTo(W * 0.27, y(m.height * 0.74));
    ctx.lineTo(W * 0.36, y(m.height)); ctx.lineTo(W * 0.62, base);
    ctx.closePath(); ctx.fill();

    // 롯데월드타워(가는 막대)
    ctx.fillStyle = ref;
    const tw = big ? 18 : 9;
    ctx.fillRect(W * 0.95 - tw, y(R.REF.tower), tw, base - y(R.REF.tower));

    // 바닥선 + 라벨
    ctx.fillStyle = ink;
    ctx.fillRect(0, base, W, big ? 3 : 1.5);
    ctx.font = font(big ? 34 : 15, 700);
    ctx.textAlign = "center";
    ctx.fillText(`${m.name} ${m.height.toLocaleString()}m`, W * 0.36, y(m.height) - (big ? 16 : 8));
    ctx.font = font(big ? 28 : 13, 500);
    ctx.globalAlpha = 0.7;
    ctx.fillText("한라산 1,947m", W * 0.66, y(R.REF.halla) - (big ? 14 : 6));
    ctx.textAlign = "right";
    ctx.fillText("롯데월드타워", W - 2, base + (big ? 40 : 22));
    ctx.globalAlpha = 1;
  }

  // ---------- 결과 (4. 후보 넘겨보기) ----------
  function showResult(i) {
    state.out = R.recommend(state.mountains, state.ans);
    renderResult(i);
    show("result");
  }

  function renderResult(i) {
    const out = state.out;
    state.idx = Math.min(i, out.results.length - 1);
    const { mountain: m, course: c, type } = out.results[state.idx];

    // 3. 풍경별 색 테마
    const theme = R.themeOf(state.ans, m);
    $("result").dataset.theme = theme;
    $("card").dataset.theme = theme;

    $("pager").innerHTML = out.results
      .map((r, k) => `<button class="${k === state.idx ? "on" : ""}" data-k="${k}">${k + 1}위 ${r.mountain.name}</button>`)
      .join("");
    $("pager").querySelectorAll("button").forEach((b) => { b.onclick = () => { renderResult(+b.dataset.k); window.scrollTo(0, 0); }; });

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
    const cmp = R.compare(m, c);
    $("rreasons").innerHTML = reasons.map((r) => `<li><b>${r.k}</b>${r.v}</li>`).join("");
    $("rcompare").innerHTML = `<li>⛰️ ${cmp.heightText} · 한라산의 ${cmp.hallaPct}%</li><li>⏱️ ${cmp.timeText}</li>`;
    drawSilhouette($("rsil"), m, $("result"), false);

    $("rcourse").textContent = `${c.route}\n(${R.fmtMin(c.minutes)})`;
    $("rtransport").textContent = m.transport.text;
    $("rdetails").textContent = m.details;

    const { plant, title } = pickPlant(m.id);
    $("plantTitle").textContent = title;
    $("rplant").textContent = `${plant.name} (${plant.family}) — ${plant.habitat}에서 자라요.`;

    // 카드
    $("ctype").textContent = type.name;
    $("cname").textContent = m.name;
    $("csub").textContent = m.sub || m.area;
    $("creasons").innerHTML = reasons.map((r) => `<li><b>${r.k}</b>${r.v}</li>`).join("");
    $("ccompare").innerHTML = `${cmp.heightText}<br>${cmp.timeText}`;
    drawSilhouette($("csil"), m, $("card"), true);
    $("cplant").innerHTML = `${title}<br><b>${plant.name}</b> · ${plant.habitat}`;
  }

  // ---------- 4. 결과 링크 공유 ----------
  function shareUrl() {
    const vals = R.QUESTIONS.map((q) => state.ans[q.id]);
    return `${location.origin}${location.pathname}#a=${encodeURIComponent(vals.join(","))}&i=${state.idx}`;
  }

  async function shareLink() {
    const url = shareUrl();
    const name = state.out.results[state.idx].mountain.name;
    try {
      await navigator.clipboard.writeText(url);
      toast("링크를 복사했어요. 친구에게 보내 보세요!");
    } catch (e) {
      if (navigator.share) {
        try { await navigator.share({ title: "나랑 맞는 산", text: `나랑 맞는 산은 ${name}!`, url }); } catch (_) {}
      } else {
        toast(url);
      }
    }
  }

  // ---------- 카드 저장 ----------
  async function saveCard() {
    const btn = $("save");
    btn.disabled = true; btn.textContent = "이미지 만드는 중…";
    try {
      await document.fonts.ready;
      const canvas = await html2canvas($("card"), { width: 1080, height: 1920, scale: 1, backgroundColor: null });
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const name = `나랑맞는산_${state.out.results[state.idx].mountain.name}.png`;
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
    } catch (e) {
      toast("이미지를 만들지 못했어요. 다시 시도해 주세요.");
    } finally {
      btn.disabled = false; btn.textContent = "스토리 카드 저장";
    }
  }

  // 공유 링크/점검용: #a=half,mid,rail,수도권,암릉&i=0  (&card 붙이면 카드만 표시)
  function fromHash() {
    const h = decodeURIComponent(location.hash);
    const q = h.match(/^#q=(.*)/); // 점검용: #q=half,mid → 3번째 질문 화면
    if (q) {
      const vals = q[1] ? q[1].split(",") : [];
      vals.forEach((v, k) => { state.ans[R.QUESTIONS[k].id] = v; });
      state.step = vals.length; state.shown = R.count(state.mountains, state.ans);
      renderQ(); show("quiz");
      return;
    }
    const m = h.match(/^#a=([^&]+)(?:&i=(\d))?(&card)?/);
    if (!m) return;
    const vals = m[1].split(",");
    const ok = R.QUESTIONS.every((q, k) => q.options.some((o) => o.v === vals[k]));
    if (!ok) return;
    R.QUESTIONS.forEach((q, k) => { state.ans[q.id] = vals[k]; });
    showResult(+(m[2] || 0));
    if (m[3]) { const card = $("card"); document.body.innerHTML = ""; document.body.appendChild(card); }
  }

  $("start").onclick = () => { state.step = 0; state.ans = {}; state.shown = state.mountains.length; renderQ(); show("quiz"); };
  $("back").onclick = () => { if (state.step) { state.step--; delete state.ans[R.QUESTIONS[state.step].id]; renderQ(); } };
  $("retry").onclick = () => { history.replaceState(null, "", location.pathname); show("intro"); };
  $("save").onclick = saveCard;
  $("share").onclick = shareLink;
  $("closePreview").onclick = () => { $("preview").hidden = true; };
  load().then(fromHash).catch(() => { $("stats").textContent = "데이터를 불러오지 못했어요. 새로고침 해주세요."; });
})();
