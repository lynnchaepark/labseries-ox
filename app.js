// =========================
// 1) Firebase 설정 넣는 곳
// =========================
// Firebase 콘솔에서 Web App 생성 후 firebaseConfig를 아래에 붙여넣으세요.
// 예시 형식만 남겨둔 것이며, 값은 반드시 본인 Firebase 값으로 교체해야 합니다.
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// =========================
// 2) OX 예선 문제 수정하는 곳
// =========================
const QUESTIONS = [
  { text: "남성 피부는 여성 피부보다 비교적 두꺼운 편이다.", answer: "O", explain: "남성 피부는 일반적으로 여성보다 두꺼운 특성을 보입니다." },
  { text: "남성은 여성보다 피지샘이 작고 피지 분비량이 적다.", answer: "X", explain: "남성은 피지샘이 크고 피지 분비량이 많은 편입니다." },
  { text: "남성 피부는 피지 분비가 많아 모공이 더 넓어 보일 수 있다.", answer: "O", explain: "피지선과 피지 분비량은 모공이 넓어 보이는 원인과 연결됩니다." },
  { text: "면도는 피부 보호막에 자극을 줄 수 있다.", answer: "O", explain: "반복적인 면도는 피부 장벽과 보호막에 자극을 줄 수 있습니다." },
  { text: "남성 피부는 유분이 많기 때문에 수분 케어가 필요 없다.", answer: "X", explain: "유분이 많아도 속건조와 수분 부족이 나타날 수 있습니다." },
  { text: "남성 피부는 여성 피부에 비해 피부결이 더 거칠게 느껴질 수 있다.", answer: "O", explain: "두께, 피지, 면도 등의 영향으로 피부결이 거칠게 느껴질 수 있습니다." },
  { text: "남성 피부의 주름은 표정과 근육 사용의 영향을 받을 수 있다.", answer: "O", explain: "표정 근육 사용은 깊은 표정 주름과 연결될 수 있습니다." },
  { text: "남성 피부는 지방 함량이 상대적으로 더 적은 편이라고 설명할 수 있다.", answer: "O", explain: "교육 자료 기준으로 남성 피부는 근육 함량은 높고 지방 함량은 상대적으로 적다고 설명합니다." },
  { text: "남성 고객이 번들거림을 말하면 보습 제품은 절대 추천하지 않는다.", answer: "X", explain: "번들거림이 있어도 산뜻한 수분 보습은 필요할 수 있습니다." },
  { text: "남성 피부 특징을 이해하면 고객의 고민을 제품 솔루션과 연결하기 쉬워진다.", answer: "O", explain: "피부 특징 이해는 상담과 제품 제안의 근거가 됩니다." }
];

const TEAMS = ["1팀", "2팀", "3팀", "4팀"];

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, remove, push } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-database.js";

const appDiv = document.getElementById('app');
let db, sessionId;
let participantId = localStorage.getItem('participantId') || crypto.randomUUID();
localStorage.setItem('participantId', participantId);

function isConfigured(){ return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE'); }
function initDb(){
  if(!isConfigured()) return null;
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  return db;
}
function route(){ return location.hash.replace('#','') || '/'; }
function currentSession(){ return new URLSearchParams(location.search).get('s') || localStorage.getItem('sessionId') || 'main'; }
function sessionRef(path=''){ return ref(db, `sessions/${sessionId}${path ? '/' + path : ''}`); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function notConfigured(){
  appDiv.innerHTML = `<div class="wrap"><div class="hero"><h1>Lab Series OX Quiz</h1></div><div class="card"><h2>Firebase 설정이 필요합니다.</h2><p>app.js 상단의 <b>firebaseConfig</b> 값을 본인 Firebase 프로젝트 값으로 교체해야 실시간 응답/점수 집계가 작동합니다.</p><p class="small">설정 후 GitHub에 다시 업로드하면 됩니다.</p></div></div>`;
}
function layout(content){
  appDiv.innerHTML = `<div class="wrap"><div class="hero"><span class="badge">Lab Series Men's Skin Championship</span><h1>남성 피부 마스터 챌린지</h1><p>남성 피부 특징을 얼마나 알고 있는지 확인하고, 게임을 통해 함께 배워보세요.</p></div>${content}</div>`;
}
async function ensureSession(){
  const snap = await get(sessionRef());
  if(!snap.exists()){
    await set(sessionRef(), { current:0, showAnswer:false, status:'waiting', createdAt:Date.now() });
  }
}
function joinPage(){
  layout(`<div class="card"><h2>참가자 입장</h2><label>이름</label><input class="input" id="name" placeholder="이름을 입력하세요"/><label>팀 선택</label><select class="input" id="team">${TEAMS.map(t=>`<option value="${t}">${t}</option>`).join('')}</select><button class="btn blue" id="joinBtn">입장하기</button><p class="small">입장 후 진행자가 문제를 시작하면 O/X를 선택해 주세요.</p></div>`);
  document.getElementById('joinBtn').onclick = async()=>{
    const name = document.getElementById('name').value.trim();
    const team = document.getElementById('team').value;
    if(!name) return alert('이름을 입력해 주세요.');
    await set(sessionRef(`participants/${participantId}`), { name, team, score:0, joinedAt:Date.now() });
    location.hash = '/play';
  };
}
function playPage(){
  layout(`<div class="card center"><div id="playArea">대기 중...</div></div>`);
  onValue(sessionRef(), async snap=>{
    const s = snap.val(); if(!s) return;
    const p = s.participants?.[participantId];
    if(!p){ location.hash='/'; return; }
    const q = QUESTIONS[s.current] || QUESTIONS[0];
    const myAnswer = s.answers?.[s.current]?.[participantId]?.answer;
    let html = `<div class="meta">${escapeHtml(p.name)} · ${escapeHtml(p.team)} · 현재 점수 ${p.score||0}점</div><h2>문제 ${s.current+1} / ${QUESTIONS.length}</h2><div class="question">${escapeHtml(q.text)}</div>`;
    if(s.showAnswer){
      const correct = q.answer;
      html += `<div class="card"><div>정답</div><div class="answer${correct}">${correct}</div><p>${escapeHtml(q.explain)}</p></div><button class="btn secondary" disabled>다음 문제를 기다려 주세요</button>`;
    }else if(myAnswer){
      html += `<div class="card"><h2>답변 완료</h2><div class="answer${myAnswer}">${myAnswer}</div><p>정답 공개를 기다려 주세요.</p></div>`;
    }else{
      html += `<div class="grid"><button class="btn big blue" id="ansO">O</button><button class="btn big red" id="ansX">X</button></div>`;
    }
    document.getElementById('playArea').innerHTML = html;
    const ansO = document.getElementById('ansO'), ansX = document.getElementById('ansX');
    if(ansO) ansO.onclick = ()=>submitAnswer('O');
    if(ansX) ansX.onclick = ()=>submitAnswer('X');
  });
}
async function submitAnswer(answer){
  const sSnap = await get(sessionRef());
  const s = sSnap.val();
  await set(sessionRef(`answers/${s.current}/${participantId}`), { answer, at:Date.now() });
}
function adminPage(){
  const origin = location.origin + location.pathname + `?s=${encodeURIComponent(sessionId)}#/`;
  layout(`<div class="adminbar row"><button class="btn secondary" id="resetBtn">전체 초기화</button><button class="btn blue" id="prevBtn">이전 문제</button><button class="btn blue" id="nextBtn">다음 문제</button><button class="btn gold" id="showBtn">정답 공개/숨김</button><button class="btn red" id="resultBtn">결과 보기</button></div><div class="card"><h2>진행자 화면</h2><p>참가자 QR 주소:</p><input class="input" readonly value="${origin}" onclick="this.select()"/><p class="small">이 주소로 QR코드를 만들면 참가자가 입장할 수 있습니다.</p></div><div id="adminArea"></div>`);
  document.getElementById('resetBtn').onclick = async()=>{ if(confirm('정말 초기화할까요? 참가자/점수가 모두 삭제됩니다.')) await set(sessionRef(), { current:0, showAnswer:false, status:'waiting', createdAt:Date.now() }); };
  document.getElementById('prevBtn').onclick = async()=>{ const s=(await get(sessionRef())).val(); await update(sessionRef(), { current:Math.max(0,(s.current||0)-1), showAnswer:false }); };
  document.getElementById('nextBtn').onclick = async()=>{ const s=(await get(sessionRef())).val(); await update(sessionRef(), { current:Math.min(QUESTIONS.length-1,(s.current||0)+1), showAnswer:false }); };
  document.getElementById('showBtn').onclick = async()=>{ await toggleAnswer(); };
  document.getElementById('resultBtn').onclick = ()=>{ location.hash='/results'; };
  onValue(sessionRef(), snap=>renderAdmin(snap.val()));
}
async function toggleAnswer(){
  const snap = await get(sessionRef()); const s = snap.val();
  if(!s.showAnswer){
    const q = QUESTIONS[s.current];
    const answers = s.answers?.[s.current] || {};
    const updates = { showAnswer:true };
    Object.entries(answers).forEach(([pid, a])=>{
      const prev = s.participants?.[pid]?.score || 0;
      if(a.answer === q.answer) updates[`participants/${pid}/score`] = prev + 1;
    });
    await update(sessionRef(), updates);
  }else{
    await update(sessionRef(), { showAnswer:false });
  }
}
function renderAdmin(s){
  if(!s) return;
  const participants = Object.values(s.participants||{});
  const answers = s.answers?.[s.current] || {};
  const q = QUESTIONS[s.current];
  const teamCounts = TEAMS.map(t=>({team:t,total:participants.filter(p=>p.team===t).length, answered:Object.values(s.participants||{}).filter((p,i)=>false).length}));
  const answeredIds = Object.keys(answers);
  const rows = participants.map(p=>`<tr><td>${escapeHtml(p.team)}</td><td>${escapeHtml(p.name)}</td><td>${p.score||0}</td><td>${answeredIds.some(id=>s.participants[id]?.name===p.name && s.participants[id]?.team===p.team)?'제출':'-'}</td></tr>`).join('');
  const byTeam = TEAMS.map(t=>{
    const ps = Object.entries(s.participants||{}).filter(([id,p])=>p.team===t);
    const total = ps.length;
    const done = ps.filter(([id])=>answers[id]).length;
    return `<span class="pill">${t}: ${done}/${total}</span>`;
  }).join(' ');
  const oCount = Object.values(answers).filter(a=>a.answer==='O').length;
  const xCount = Object.values(answers).filter(a=>a.answer==='X').length;
  document.getElementById('adminArea').innerHTML = `<div class="card"><div class="row"><span class="pill">문제 ${s.current+1}/${QUESTIONS.length}</span><span class="pill">정답 ${q.answer}</span><span class="pill">${s.showAnswer?'정답 공개 중':'응답 중'}</span></div><div class="question">${escapeHtml(q.text)}</div><div class="row">${byTeam}</div><p>O 선택: <b>${oCount}</b>명 / X 선택: <b>${xCount}</b>명</p></div><div class="card"><h2>참가자 현황</h2><table><thead><tr><th>팀</th><th>이름</th><th>점수</th><th>현재 문제</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function resultsPage(){
  layout(`<div class="card"><h2>최종 결과</h2><div id="resultArea">불러오는 중...</div><div class="row"><button class="btn secondary" onclick="location.hash='/admin'">진행자 화면</button></div></div>`);
  onValue(sessionRef(), snap=>{
    const s = snap.val() || {};
    const entries = Object.entries(s.participants||{}).map(([id,p])=>({id,...p})).sort((a,b)=>(b.score||0)-(a.score||0));
    const personal = entries.map((p,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(p.team)}</td><td>${escapeHtml(p.name)}</td><td>${p.score||0}</td></tr>`).join('');
    const teamScores = TEAMS.map(t=>({team:t, score:entries.filter(p=>p.team===t).reduce((sum,p)=>sum+(p.score||0),0)})).sort((a,b)=>b.score-a.score);
    const teamRows = teamScores.map((t,i)=>`<tr><td>${i+1}</td><td>${t.team}</td><td>${t.score}</td></tr>`).join('');
    const champs = TEAMS.map(t=>{
      const top = entries.filter(p=>p.team===t).sort((a,b)=>(b.score||0)-(a.score||0))[0];
      return `<tr><td>${t}</td><td>${top?escapeHtml(top.name):'-'}</td><td>${top?top.score||0:'-'}</td></tr>`;
    }).join('');
    document.getElementById('resultArea').innerHTML = `<h3>개인 순위</h3><table><thead><tr><th>순위</th><th>팀</th><th>이름</th><th>점수</th></tr></thead><tbody>${personal}</tbody></table><h3>팀 순위</h3><table><thead><tr><th>순위</th><th>팀</th><th>총점</th></tr></thead><tbody>${teamRows}</tbody></table><h3>팀 대표 자동 선발</h3><table><thead><tr><th>팀</th><th>대표</th><th>점수</th></tr></thead><tbody>${champs}</tbody></table>`;
  });
}
async function main(){
  if(!isConfigured()){ notConfigured(); return; }
  initDb(); sessionId = currentSession(); localStorage.setItem('sessionId', sessionId); await ensureSession();
  const r = route();
  if(r==='/admin') adminPage();
  else if(r==='/play') playPage();
  else if(r==='/results') resultsPage();
  else joinPage();
}
window.addEventListener('hashchange', main);
main();
