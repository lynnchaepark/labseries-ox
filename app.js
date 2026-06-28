import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection,
  getDocs, deleteDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAYG9bQoDqxvWWX3mteFJo_4Oxp029SIm8",
  authDomain: "labseries-ox.firebaseapp.com",
  projectId: "labseries-ox",
  storageBucket: "labseries-ox.firebasestorage.app",
  messagingSenderId: "889787435877",
  appId: "1:889787435877:web:be840874b87a226225af8c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const GAME_ID = "main";
const QUESTION_SECONDS = 15;

const questions = [
  {
    text: "남성의 피부결은\n여성보다 더 거친 편이다.",
    answer: "O"
  },
  {
    text: "남성 피부는 여성 피부와\n동일한 제품과 케어를\n사용하는 것이 가장 효과적이다.",
    answer: "X"
  },
  {
    text: "남성은 여성보다\n피지샘이 크고 피지 분비량이 많아,\n모공이 더 넓어 보이는 경향이 있다.",
    answer: "O"
  },
  {
    text: "남성 피부는 여성보다\n수분 함유량이 높다.",
    answer: "X"
  },
  {
    text: "남성 피부는 호르몬의 영향으로\n여성보다 지방 함량이 많아\n피부가 더 두껍다.",
    answer: "X"
  },
  {
    text: "남성과 여성의 피부는\n기본 구조부터 다르기 때문에,\n각각에 맞는 제품과 케어가 필요하다.",
    answer: "X"
  },
  {
    text: "남성 피부는 두껍기 때문에\n주름이 거의 생기지 않는다.",
    answer: "X"
  },
  {
    text: "남성의 피부는\n빛을 다양한 방향으로 반사하여\n피부가 더욱 칙칙해 보입니다.",
    answer: "O"
  }
];

const $app = document.getElementById("app");
const stateRef = doc(db, "games", GAME_ID);
const playersCol = collection(db, "games", GAME_ID, "players");
const answersCol = collection(db, "games", GAME_ID, "answers");
let localTimer = null;
let cachedPlayers = [];
let cachedAnswers = [];

const params = new URLSearchParams(location.search);
const isAdmin = params.get("mode") === "admin";

function uid() {
  const existing = localStorage.getItem("labseriesPlayerId");
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  localStorage.setItem("labseriesPlayerId", id);
  return id;
}

function html(strings, ...vals) {
  return strings.map((s, i) => s + (vals[i] ?? "")).join("");
}

async function ensureGame() {
  const snap = await getDoc(stateRef);
  if (!snap.exists()) {
    await setDoc(stateRef, {
      status: "waiting",
      currentQuestion: 0,
      questionStartedAt: null,
      questionSeconds: QUESTION_SECONDS,
      updatedAt: serverTimestamp()
    });
  }
}

function scorePlayer(playerId) {
  return cachedAnswers
    .filter(a => a.playerId === playerId && questions[a.questionIndex]?.answer === a.choice)
    .length;
}

function renderParticipant() {
  const playerId = uid();
  const savedName = localStorage.getItem("labseriesName") || "";
  const savedTeam = localStorage.getItem("labseriesTeam") || "1조";
  $app.innerHTML = html`
    <main class="container">
      <section class="card">
        <div class="header">
          <div class="logo">Lab Series OX Championship</div>
          <div class="badge">예선전</div>
        </div>
        <h1 class="title">입장하기</h1>
        <p class="subtitle">조를 선택하고 이름을 입력해주세요. 진행자가 시작하면 모든 참가자가 동시에 퀴즈를 시작합니다.</p>
        <div class="field">
          <label class="label">조 선택</label>
          <select id="team">
            ${["1조","2조","3조","4조"].map(t => `<option ${savedTeam===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label class="label">이름</label>
          <input id="name" placeholder="예) 홍길동" value="${savedName}" />
        </div>
        <button class="primary" id="joinBtn">입장하기</button>
        <div class="notice small">진행자 화면: 주소 뒤에 <b>?mode=admin</b> 을 붙이면 됩니다.</div>
      </section>
    </main>`;
  document.getElementById("joinBtn").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    const team = document.getElementById("team").value;
    if (!name) return alert("이름을 입력해주세요.");
    localStorage.setItem("labseriesName", name);
    localStorage.setItem("labseriesTeam", team);
    await setDoc(doc(playersCol, playerId), { id: playerId, name, team, joinedAt: serverTimestamp() }, { merge: true });
    participantLobby(playerId);
  };
}

function participantLobby(playerId) {
  $app.innerHTML = html`
    <main class="container">
      <section class="card center">
        <div class="logo">Lab Series OX Championship</div>
        <div class="spinner"></div>
        <div class="waiting">진행자를 기다리는 중...</div>
        <p class="muted">시작 버튼이 눌리면 자동으로 문제가 시작됩니다.</p>
      </section>
    </main>`;
  onSnapshot(stateRef, (snap) => {
    const state = snap.data();
    if (!state) return;
    if (state.status === "running") showQuestion(playerId, state);
    if (state.status === "finished") showParticipantDone();
    if (state.status === "waiting") {
      // keep lobby
    }
  });
}

async function getMyAnswer(playerId, qIndex) {
  const snap = await getDoc(doc(answersCol, `${playerId}_${qIndex}`));
  return snap.exists() ? snap.data().choice : null;
}

async function showQuestion(playerId, state) {
  const qIndex = state.currentQuestion;
  if (qIndex >= questions.length) return showParticipantDone();
  const q = questions[qIndex];
  const existing = await getMyAnswer(playerId, qIndex);
  const started = state.questionStartedAt || Date.now();
  const seconds = state.questionSeconds || QUESTION_SECONDS;
  $app.innerHTML = html`
    <main class="container">
      <section class="card">
        <div class="questionMeta">
          <div>Q${qIndex + 1} / ${questions.length}</div>
          <div class="timerText"><span id="remain">${seconds}</span>초</div>
        </div>
        <div class="barOuter"><div class="barInner" id="bar"></div></div>
        <div class="question">${q.text}</div>
        <div class="oxGrid">
          <button class="oxBtn o ${existing === "O" ? "selected" : ""}" data-choice="O">O</button>
          <button class="oxBtn x ${existing === "X" ? "selected" : ""}" data-choice="X">X</button>
        </div>
        <p class="center muted">선택하면 자동 저장됩니다.</p>
      </section>
    </main>`;
  document.querySelectorAll(".oxBtn").forEach(btn => {
    btn.onclick = async () => {
      const choice = btn.dataset.choice;
      document.querySelectorAll(".oxBtn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      await setDoc(doc(answersCol, `${playerId}_${qIndex}`), {
        playerId, questionIndex: qIndex, choice, answeredAt: serverTimestamp()
      });
    };
  });
  startCountdown(started, seconds);
}

function showParticipantDone() {
  if (localTimer) clearInterval(localTimer);
  $app.innerHTML = html`
    <main class="container">
      <section class="card center">
        <div class="logo">Lab Series OX Championship</div>
        <h1 class="title">OX 예선 종료!</h1>
        <p class="subtitle">결과는 진행자 화면에서 확인해주세요.</p>
      </section>
    </main>`;
}

function startCountdown(started, seconds) {
  if (localTimer) clearInterval(localTimer);
  const remainEl = document.getElementById("remain");
  const bar = document.getElementById("bar");
  localTimer = setInterval(() => {
    const elapsed = (Date.now() - started) / 1000;
    const remain = Math.max(0, seconds - elapsed);
    if (remainEl) remainEl.textContent = Math.ceil(remain);
    if (bar) bar.style.width = `${Math.max(0, (remain / seconds) * 100)}%`;
    if (remain <= 0) clearInterval(localTimer);
  }, 200);
}

async function renderAdmin() {
  await ensureGame();
  $app.innerHTML = html`
    <main class="container">
      <div class="header">
        <div class="logo">Lab Series OX Championship</div>
        <div class="badge">진행자</div>
      </div>
      <div class="adminGrid">
        <section class="card">
          <h1 class="title">진행자 화면</h1>
          <div id="adminState"></div>
          <div class="nav">
            <button class="secondary" id="startBtn">START</button>
            <button class="secondary" id="nextBtn">다음 문제</button>
            <button class="secondary" id="finishBtn">종료/결과</button>
            <button class="secondary danger" id="resetBtn">전체 초기화</button>
          </div>
          <div id="questionPreview"></div>
        </section>
        <section class="card">
          <h2>참가자 현황</h2>
          <div id="playersBox"></div>
        </section>
      </div>
      <section class="card" style="margin-top:18px">
        <h2>결과 / 조별 최고 득점자</h2>
        <div id="resultsBox"></div>
      </section>
    </main>`;

  document.getElementById("startBtn").onclick = () => startGame();
  document.getElementById("nextBtn").onclick = () => nextQuestion();
  document.getElementById("finishBtn").onclick = () => finishGame();
  document.getElementById("resetBtn").onclick = () => resetGame();

  onSnapshot(playersCol, (snap) => {
    cachedPlayers = snap.docs.map(d => d.data());
    updateAdminBoxes();
  });
  onSnapshot(answersCol, (snap) => {
    cachedAnswers = snap.docs.map(d => d.data());
    updateAdminBoxes();
  });
  onSnapshot(stateRef, (snap) => {
    const state = snap.data();
    updateAdminState(state);
    updateAdminBoxes();
    if (state?.status === "running") adminAutoAdvance(state);
  });
}

let adminAdvanceTimer = null;
function adminAutoAdvance(state) {
  if (adminAdvanceTimer) clearTimeout(adminAdvanceTimer);
  const started = state.questionStartedAt || Date.now();
  const seconds = state.questionSeconds || QUESTION_SECONDS;
  const msLeft = Math.max(0, seconds * 1000 - (Date.now() - started));
  adminAdvanceTimer = setTimeout(async () => {
    const latest = (await getDoc(stateRef)).data();
    if (!latest || latest.status !== "running") return;
    if (latest.currentQuestion !== state.currentQuestion) return;
    if (latest.currentQuestion >= questions.length - 1) await finishGame();
    else await nextQuestion();
  }, msLeft + 450);
}

async function startGame() {
  await setDoc(stateRef, {
    status: "running",
    currentQuestion: 0,
    questionStartedAt: Date.now(),
    questionSeconds: QUESTION_SECONDS,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function nextQuestion() {
  const snap = await getDoc(stateRef);
  const state = snap.data() || {};
  const next = Math.min((state.currentQuestion ?? 0) + 1, questions.length);
  if (next >= questions.length) return finishGame();
  await setDoc(stateRef, {
    status: "running",
    currentQuestion: next,
    questionStartedAt: Date.now(),
    questionSeconds: QUESTION_SECONDS,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function finishGame() {
  await setDoc(stateRef, { status: "finished", updatedAt: serverTimestamp() }, { merge: true });
}

async function resetGame() {
  if (!confirm("참가자와 답변을 모두 삭제하고 처음부터 시작할까요?")) return;
  const ps = await getDocs(playersCol);
  const as = await getDocs(answersCol);
  await Promise.all([...ps.docs.map(d => deleteDoc(d.ref)), ...as.docs.map(d => deleteDoc(d.ref))]);
  await setDoc(stateRef, {
    status: "waiting",
    currentQuestion: 0,
    questionStartedAt: null,
    questionSeconds: QUESTION_SECONDS,
    updatedAt: serverTimestamp()
  });
}

function updateAdminState(state) {
  if (!document.getElementById("adminState")) return;
  const statusLabel = state?.status === "running" ? "진행 중" : state?.status === "finished" ? "종료" : "대기 중";
  document.getElementById("adminState").innerHTML = html`
    <div class="notice">
      현재 상태: <b>${statusLabel}</b><br/>
      현재 문제: <b>${(state?.currentQuestion ?? 0) + 1}</b> / ${questions.length}
    </div>`;
  const qi = state?.currentQuestion ?? 0;
  const q = questions[qi];
  document.getElementById("questionPreview").innerHTML = q ? html`
    <div class="questionBox">
      <div class="adminQuestion">Q${qi + 1}. ${q.text}</div>
      <span class="answerBadge">정답: ${q.answer}</span>
    </div>` : "";
}

function updateAdminBoxes() {
  const playersBox = document.getElementById("playersBox");
  const resultsBox = document.getElementById("resultsBox");
  if (!playersBox || !resultsBox) return;
  const teams = ["1조","2조","3조","4조"];
  playersBox.innerHTML = `<div class="teamGrid">${teams.map(team => {
    const members = cachedPlayers.filter(p => p.team === team);
    return `<div class="teamCard"><h3>${team} (${members.length}명)</h3>${members.map(p => `<div class="player"><span>${p.name}</span><b>${scorePlayer(p.id)}점</b></div>`).join("") || `<div class="small muted">대기 중</div>`}</div>`;
  }).join("")}</div>`;

  resultsBox.innerHTML = `<div class="results">${teams.map(team => {
    const members = cachedPlayers.filter(p => p.team === team).map(p => ({...p, score: scorePlayer(p.id)}));
    if (!members.length) return `<div class="winner"><h3>${team}</h3><div class="muted">참가자 없음</div></div>`;
    const max = Math.max(...members.map(m => m.score));
    const winners = members.filter(m => m.score === max);
    const sorted = members.sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
    return `<div class="winner"><h3>${team} 대표 후보</h3>
      ${winners.map(w => `<div class="rankline"><b>🥇 ${w.name}</b><b>${w.score}점</b></div>`).join("")}
      <div class="small muted" style="margin-top:10px">전체 순위</div>
      ${sorted.map(m => `<div class="rankline"><span>${m.name}</span><span>${m.score}점</span></div>`).join("")}
    </div>`;
  }).join("")}</div>`;
}

(async function init(){
  await ensureGame();
  if (isAdmin) renderAdmin();
  else renderParticipant();
})();
