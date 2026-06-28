import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, getDocs, onSnapshot, serverTimestamp
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

const SESSION_ID = "main";
const DURATION = 15;
const $ = (id) => document.getElementById(id);
const appEl = $("app");
const sessionRef = doc(db, "sessions", SESSION_ID);
const participantsRef = collection(db, "participants");

let myId = localStorage.getItem("labseriesParticipantId") || crypto.randomUUID();
localStorage.setItem("labseriesParticipantId", myId);
let myData = null;
let timer = null;
let lastRenderedQ = null;

const isAdmin = new URLSearchParams(location.search).get("mode") === "admin";

function shell(content){
  appEl.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <div class="pill">Lab Series Men's Skin Championship</div>
        <h1>OX 예선전</h1>
        <p>남성 피부 특징을 얼마나 알고 있는지 확인해보세요.</p>
      </div>
      ${content}
      <div class="footer">Lab Series OX Quiz System</div>
    </div>`;
}

async function ensureSession(){
  const snap = await getDoc(sessionRef);
  if(!snap.exists()){
    await setDoc(sessionRef, { status:"lobby", startAtMs:null, duration:DURATION, createdAt:serverTimestamp() });
  }
}

function scoreOf(p){
  const answers = p.answers || {};
  return QUESTIONS.reduce((sum,q,i)=> sum + (answers[`q${i}`] === q.answer ? 1 : 0), 0);
}

function groupWinners(participants){
  const groups = ["1조","2조","3조","4조"];
  return groups.map(group=>{
    const members = participants.filter(p=>p.group===group);
    if(!members.length) return { group, winners: [], topScore: 0 };
    const scored = members.map(p=>({...p, score:scoreOf(p)}));
    const topScore = Math.max(...scored.map(p=>p.score));
    return { group, topScore, winners: scored.filter(p=>p.score===topScore) };
  });
}

async function getParticipants(){
  const snap = await getDocs(participantsRef);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

async function renderParticipantLogin(){
  shell(`
    <div class="card">
      <h2>참가자 입장</h2>
      <div class="field">
        <label>조 선택</label>
        <select id="group">
          <option value="">조를 선택해주세요</option>
          <option>1조</option><option>2조</option><option>3조</option><option>4조</option>
        </select>
      </div>
      <div class="field">
        <label>이름</label>
        <input id="name" placeholder="예) 홍길동" />
      </div>
      <button class="btn btn-primary full" id="joinBtn">입장하기</button>
      <p class="small">입장 후 진행자가 시작할 때까지 대기합니다.</p>
    </div>`);
  $("joinBtn").onclick = async()=>{
    const group = $("group").value;
    const name = $("name").value.trim();
    if(!group || !name){ alert("조와 이름을 입력해주세요."); return; }
    myData = { name, group, answers:{}, joinedAt:Date.now() };
    await setDoc(doc(db,"participants",myId), myData);
    listenParticipant();
  };
}

function renderWaiting(){
  shell(`<div class="card wait">진행자를 기다리는 중...<br><span class="small">시작되면 자동으로 문제가 표시됩니다.</span></div>`);
}

function renderAnsweredWait(){
  shell(`<div class="card wait">답변이 제출되었습니다.<br><span class="small">다음 문제를 기다려주세요.</span></div>`);
}

async function renderParticipantResult(){
  const participants = await getParticipants();
  const mine = participants.find(p=>p.id===myId);
  const winners = groupWinners(participants);
  const myScore = mine ? scoreOf(mine) : 0;
  shell(`
    <div class="card">
      <h2 class="result-title">왕중왕전 진출자</h2>
      <div class="note">내 점수: <b>${myScore} / ${QUESTIONS.length}</b></div>
      ${winners.map(w=>`
        <div class="winner">
          <h3>${w.group}</h3>
          ${w.winners.length ? w.winners.map(p=>`<div class="name">🥇 ${p.name} <span class="score">${p.score}점</span></div>`).join("") : "참가자 없음"}
        </div>`).join("")}
    </div>`);
}

function renderQuestion(session, participant){
  const elapsed = Math.floor((Date.now() - session.startAtMs) / 1000);
  const qIndex = Math.floor(elapsed / DURATION);
  const secInto = elapsed % DURATION;
  if(qIndex >= QUESTIONS.length){ return renderParticipantResult(); }
  const q = QUESTIONS[qIndex];
  const left = Math.max(0, DURATION - secInto);
  const pct = Math.max(0, (left / DURATION) * 100);
  const selected = participant.answers?.[`q${qIndex}`] || null;

  if(lastRenderedQ !== qIndex || !$("timerNum")){
    lastRenderedQ = qIndex;
    shell(`
      <div class="quiz-top"><div class="qcount">Q${qIndex+1} / ${QUESTIONS.length}</div><div class="timer"><span id="timerNum">${left}</span></div></div>
      <div class="bar"><div class="bar-fill" id="barFill" style="width:${pct}%"></div></div>
      <div class="question-card">
        <div class="question">${q.text}</div>
        <div class="ox-row">
          <button class="ox o ${selected==='O'?'selected':''}" id="btnO">O</button>
          <button class="ox x ${selected==='X'?'selected':''}" id="btnX">X</button>
        </div>
        <p class="small" style="text-align:center;margin-top:18px">한 번 선택하면 해당 문제의 답변이 저장됩니다.</p>
      </div>`);
    $("btnO").onclick = ()=>submitAnswer(qIndex,"O");
    $("btnX").onclick = ()=>submitAnswer(qIndex,"X");
  } else {
    $("timerNum").textContent = left;
    $("barFill").style.width = pct + "%";
  }
}

async function submitAnswer(qIndex, answer){
  const ref = doc(db,"participants",myId);
  const snap = await getDoc(ref);
  const data = snap.data() || {};
  const answers = data.answers || {};
  answers[`q${qIndex}`] = answer;
  await updateDoc(ref, { answers });
  myData = { ...data, answers };
}

async function listenParticipant(){
  renderWaiting();
  onSnapshot(doc(db,"participants",myId), snap=>{ if(snap.exists()) myData={id:snap.id,...snap.data()}; });
  onSnapshot(sessionRef, snap=>{
    const s = snap.data();
    clearInterval(timer);
    lastRenderedQ = null;
    if(!s || s.status === "lobby") return renderWaiting();
    if(s.status === "finished") return renderParticipantResult();
    if(s.status === "running"){
      timer = setInterval(async()=>{
        const psnap = await getDoc(doc(db,"participants",myId));
        const pdata = psnap.exists() ? {id:psnap.id,...psnap.data()} : myData;
        renderQuestion(s, pdata || {answers:{}});
      },250);
    }
  });
}

function renderAdmin(){
  shell(`
    <div class="card">
      <h2>진행자 화면</h2>
      <div class="status" id="sessionStatus">상태 확인 중...</div>
      <div class="admin-actions">
        <button class="btn btn-primary" id="startBtn">START</button>
        <button class="btn btn-dark" id="finishBtn">결과 보기</button>
        <button class="btn btn-red" id="resetBtn">초기화</button>
      </div>
      <div id="adminPanel"></div>
      <div class="linkbox">참가자용 주소: ${location.origin}${location.pathname}</div>
    </div>`);
  $("startBtn").onclick = async()=>{
    await setDoc(sessionRef, { status:"running", startAtMs:Date.now(), duration:DURATION, startedAt:serverTimestamp() }, {merge:true});
  };
  $("finishBtn").onclick = async()=>{
    await setDoc(sessionRef, { status:"finished", finishedAt:serverTimestamp() }, {merge:true});
  };
  $("resetBtn").onclick = async()=>{
    if(!confirm("참가자와 점수를 모두 초기화할까요?")) return;
    const ps = await getDocs(participantsRef);
    await Promise.all(ps.docs.map(d=>deleteDoc(d.ref)));
    await setDoc(sessionRef, { status:"lobby", startAtMs:null, duration:DURATION, resetAt:serverTimestamp() });
  };

  onSnapshot(sessionRef, snap=>{
    const s = snap.data();
    $("sessionStatus").textContent = `현재 상태: ${s?.status || "lobby"}`;
  });
  onSnapshot(participantsRef, snap=>{
    const participants = snap.docs.map(d=>({id:d.id,...d.data()}));
    updateAdminPanel(participants);
  });
}

function updateAdminPanel(participants){
  const groups = ["1조","2조","3조","4조"];
  const winners = groupWinners(participants);
  $("adminPanel").innerHTML = `
    <h3>현재 접속자: ${participants.length}명</h3>
    <div class="grid">
      ${groups.map(g=>{
        const members = participants.filter(p=>p.group===g).sort((a,b)=>scoreOf(b)-scoreOf(a));
        return `<div class="team-box"><h3>${g} (${members.length}명)</h3>${members.map(p=>`<div class="person">${p.name} <b>${scoreOf(p)}점</b></div>`).join("") || "-"}</div>`
      }).join("")}
    </div>
    <h3 style="margin-top:24px">왕중왕전 진출자</h3>
    ${winners.map(w=>`
      <div class="winner">
        <h3>${w.group}</h3>
        ${w.winners.length ? w.winners.map(p=>`<div class="name">🥇 ${p.name} <span class="score">${p.score}점</span></div>`).join("") : "참가자 없음"}
      </div>`).join("")}`;
}

async function init(){
  await ensureSession();
  if(isAdmin) return renderAdmin();
  const snap = await getDoc(doc(db,"participants",myId));
  if(snap.exists()) { myData={id:snap.id,...snap.data()}; listenParticipant(); }
  else renderParticipantLogin();
}
init().catch(err=>{
  console.error(err);
  shell(`<div class="card"><h2>오류가 발생했습니다.</h2><p>${err.message}</p></div>`);
});
