// ===============================
// Lab Series OX Championship V1
// Firebase Realtime Database 필요
// 1) firebaseConfig 부분만 본인 프로젝트 값으로 교체
// 2) GitHub에 업로드하면 Vercel 자동 배포
// ===============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// TODO: Firebase 콘솔에서 복사한 config로 교체하세요.
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

const QUESTIONS = [
  { text: "남성의 피부결은\n여성보다 더 거친 편이다.", answer: "O" },
  { text: "남성 피부는 여성 피부와\n동일한 제품과 케어를\n사용하는 것이 가장 효과적이다.", answer: "X" },
  { text: "남성은 여성보다\n피지샘이 크고 피지 분비량이 많아,\n모공이 더 넓어 보이는 경향이 있다.", answer: "O" },
  { text: "남성 피부는 여성보다\n수분 함유량이 높다.", answer: "X" },
  { text: "남성 피부는 호르몬의 영향으로\n여성보다 지방 함량이 많아\n피부가 더 두껍다.", answer: "X" },
  { text: "남성과 여성의 피부는\n기본 구조부터 다르기 때문에,\n각각에 맞는 제품과 케어가 필요하다.", answer: "X" },
  { text: "남성 피부는 두껍기 때문에\n주름이 거의 생기지 않는다.", answer: "X" },
  { text: "남성의 피부는\n빛을 다양한 방향으로 반사하여\n피부가 더욱 칙칙해 보입니다.", answer: "O" }
];
const DURATION = 15;
const TEAMS = ["1조", "2조", "3조", "4조"];
const GAME_ID = "main";

let app, db;
try {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
} catch (e) {
  console.error(e);
}

const $app = document.getElementById("app");
const qs = new URLSearchParams(location.search);
const mode = qs.get("mode") || "player";
const pidKey = "labseries_pid";
const nameKey = "labseries_name";
const teamKey = "labseries_team";

function gameRef(path="") { return ref(db, `games/${GAME_ID}${path ? "/"+path : ""}`); }
function uid(){ return "p_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-4); }
function esc(s){ return String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c])); }
function render(html){ $app.innerHTML = html; }
function firebaseMissing(){ return firebaseConfig.apiKey.includes("PASTE_"); }

if (mode === "admin") renderAdmin();
else renderPlayer();

function shell(inner){
  return `<div class="wrap"><div class="card">${inner}</div><div class="footer center">Lab Series Men's Skin Championship</div></div>`;
}

function renderPlayer(){
  if (firebaseMissing()) {
    render(shell(`<h1 class="title">Firebase 설정이 필요합니다</h1><p>app.js의 firebaseConfig를 먼저 입력해야 실시간 퀴즈가 동작합니다.</p>`));
    return;
  }
  let pid = localStorage.getItem(pidKey);
  const savedName = localStorage.getItem(nameKey) || "";
  const savedTeam = localStorage.getItem(teamKey) || "1조";
  if (!pid) { pid = uid(); localStorage.setItem(pidKey, pid); }

  renderJoin(savedName, savedTeam, pid);
}

function renderJoin(savedName, savedTeam, pid){
  render(shell(`
    <div class="pill">OX 예선전</div>
    <h1 class="title">Lab Series<br/>Men's Skin Championship</h1>
    <p class="sub">이름과 조를 입력하고 대기해주세요. 진행자가 시작하면 모든 참가자가 동시에 시작합니다.</p>
    <div class="row">
      <div class="field"><label>조 선택</label><select id="team">${TEAMS.map(t=>`<option ${t===savedTeam?"selected":""}>${t}</option>`).join("")}</select></div>
      <div class="field"><label>이름</label><input id="name" value="${esc(savedName)}" placeholder="예) 홍길동" /></div>
      <button class="btn btn-primary" id="joinBtn">입장하기</button>
    </div>
  `));
  document.getElementById("joinBtn").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    const team = document.getElementById("team").value;
    if (!name) return alert("이름을 입력해주세요.");
    localStorage.setItem(nameKey, name);
    localStorage.setItem(teamKey, team);
    await set(gameRef(`players/${pid}`), { name, team, score:0, joinedAt: Date.now() });
    renderWaiting(pid, name, team);
  };
}

function renderWaiting(pid, name, team){
  render(shell(`
    <div class="pill">입장 완료</div>
    <h1 class="title">${esc(team)} ${esc(name)}님</h1>
    <p class="sub">진행자가 시작 버튼을 누르면 퀴즈가 자동으로 시작됩니다.</p>
    <div class="notice">화면을 닫지 말고 기다려주세요.</div>
  `));
  onValue(gameRef("state"), snap => {
    const state = snap.val();
    if (state?.status === "running") renderQuestion(pid);
    if (state?.status === "finished") renderPlayerResult(pid);
  });
}

let qUnsubStarted = false;
function renderQuestion(pid){
  if(qUnsubStarted) return;
  qUnsubStarted = true;
  onValue(gameRef("state"), async snap => {
    const state = snap.val();
    if (!state) return;
    if (state.status === "finished") return renderPlayerResult(pid);
    const idx = state.currentQuestion ?? 0;
    const q = QUESTIONS[idx];
    if (!q) return;
    const endAt = state.questionEndAt || (Date.now()+DURATION*1000);
    let answered = false;
    const ansSnap = await get(gameRef(`answers/${idx}/${pid}`));
    answered = ansSnap.exists();
    render(shell(`
      <div class="topbar"><div class="pill">Q${idx+1} / ${QUESTIONS.length}</div><div class="timeText"><span id="left">15</span>초</div></div>
      <div class="timerWrap"><div class="timerBar" id="bar"></div></div>
      <div class="question">${esc(q.text)}</div>
      <div class="big-actions">
        <button class="btn ox o" id="btnO" ${answered?"disabled":""}>O</button>
        <button class="btn ox x" id="btnX" ${answered?"disabled":""}>X</button>
      </div>
      <p class="center muted" id="status">${answered ? "답변이 제출되었습니다." : "정답이라고 생각하는 버튼을 눌러주세요."}</p>
    `));
    const submit = async (answer) => {
      if (answered) return;
      answered = true;
      const correct = answer === q.answer;
      await set(gameRef(`answers/${idx}/${pid}`), { answer, correct, answeredAt: Date.now() });
      if (correct) {
        const playerSnap = await get(gameRef(`players/${pid}`));
        const player = playerSnap.val() || {};
        await update(gameRef(`players/${pid}`), { score: (player.score || 0) + 1 });
      }
      document.getElementById("btnO").disabled = true;
      document.getElementById("btnX").disabled = true;
      document.getElementById("status").textContent = "답변이 제출되었습니다.";
    };
    document.getElementById("btnO").onclick = () => submit("O");
    document.getElementById("btnX").onclick = () => submit("X");
    startTimer(endAt);
  });
}

function startTimer(endAt){
  const leftEl = document.getElementById("left");
  const bar = document.getElementById("bar");
  const tick = () => {
    const leftMs = Math.max(0, endAt - Date.now());
    const leftSec = Math.ceil(leftMs/1000);
    if(leftEl) leftEl.textContent = leftSec;
    if(bar) bar.style.width = `${Math.max(0, Math.min(100, leftMs/(DURATION*1000)*100))}%`;
    if(leftMs > 0) requestAnimationFrame(tick);
  };
  tick();
}

async function renderPlayerResult(pid){
  const pSnap = await get(gameRef(`players/${pid}`));
  const p = pSnap.val();
  render(shell(`
    <div class="pill">결과</div>
    <h1 class="title">수고하셨습니다!</h1>
    <p class="sub">${esc(p?.team || "")} ${esc(p?.name || "")}님의 점수</p>
    <div class="center score">${p?.score || 0} / ${QUESTIONS.length}</div>
  `));
}

function renderAdmin(){
  if (firebaseMissing()) {
    render(shell(`<h1 class="title">Firebase 설정이 필요합니다</h1><p>app.js의 firebaseConfig를 먼저 입력해야 관리자 화면이 동작합니다.</p>`));
    return;
  }
  render(shell(`
    <div class="pill">진행자 화면</div>
    <h1 class="title">OX 예선전 관리자</h1>
    <p class="sub">참가자 입장 확인 후 시작을 누르면 모든 참가자가 동시에 시작합니다.</p>
    <div class="tabs"><span class="tab active">관리자 주소</span><span class="tab">?mode=admin</span></div>
    <div class="row">
      <button class="btn btn-primary" id="startBtn">퀴즈 시작</button>
      <button class="btn btn-ghost" id="resetBtn">전체 초기화</button>
    </div>
    <div id="adminBody" style="margin-top:18px"></div>
  `));
  document.getElementById("startBtn").onclick = startGame;
  document.getElementById("resetBtn").onclick = async () => { if(confirm("참가자/점수/응답을 모두 초기화할까요?")) await resetGame(); };
  listenAdmin();
}

async function resetGame(){
  await remove(gameRef());
  await set(gameRef("state"), { status:"waiting", currentQuestion:0, updatedAt: serverTimestamp() });
}

async function startGame(){
  await set(gameRef("state"), {
    status:"running",
    currentQuestion:0,
    questionStartAt: Date.now(),
    questionEndAt: Date.now() + DURATION*1000,
    updatedAt: serverTimestamp()
  });
  scheduleNext(0);
}

function scheduleNext(idx){
  setTimeout(async () => {
    const next = idx + 1;
    if(next >= QUESTIONS.length){
      await update(gameRef("state"), { status:"finished", finishedAt: Date.now() });
      return;
    }
    await update(gameRef("state"), {
      currentQuestion: next,
      questionStartAt: Date.now(),
      questionEndAt: Date.now() + DURATION*1000,
      updatedAt: serverTimestamp()
    });
    scheduleNext(next);
  }, DURATION*1000 + 900);
}

function listenAdmin(){
  onValue(gameRef(), snap => {
    const data = snap.val() || {};
    const players = Object.entries(data.players || {}).map(([id,p]) => ({id,...p}));
    const state = data.state || {status:"waiting", currentQuestion:0};
    const answers = data.answers || {};
    const idx = state.currentQuestion ?? 0;
    const currentAnswers = answers[idx] || {};
    const byTeam = TEAMS.map(team => {
      const members = players.filter(p=>p.team===team);
      return { team, total: members.length, answered: members.filter(p=>currentAnswers[p.id]).length };
    });
    const leaders = getLeaders(players);
    const ranking = [...players].sort((a,b)=>(b.score||0)-(a.score||0) || String(a.name).localeCompare(String(b.name),'ko'));
    document.getElementById("adminBody").innerHTML = `
      <div class="adminGrid">
        <div class="stat"><h3>현재 상태</h3><p><b>${state.status === "running" ? `진행 중 Q${idx+1}/${QUESTIONS.length}` : state.status === "finished" ? "종료" : "대기 중"}</b></p><p class="small muted">참가자 ${players.length}명</p></div>
        <div class="stat"><h3>현재 응답</h3>${byTeam.map(t=>`<p><b>${t.team}</b> ${t.answered}/${t.total}</p>`).join("")}</div>
      </div>
      <div class="adminGrid" style="margin-top:16px">
        <div class="stat"><h3>개인 순위</h3><div class="list">${ranking.map((p,i)=>`<div class="person"><span>${i+1}. ${esc(p.team)} ${esc(p.name)}</span><b>${p.score||0}점</b></div>`).join("") || "아직 참가자가 없습니다."}</div></div>
        <div class="stat"><h3>조별 최고 득점자</h3><div class="list">${TEAMS.map(t=>{
          const l = leaders[t];
          return `<div class="person leader"><span>${t}</span><b>${l ? `${esc(l.name)} ${l.score||0}점` : "-"}</b></div>`;
        }).join("")}</div></div>
      </div>
      ${state.status === "finished" ? `<div class="notice"><b>퀴즈 종료!</b> 조별 최고 득점자가 왕중왕전 대표입니다.</div>` : ""}
    `;
  });
}

function getLeaders(players){
  const leaders = {};
  TEAMS.forEach(team => {
    const members = players.filter(p=>p.team===team).sort((a,b)=>(b.score||0)-(a.score||0) || String(a.name).localeCompare(String(b.name),'ko'));
    leaders[team] = members[0] || null;
  });
  return leaders;
}
