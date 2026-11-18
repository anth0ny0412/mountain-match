// 모든 답 조합에 대해 추천이 나오는지, 완화가 얼마나 일어나는지 확인
const R = require("../site/js/recommend.js");
const M = require("../site/data/mountains.json");
const Q = Object.fromEntries(R.QUESTIONS.map(q => [q.id, q.options.map(o => o.v)]));
let n = 0, empty = 0; const relax = {}; const top = {};
for (const time of Q.time) for (const fitness of Q.fitness) for (const move of Q.move)
for (const region of Q.region) for (const mood of Q.mood) {
  const ans = { time, fitness, move, region, mood }; const r = R.recommend(M, ans); n++;
  if (!r.results.length) empty++;
  const k = r.relaxed.join("+") || "(없음)"; relax[k] = (relax[k] || 0) + 1;
  if (r.results[0]) top[r.results[0].mountain.name] = (top[r.results[0].mountain.name] || 0) + 1;
}
console.log("조합", n, "빈 결과", empty);
console.log("완화된 조건:", relax);
const t = Object.entries(top).sort((a, b) => b[1] - a[1]);
console.log("1위로 나온 산 종류:", t.length, "/ 최다:", t.slice(0, 8));
const ex = R.recommend(M, { time: "half", fitness: "mid", move: "rail", region: "수도권", mood: "암릉" });
console.log("\n예시(반나절·보통·기차·수도권·암릉):", ex.relaxed, ex.results.map(r => [r.mountain.name, r.course.minutes, r.type.name, R.reasons(r.mountain, r.course, {mood:"암릉"}).map(x=>x.k+" "+x.v).join(" · ")]));
