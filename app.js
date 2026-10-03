import { firebaseConfig } from "./firebase-config.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const safeParse = (value, fallback) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const LOCAL_KEY = "kenglish-progress-v1";
const USER_KEY = "kenglish-local-user";
const DEFAULT_STATE = { progress: {}, selectedUnits: [], character: 0, points: 0, streak: 0, lastStudyDate: "", daily: {}, dailyByUnit: {}, awarded: { units: [], parts: [], streak5: 0, streak10: 0, streak5Run: 0, streak10Run: 0, complete: false } };
const characters = ["excited","joyful","grateful","energized","sensitive","confused","bored","stressed","angry","insecure","hurt","guilty"];
const characterFiles = ["excited.png","joyful.png","gratful.png","energized.png","sensitive.png","confused.png","bored.png","stressed.png","angry.png","insecure.png","hurt.png","guilty.png"];
let sentences = [];
let units = [];
let state = structuredClone(DEFAULT_STATE);
let selectedUnitIds = new Set();
let activeUser = null;
let firebase = null;
let firebasePromise = null;
let firebaseFailure = "";
let currentQuiz = null;
let view = "home";
let toastTimer;

try {
  const response = await fetch("./data/kenglish.json");
  if (!response.ok) throw new Error("문장 데이터 파일을 불러오지 못했습니다.");
  sentences = await response.json();
} catch (error) { console.error(error); }

units = [...new Map(sentences.map(row => [row.unit_no, {
  part: row.part_no, number: row.unit_no, title: row.unit_title, url: row.unit_url,
  sentences: sentences.filter(item => item.unit_no === row.unit_no)
}])).values()];

function localKey() { return activeUser?.uid ? `${LOCAL_KEY}:${activeUser.uid}` : LOCAL_KEY; }
function loadLocal() {
  activeUser = safeParse(localStorage.getItem(USER_KEY), null);
  state = { ...structuredClone(DEFAULT_STATE), ...safeParse(localStorage.getItem(localKey()), {}) };
  state.progress ??= {}; state.awarded ??= structuredClone(DEFAULT_STATE.awarded);
  state.daily ??= {}; state.dailyByUnit ??= {}; state.character ??= 0;
  state.awarded = { ...structuredClone(DEFAULT_STATE.awarded), ...state.awarded };
  selectedUnitIds = new Set(state.selectedUnits || []);
}
function saveLocal() { state.selectedUnits = [...selectedUnitIds]; localStorage.setItem(localKey(), JSON.stringify(state)); void cloudSave(); }
function progressFor(sentence) { return state.progress[sentence.no] || { correct: 0, status: "unlearned" }; }
function realSentences(unit) { return unit.sentences.filter(item => item.english && !item.english.includes("해당 없음") && item.korean && !item.korean.includes("해당 없음")); }
function unitPct(unit) { const list = realSentences(unit); return list.length ? Math.round(list.filter(item => progressFor(item).status === "complete").length / list.length * 100) : 0; }
function overallPct() { const all = units.flatMap(realSentences); return all.length ? Number((all.filter(item => progressFor(item).status === "complete").length / all.length * 100).toFixed(2)) : 0; }
function partPct(part) { const all = units.filter(unit => unit.part === part).flatMap(realSentences); return all.length ? Math.round(all.filter(item => progressFor(item).status === "complete").length / all.length * 100) : 0; }
function parts() { return [...new Set(units.map(unit => unit.part))]; }
function normalizeAnswer(text) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/'/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function getPoints() { return Number(state.points || 0); }
function humanDate(date = new Date()) { return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }
function setAccent() {
  const characterIndex = Number.isInteger(state.character) && state.character >= 0 && state.character < characters.length ? state.character : 0;
  const palette = [
    ["#d94e91","#ffedf5"],["#dc568c","#fff0f5"],["#7138bf","#eee4ff"],["#654acb","#efebff"],
    ["#347dbb","#eaf4ff"],["#4d5ec8","#edf0ff"],["#25896f","#e5f7f1"],["#37884f","#e9f7e9"],
    ["#d85b32","#fff0e8"],["#cf741c","#fff1e2"],["#be8611","#fff6dc"],["#b88b17","#fff7dc"]
  ][characterIndex] || ["#8050d6","#f0e9ff"];
  document.documentElement.style.setProperty("--accent", palette[0]);
  document.documentElement.style.setProperty("--accent-soft", palette[1]);
  document.documentElement.style.setProperty("--character-image", `url("./images/mood/${characterFiles[characterIndex]}")`);
  const selectedIcon = $("#selected-character-icon");
  if (selectedIcon) { selectedIcon.src = `./images/mood/${characterFiles[characterIndex]}`; selectedIcon.alt = characters[characterIndex]; }
  const selectedName = $("#selected-character-name");
  if (selectedName) selectedName.textContent = characters[characterIndex];
  $$ ("[data-mascot]").forEach(el => el.classList.add("mascot"));
}

function renderHome() {
  const done = Object.values(state.progress).filter(p => p.status === "complete").length;
  const all = units.flatMap(realSentences).length;
  $("#welcome-name").textContent = activeUser?.nickname ? `${activeUser.nickname}님, 반가워요!` : "반가워요!";
  $("#overall-progress").textContent = `${overallPct().toFixed(2)}%`;
  $("#overall-ring").style.background = `conic-gradient(var(--accent) ${overallPct().toFixed(2)}%, #eeeaf4 0)`;
  $("#overall-ring span").textContent = `${overallPct().toFixed(2)}%`;
  $("#correct-count").innerHTML = `${done} <small>/ ${all} 문장</small>`;
  $("#streak-count").innerHTML = `${state.streak || 0} <small>일</small>`;
  $("#points-total").textContent = getPoints().toLocaleString("ko-KR");
  $("#today-label").textContent = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long" });
  $("#part-progress").innerHTML = parts().map(part => `<div class="part-row"><div class="part-row-head"><b>${escapeHtml(part)}</b><span>${partPct(part)}% 완료</span></div><div class="progress-track"><div class="progress-fill" style="width:${partPct(part)}%"></div></div></div>`).join("");
  const today = humanDate(); const practiced = state.daily[today] || 0;
  const history = Object.entries(state.dailyByUnit || {}).sort(([a],[b])=>b.localeCompare(a)).slice(0,7);
  $("#daily-summary").innerHTML = history.length ? `<div class="daily-history">${history.map(([date,counts])=>`<div class="daily-record"><b>${date===today?"오늘":escapeHtml(date.slice(5).replace("-","."))}</b><span>${Object.entries(counts).map(([unit,count])=>`${escapeHtml(unit)} <strong>${count}</strong>문장`).join("　·　")}</span><em>${Object.values(counts).reduce((sum,count)=>sum+count,0)} 정답</em></div>`).join("")}</div>` : "아직 학습 기록이 없어요. 한 문제부터 시작해볼까요?";
  $("#user-label").textContent = activeUser?.nickname || "로그인";
  renderLeaderboard();
}
function localProfiles() { try { return JSON.parse(localStorage.getItem("kenglish-local-profiles")) || []; } catch { return []; } }
async function renderLeaderboard() {
 const target=$("#leaderboard-list");if(!target)return;if(!activeUser){target.textContent="로그인하면 전체 학습자와 진행률을 비교할 수 있어요.";return;}
 if(!firebase?.db){target.textContent="Firebase에 연결되면 전체 학습자 순위를 볼 수 있어요.";return;}
 try{const {collection,getDocs}=firebase.firestore;const snap=await getDocs(collection(firebase.db,"publicStats"));const entries=snap.docs.map(doc=>({uid:doc.id,...doc.data()})).sort((a,b)=>(Number(b.overall)||0)-(Number(a.overall)||0));if(!entries.some(item=>item.uid===activeUser.uid))entries.push({uid:activeUser.uid,nickname:activeUser.nickname,overall:overallPct()});entries.sort((a,b)=>(Number(b.overall)||0)-(Number(a.overall)||0));target.innerHTML=entries.map((item,index)=>'<div class="leaderboard-row '+(item.uid===activeUser.uid?'me':'')+'"><span class="leaderboard-rank">'+(index+1)+'</span><span>'+escapeHtml(item.nickname||'학습자')+(item.uid===activeUser.uid?' · 나':'')+'</span><span class="leaderboard-pct">'+(Number(item.overall)||0).toFixed(2)+'%</span></div>').join('');}catch(error){target.textContent="전체 사용자 진행률을 불러오지 못했어요.";console.warn("Leaderboard read failed",error);}
}

function renderUnits() {
  $("#unit-groups").innerHTML = parts().map(part => `<section class="unit-group"><h3 class="unit-group-title"><span class="part-badge">${escapeHtml(part)}</span><span>${partPct(part)}% 완료</span></h3><div class="unit-grid">${units.filter(u => u.part === part).map(unit => `<button class="unit-card ${selectedUnitIds.has(unit.number) ? "selected" : ""}" data-unit="${escapeHtml(unit.number)}"><span class="unit-check">${selectedUnitIds.has(unit.number) ? "✓" : ""}</span><span class="unit-title-wrap"><span class="unit-number">${escapeHtml(unit.number)}</span><span class="unit-name">${escapeHtml(unit.title)}</span></span><span class="unit-progress">${unitPct(unit)}%</span></button>`).join("")}</div></section>`).join("");
  $("#selection-count").textContent = `${selectedUnitIds.size}개 선택`;
  $("#selected-label").textContent = selectedUnitIds.size ? `${selectedUnitIds.size}개 Unit을 선택했어요` : "Unit을 선택해주세요";
  const selectAllButton = $("[data-action=select-all]"); if (selectAllButton) selectAllButton.textContent = selectedUnitIds.size === units.length ? "전체 선택 해제" : "전체 선택";
}
function setMenuOpen(open) {
  const sidebar = $(".sidebar"); const toggle = $("#menu-toggle"); const scrim = $("#menu-scrim");
  sidebar.classList.toggle("open", open); toggle.setAttribute("aria-expanded", String(open)); scrim.hidden = !open;
}
function showView(name) {
  if (name === "units") name = "home";
  if (name === "study" || name === "quiz") syncSelectedUnitsFromCards();
  view = name;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${name}`));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  const titles = { home:"오늘의 학습 · Unit 선택", stats:"학습 통계", study:"문장 학습하기", quiz:"영어 문장 만들기" };
  $("#page-title").textContent = titles[name] || "오늘의 학습";
  setMenuOpen(false);
  if (name === "home") { renderHome(); renderUnits(); }
  if (name === "stats") renderHome();
  if (name === "study") renderStudy();
  if (name === "quiz" && !currentQuiz) renderQuizSetup();
  window.location.hash = name === "stats" ? "stats" : name;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function syncSelectedUnitsFromCards() {
  const selectedCards = $$(".unit-card.selected");
  if (selectedCards.length) selectedUnitIds = new Set(selectedCards.map(card => card.dataset.unit));
  state.selectedUnits = [...selectedUnitIds];
}
function promptUnitSelection() {
  showView("home");
  requestAnimationFrame(() => $("#unit-groups")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  toast("먼저 학습할 Unit을 선택해주세요.");
}
function renderStudy() {
  const chosen = units.filter(unit => selectedUnitIds.has(unit.number));
  if (!chosen.length) {
    $("#study-content").innerHTML = `<div class="empty-state"><div class="empty-mascot mascot" data-mascot></div><h3>먼저 Unit을 골라주세요</h3><p>학습할 Unit을 선택하면 문장과 발음을 확인할 수 있어요.</p><button class="primary-button" data-action="choose-units">Unit 선택하기 →</button></div>`; return;
  }
  $("#study-content").innerHTML = chosen.map(unit => `<section class="study-header"><div class="study-unit-heading"><div><div class="eyebrow">${escapeHtml(unit.part)} · ${escapeHtml(unit.number)}</div><h2>${escapeHtml(unit.title)}</h2><p>문장 ${realSentences(unit).length}개 · 진행률 ${unitPct(unit)}%</p></div><div class="section-mascot mascot" data-mascot></div>${/^https?:\/\//i.test(unit.url) ? `<a class="video-link" href="${escapeHtml(unit.url)}" target="_blank" rel="noopener">▶ 강의 영상 보기</a>` : ""}</div></section><div class="sentence-list">${unit.sentences.map(sentence => { const isPlaceholder = !realSentences(unit).includes(sentence); const progress=progressFor(sentence); const status=progress.status==="complete"?`학습 완료 · 정답 ${progress.correct}회`:progress.status==="learning"?"다시 연습해요":"새 문장"; return `<article class="sentence-card"><span class="sentence-no">${escapeHtml(sentence.sentence_no)}</span><div><div class="sentence-ko">${escapeHtml(sentence.korean)}</div><div class="sentence-en ${isPlaceholder ? "sentence-empty" : ""}">${escapeHtml(sentence.english)}</div>${!isPlaceholder?`<div class="sentence-status ${progress.status}">${status}</div>`:""}</div>${!isPlaceholder ? `<button class="speak-button" data-speak="${escapeHtml(sentence.english)}" aria-label="영어 발음 듣기">◖</button>` : ""}</article>`; }).join("")}</div>`).join("");
}
function renderQuizSetup() {
  currentQuiz = null;
  const chosen = units.filter(unit => selectedUnitIds.has(unit.number));
  if (!chosen.length) { $("#quiz-content").innerHTML = `<div class="empty-state"><div class="empty-mascot mascot" data-mascot></div><h3>퀴즈할 Unit을 골라주세요</h3><p>하나 이상의 Unit을 선택한 후 퀴즈를 시작할 수 있어요.</p><button class="primary-button" data-action="choose-units">Unit 선택하기 →</button></div>`; return; }
  const count = chosen.reduce((sum, u) => sum + realSentences(u).length, 0);
  $("#quiz-content").innerHTML = `<div class="quiz-card"><div class="section-mascot mascot" data-mascot></div><div class="eyebrow">READY TO PRACTICE?</div><h2>문장 만들기 퀴즈</h2><p class="prompt-help">${chosen.map(u => escapeHtml(u.number)).join(" · ")}에서 문제가 무작위로 나와요.</p><div class="korean-prompt">몇 문제를 풀어볼까요?</div><label for="quiz-count">문제 수 <b id="quiz-count-label">${Math.min(10,count)}</b> / ${count}</label><input id="quiz-count" type="range" min="1" max="${count}" value="${Math.min(10,count)}" style="width:100%;accent-color:var(--accent);margin:12px 0 24px"><button class="primary-button" id="begin-quiz" style="width:100%">퀴즈 시작하기 →</button><p class="quiz-footer">힌트를 누르면 정답 문장의 단어를 섞어 보여줘요.</p></div>`;
  $("#quiz-count").addEventListener("input", event => $("#quiz-count-label").textContent = event.target.value);
  $("#begin-quiz").addEventListener("click", () => startQuiz(Number($("#quiz-count").value)));
}
function startQuiz(count) {
  const chosen = units.filter(unit => selectedUnitIds.has(unit.number)).flatMap(realSentences);
  if (!chosen.length) { promptUnitSelection(); return; }
  count = Math.max(1, Math.min(Number(count) || 1, chosen.length));
  const shuffled = [...chosen].sort(() => Math.random() - .5).slice(0, count);
  currentQuiz = { items: shuffled, index: 0, revealed: false, answered: false, hint: false, correct: 0 };
  renderQuizQuestion();
}
function renderQuizQuestion() {
  const quiz = currentQuiz; if (!quiz) return renderQuizSetup();
  if (quiz.index >= quiz.items.length) {
    const percent = Math.round(quiz.correct / quiz.items.length * 100);
    $("#quiz-content").innerHTML = `<div class="quiz-card quiz-finish" style="text-align:center;padding:50px 25px"><div class="section-mascot mascot" data-mascot></div><div class="stat-icon lilac" style="margin:0 auto 15px;font-size:24px">✦</div><div class="eyebrow">PRACTICE COMPLETE</div><h2>${quiz.correct === quiz.items.length ? "완벽해요! 오늘의 문장을 모두 맞혔어요 🎉" : "수고했어요! 한 문제씩 실력이 자라고 있어요."}</h2><p>${quiz.items.length}문제 중 <b>${quiz.correct}</b>개 정답 · ${percent}%</p><button class="primary-button" id="finish-quiz">홈으로 돌아가기 →</button><p class="quiz-footer">복습이 필요한 문장은 학습 메뉴에서 다시 확인할 수 있어요.</p></div>`;
    $("#finish-quiz").addEventListener("click", () => { currentQuiz = null; showView("home"); }); return;
  }
  const item = quiz.items[quiz.index];
  const displayUnit = units.find(u => u.number === item.unit_no);
  const feedback = quiz.revealed ? `<div class="quiz-feedback ${quiz.answered ? "good" : "try"}">${quiz.answered ? ["멋져요! 정확한 문장이에요 ✨","아주 잘했어요! 다음 문장도 해봐요 🌷","완벽해요, 한 걸음 더 성장했어요 🎉"][quiz.index % 3] : ["괜찮아요, 다시 한 번 천천히 써봐요 💪","거의 다 왔어요! 정답을 확인하고 다시 도전해요 🌱","연습하다 보면 금방 익숙해질 거예요 😊"][quiz.index % 3]}${!quiz.answered ? `<span class="correct-answer">정답: ${escapeHtml(item.english)}</span>` : ""}</div>` : "";
  const words = item.english.match(/[A-Za-z]+(?:['’][A-Za-z]+)?|[^\sA-Za-z]+/g) || [];
  $("#quiz-content").innerHTML = `<div class="quiz-top"><div class="quiz-progress"><span style="width:${Math.round((quiz.index+1)/quiz.items.length*100)}%"></span></div><b>문제 ${quiz.index+1} / ${quiz.items.length}</b><button class="quiz-exit-button" id="quiz-exit">나가기</button></div><div class="quiz-card"><div class="section-mascot mascot" data-mascot></div><div class="quiz-unit-label">${escapeHtml(item.unit_no)} · ${escapeHtml(item.sentence_no)}번</div><h2>영어 문장을 만들어보세요</h2><p class="prompt-help">한국어 문장을 영어로 적어주세요.</p><div class="korean-prompt">${escapeHtml(item.korean)}</div><form id="answer-form"><input class="answer-input" id="answer-input" autocomplete="off" placeholder="영어 문장을 입력해보세요" ${quiz.answered ? "disabled" : ""} value="${escapeHtml(quiz.input || "")}"><div class="hint-area"><button type="button" class="hint-button" id="hint-button">${quiz.hint ? "힌트를 숨기기 ↑" : "✦ 단어 힌트 보기"}</button>${quiz.hint ? `<div class="hint-words">${[...words].sort(() => Math.random()-.5).map(word => `<span class="hint-word">${escapeHtml(word)}</span>`).join("")}</div>` : ""}</div>${feedback}<div class="quiz-controls">${quiz.revealed && !quiz.answered ? `<button type="button" class="secondary-button" id="retry-answer">다시 풀기</button>` : ""}<button class="primary-button" type="submit">${quiz.revealed && quiz.answered ? "다음 문제 →" : "정답 확인"}</button></div></form><p class="quiz-footer">대소문자, 공백, 문장부호 차이는 채점에서 무시해요.</p></div>`;
  $("#quiz-exit").addEventListener("click", () => { currentQuiz = null; renderQuizSetup(); });
  $("#hint-button").addEventListener("click", () => { quiz.hint = !quiz.hint; renderQuizQuestion(); });
  if (!quiz.answered) $("#answer-input").addEventListener("input", e => quiz.input = e.target.value);
  $("#answer-form").addEventListener("submit", event => {
    event.preventDefault();
    if (quiz.revealed && quiz.answered) { quiz.index++; quiz.revealed = false; quiz.answered = false; quiz.hint = false; quiz.input = ""; renderQuizQuestion(); return; }
    if (quiz.revealed) return;
    quiz.input = $("#answer-input").value;
    const correct = normalizeAnswer(quiz.input) === normalizeAnswer(item.english);
    quiz.revealed = true; quiz.answered = correct;
    if (correct) { quiz.correct++; recordCorrect(item); }
    else { const existing = progressFor(item); state.progress[item.no] = { ...existing, status: "learning" }; saveLocal(); }
    renderQuizQuestion();
  });
  $("#retry-answer")?.addEventListener("click", () => { quiz.revealed=false; quiz.hint=false; renderQuizQuestion(); $("#answer-input")?.focus(); });
  if (!quiz.revealed) $("#answer-input")?.focus({preventScroll:true});
}

async function recordCorrect(item) {
  const previous = progressFor(item); state.progress[item.no] = { correct: previous.correct + 1, status: "complete" };
  const today = humanDate(); state.daily[today] = (state.daily[today] || 0) + 1;
  state.dailyByUnit[today] ??= {}; state.dailyByUnit[today][item.unit_no] = (state.dailyByUnit[today][item.unit_no] || 0) + 1;
  const oldStreak = Number(state.streak || 0);
  if (state.lastStudyDate !== today) {
    if (state.lastStudyDate) { const yesterday = new Date(`${today}T00:00:00+09:00`); yesterday.setDate(yesterday.getDate()-1); const continued = state.lastStudyDate === humanDate(yesterday); state.streak = continued ? oldStreak + 1 : 1; if (!continued) { state.awarded.streak5Run = 0; state.awarded.streak10Run = 0; } }
    else state.streak = 1;
    state.lastStudyDate = today;
  }
  state.points = getPoints() + 10;
  awardCompletions();
  const streak = Number(state.streak || 0);
  if (streak >= 5 && streak % 5 === 0 && state.awarded.streak5Run < streak) { state.points += 1000; state.awarded.streak5 += 1; state.awarded.streak5Run = streak; toast(`${streak}일 연속 학습! +1,000 point 🌟`); }
  if (streak >= 10 && streak % 10 === 0 && state.awarded.streak10Run < streak) { state.points += 3000; state.awarded.streak10 += 1; state.awarded.streak10Run = streak; toast(`${streak}일 연속 학습! +3,000 point 🎉`); }
  saveLocal(); renderHome(); renderUnits();;
  if (overallPct() === 100 && !state.awarded.complete) { state.awarded.complete = true; saveLocal(); setTimeout(() => showModal(`<div style="text-align:center"><div class="stat-icon yellow" style="margin:auto;font-size:23px">✦</div><div class="eyebrow" style="margin-top:14px">ALL LESSONS COMPLETE</div><h2>정말 멋져요! 🎊</h2><p>전체 학습을 100% 완료했어요.<br>꾸준한 노력이 정말 대단해요!<br>오늘은 스스로에게 작은 선물을 주세요 ✨</p></div>`), 300); }
}
function awardCompletions() {
  for (const unit of units) if (unitPct(unit) === 100 && !state.awarded.units.includes(unit.number)) { state.awarded.units.push(unit.number); state.points += 500; }
  for (const part of parts()) if (partPct(part) === 100 && !state.awarded.parts.includes(part)) { state.awarded.parts.push(part); state.points += 1000; }
}
function speak(text) { if (!window.speechSynthesis) return toast("이 브라우저에서는 음성 읽기를 지원하지 않아요."); speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = .85; speechSynthesis.speak(utterance); }

function showModal(content) { $("#modal-content").innerHTML = content + '<div class="modal-mascot mascot" data-mascot></div>'; setAccent(); $("#modal").hidden = false; }
function closeModal() { $("#modal").hidden = true; }
function toast(message) { let node = $(".toast"); if (!node) { node = document.createElement("div"); node.className = "toast"; document.body.append(node); } node.textContent = message; node.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => node.hidden = true, 2900); }
function openCharacterPicker() {
  const choices = characters.map((name,index) => `<button class="character-option ${state.character===index?"active":""}" data-character="${index}"><img class="character-face" src="./images/mood/${characterFiles[index]}" alt="${name}"><span>${name}</span></button>`).join("");
  showModal(`<div class="eyebrow">PICK YOUR MOOD</div><h2 id="modal-title">오늘의 기분 캐릭터</h2><p>마음에 드는 친구를 골라보세요. 앱 색상도 함께 바뀌어요.</p><div class="character-grid">${choices}</div>`);
  $$("[data-character]", $("#modal-content")).forEach(button => button.addEventListener("click", () => { state.character = Number(button.dataset.character); setAccent(); saveLocal(); closeModal(); }));
}
function openPoints() {
  const completeUnits = units.filter(unit => unitPct(unit) === 100).length;
  const completeParts = parts().filter(part => partPct(part) === 100).length;
  const answerPoints = Object.values(state.progress).reduce((sum,p) => sum + (p.correct||0),0)*10;
  const unitPoints = completeUnits*500, partPoints=completeParts*1000;
  const streakPoints = (state.awarded.streak5||0)*1000 + (state.awarded.streak10||0)*3000;
  showModal(`<div class="eyebrow">YOUR POINTS</div><h2 id="modal-title">나의 포인트</h2><p>꾸준한 학습으로 모은 포인트예요.</p><table class="point-table"><tr><td>문장 정답 (${Object.values(state.progress).reduce((sum,p)=>sum+(p.correct||0),0)}회 × 10)</td><td>${answerPoints.toLocaleString()} pt</td></tr><tr><td>완료 Unit (${completeUnits}개 × 500)</td><td>${unitPoints.toLocaleString()} pt</td></tr><tr><td>완료 Part (${completeParts}개 × 1,000)</td><td>${partPoints.toLocaleString()} pt</td></tr><tr><td>연속 학습 보너스</td><td>${streakPoints.toLocaleString()} pt</td></tr><tr><td><b>현재 보유 포인트</b></td><td><b>${getPoints().toLocaleString()} pt</b></td></tr></table><p class="modal-note">연속 학습 보너스는 5일 달성 시 1,000pt, 10일 달성 시 3,000pt가 지급돼요.</p>`);
}

async function openAuth(mode="login") {
  if (activeUser) {
    if (firebase?.auth) { firebase.auth.signOut().then(() => { activeUser = null; localStorage.removeItem(USER_KEY); loadLocal(); renderHome(); toast("로그아웃했어요."); }).catch(() => toast("로그아웃에 실패했어요.")); }
    else { activeUser=null; localStorage.removeItem(USER_KEY); renderHome(); toast("로그아웃했어요."); }
    return;
  }
  if (!firebase?.auth && firebasePromise) await firebasePromise;
  if (!firebase?.auth) { showModal(`<div class="eyebrow">ACCOUNT</div><h2 id="modal-title">Firebase 인증을 확인해주세요</h2><p>${escapeHtml(firebaseFailure || "Firebase 인증 서비스를 불러오지 못했습니다.")}</p><p class="modal-note">계정 인증을 사용할 수 없어요. 학습 기록은 이 기기에 저장됩니다.</p><button class="primary-button" id="auth-close-local">닫기</button>`); $("#auth-close-local").addEventListener("click",closeModal); return; }
  renderAuthForm(mode);
}
function renderAuthForm(mode="login", message="") {
 const profiles=localProfiles();const options=profiles.map(profile=>'<option value="'+escapeHtml(profile.nickname)+'">'+escapeHtml(profile.nickname)+'</option>').join('');
 const login='<label>아이디<input name="id" required autocomplete="username" placeholder="가입할 때 사용한 아이디"></label>';
 const register='<label>아이디<input name="id" required minlength="3" maxlength="30" autocomplete="username" placeholder="영문과 숫자로 입력"></label><label>닉네임<input name="nickname" required minlength="2" maxlength="20" placeholder="앱에서 표시할 이름"></label>';
 showModal('<div class="eyebrow">YOUR ENGLISH ACCOUNT</div><h2 id="modal-title">학습 기록을 Firebase 계정에 저장해요</h2><div class="modal-tabs"><button class="modal-tab '+(mode==='login'?'active':'')+'" data-auth-mode="login">로그인</button><button class="modal-tab '+(mode==='register'?'active':'')+'" data-auth-mode="register">회원가입</button></div>'+(message?'<p class="modal-message">'+escapeHtml(message)+'</p>':'')+'<form class="modal-form" id="auth-form">'+(mode==='login'?login:register)+'<label>비밀번호<input name="password" type="password" required minlength="6" autocomplete="'+(mode==='login'?'current-password':'new-password')+'" placeholder="6자 이상"></label><button class="primary-button" type="submit">'+(mode==='login'?'로그인':'가입하고 시작하기')+'</button></form><p class="modal-note">학습 기록은 로그인한 Firebase 계정에 저장되어 다른 기기에서도 이어서 사용할 수 있어요.</p>');
 $$('[data-auth-mode]',$("#modal-content")).forEach(button=>button.addEventListener('click',()=>renderAuthForm(button.dataset.authMode)));
 $("#auth-form").addEventListener('submit',async event=>{event.preventDefault();const form=new FormData(event.currentTarget);const password=String(form.get('password'));try{
  const {createUserWithEmailAndPassword,signInWithEmailAndPassword,updateProfile}=firebase.authApi;let credential,nickname;const known=localProfiles();
  if(mode==='register'){const id=String(form.get('id')).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');nickname=String(form.get('nickname')).trim();if(id.length<3)throw new Error('아이디는 영문/숫자 3자 이상으로 입력해주세요.');if(known.some(item=>item.loginId===id||item.nickname.toLocaleLowerCase()===nickname.toLocaleLowerCase()))throw new Error('이미 사용 중인 아이디 또는 닉네임이에요.');credential=await createUserWithEmailAndPassword(firebase.auth,id+'@kenglish.app',password);await updateProfile(credential.user,{displayName:nickname});known.push({uid:credential.user.uid,nickname,loginId:id});localStorage.setItem('kenglish-local-profiles',JSON.stringify(known));state=structuredClone(DEFAULT_STATE);selectedUnitIds=new Set();}
  else{const id=String(form.get('id')).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');if(id.length<3)throw new Error('아이디를 입력해주세요.');credential=await signInWithEmailAndPassword(firebase.auth,id+'@kenglish.app',password);nickname=known.find(item=>item.loginId===id)?.nickname||credential.user.displayName||id;state=structuredClone(DEFAULT_STATE);selectedUnitIds=new Set();if(!known.some(item=>item.uid===credential.user.uid)){known.push({uid:credential.user.uid,nickname,loginId:id});localStorage.setItem('kenglish-local-profiles',JSON.stringify(known));}}
  activeUser={uid:credential.user.uid,nickname};localStorage.setItem(USER_KEY,JSON.stringify(activeUser));loadLocal();if(mode==="login")await loadCloud();else await cloudSave();closeModal();setAccent();renderHome();renderUnits();toast(nickname+'님, '+(mode==='register'?'환영해요':'다시 만나 반가워요')+'!');
 }catch(error){renderAuthForm(mode,friendlyAuthError(error));}});
}

function friendlyAuthError(error) { const code=error.code||""; if(code.includes("operation-not-allowed")) return "Firebase Console에서 이메일/비밀번호 로그인 제공업체를 활성화해주세요."; if(code.includes("email-already")) return "이미 사용 중인 아이디예요."; if(code.includes("weak-password")) return "비밀번호는 6자 이상으로 입력해주세요."; if(code.includes("invalid-credential")||code.includes("wrong-password")||code.includes("user-not-found")) return "아이디 또는 비밀번호를 확인해주세요."; if(code.includes("permission-denied")) return "다시 시도해주세요."; return error.message||"요청을 처리하지 못했어요."; }


async function cloudSave() {
 if(!activeUser?.uid||!firebase?.db)return;
 try{const {doc,setDoc}=firebase.firestore;const profile=localProfiles().find(item=>item.uid===activeUser.uid);const writes=[setDoc(doc(firebase.db,"users",activeUser.uid,"progress","current"),state),setDoc(doc(firebase.db,"publicStats",activeUser.uid),{nickname:activeUser.nickname,overall:overallPct(),updatedAt:new Date().toISOString()}),setDoc(doc(firebase.db,"publicProfiles",activeUser.uid),{nickname:activeUser.nickname,loginId:profile?.loginId||activeUser.uid,createdAt:profile?.createdAt||new Date().toISOString()},{merge:true})];await Promise.all(writes);void renderLeaderboard();}catch(error){console.warn("Firebase save failed",error);if(error.code==="permission-denied")toast("Firebase 보안 규칙을 배포해야 클라우드에 저장할 수 있어요.");}
}
async function loadCloud() {
 if(!activeUser?.uid||!firebase?.db)return;
 try{const {doc,getDoc}=firebase.firestore;const snapshot=await getDoc(doc(firebase.db,"users",activeUser.uid,"progress","current"));if(snapshot.exists()){state={...structuredClone(DEFAULT_STATE),...snapshot.data()};state.awarded={...structuredClone(DEFAULT_STATE.awarded),...state.awarded};selectedUnitIds=new Set(state.selectedUnits||[]);state.selectedUnits=[...selectedUnitIds];localStorage.setItem(localKey(),JSON.stringify(state));}else{state=structuredClone(DEFAULT_STATE);selectedUnitIds=new Set();localStorage.setItem(localKey(),JSON.stringify(state));}}
 catch(error){console.warn("Firebase load failed",error);toast("Firebase 기록을 불러오지 못했어요. 이 기기의 기록을 사용합니다.");}
}
async function initFirebase() {
 try{const [appSdk,authSdk,dbSdk]=await Promise.all([import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")]);const app=appSdk.initializeApp(firebaseConfig);const auth=authSdk.getAuth(app);const db=dbSdk.getFirestore(app);firebase={auth,db,authApi:authSdk,firestore:dbSdk};authSdk.onAuthStateChanged(auth,async user=>{if(!user){if(activeUser?.uid){activeUser=null;localStorage.removeItem(USER_KEY);loadLocal();renderHome();renderUnits();}return;}const profile=localProfiles().find(item=>item.uid===user.uid);activeUser={uid:user.uid,nickname:profile?.nickname||user.displayName||user.email?.split("@")[0]||"학습자"};localStorage.setItem(USER_KEY,JSON.stringify(activeUser));loadLocal();await loadCloud();void cloudSave();setAccent();renderHome();renderUnits();});}catch(error){firebaseFailure=window.location.protocol==="file:"?"index.html을 파일로 직접 열고 있습니다. VS Code Live Server 또는 http://localhost 웹 서버로 실행해주세요.":"Firebase SDK 초기화 오류: "+(error?.message||String(error));console.error("Firebase initialization failed",error);}
}


document.addEventListener("click",event=>{
  const nav=event.target.closest("[data-view]"); if(nav){showView(nav.dataset.view);return;}
  const unitButton=event.target.closest("[data-unit]"); if(unitButton){const id=unitButton.dataset.unit; selectedUnitIds.has(id)?selectedUnitIds.delete(id):selectedUnitIds.add(id); saveLocal();renderUnits();return;}
  const action=event.target.closest("[data-action]")?.dataset.action;
  if(action==="select-all"){ selectedUnitIds = selectedUnitIds.size === units.length ? new Set() : new Set(units.map(unit=>unit.number)); saveLocal(); renderUnits(); return; }
  if(action==="start-study"){if(!selectedUnitIds.size){promptUnitSelection();return;}showView("study");return;}
  if(action==="start-quiz"){if(!selectedUnitIds.size){promptUnitSelection();return;}showView("quiz");return;}
  if(action==="choose-units"){promptUnitSelection();return;}
  const speakButton=event.target.closest("[data-speak]"); if(speakButton){speak(speakButton.dataset.speak);return;}
});
$("#user-button").addEventListener("click",()=>openAuth());
$("#points-button").addEventListener("click",openPoints);
$("#character-action").addEventListener("click",openCharacterPicker);
$("#menu-toggle").addEventListener("click",()=>setMenuOpen(!$(".sidebar").classList.contains("open")));
$("#menu-scrim").addEventListener("click",()=>setMenuOpen(false));
$("#modal-close").addEventListener("click",event=>{event.preventDefault();event.stopPropagation();closeModal();});
$("#modal").addEventListener("click",event=>{if(event.target.id==="modal")closeModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeModal();});

loadLocal(); setAccent(); renderHome(); renderUnits();
if(!sentences.length){toast("문장 데이터를 확인해주세요. data/kenglish.json을 찾지 못했습니다.");}
if(window.location.hash==="#stats"||window.location.hash==="#study"||window.location.hash==="#quiz") showView(window.location.hash.slice(1));
firebasePromise = initFirebase();
