import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, serverTimestamp } from './firebase.js';
import { QUESTIONS, TEAM_LABELS } from './questions.js';

const GAME_REF = doc(db, 'game', 'current');
const TEAMS_COL = collection(db, 'teams');

let myTeam = localStorage.getItem('labseries_team') || '';
let answers = [];
let currentIndex = 0;
let selected = '';
let startAtMs = 0;
let teamDocUnsub = null;

const $ = (id) => document.getElementById(id);
const screens = ['joinScreen','waitScreen','quizScreen','doneScreen','resultScreen'];
function show(id){ screens.forEach(s => $(s).classList.toggle('hidden', s!==id)); }
function formatMs(ms){
  if(!ms && ms !== 0) return '-';
  const sec = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function rankTeams(teamDocs){
  return teamDocs
    .filter(t => t.completed)
    .sort((a,b) => (b.score - a.score) || ((a.elapsedMs ?? 999999999) - (b.elapsedMs ?? 999999999)) || Number(a.teamId)-Number(b.teamId));
}
function renderResults(teamDocs){
  const ranked = rankTeams(teamDocs);
  if(!ranked.length){ $('resultList').innerHTML = '<p class="sub">아직 완료된 팀이 없습니다.</p>'; return; }
  $('resultList').innerHTML = ranked.map((t, i) => `
    <div class="resultItem ${i===0?'first':''}">
      <div class="rank">${i+1}등</div>
      <div>
        <div class="teamName">${TEAM_LABELS[Number(t.teamId)-1]}</div>
        <div class="meta">제출 소요시간 ${formatMs(t.elapsedMs)}</div>
      </div>
      <div class="score">${t.score}점</div>
    </div>
  `).join('');
}

async function fetchAllTeams(){
  const snap = await getDocs(TEAMS_COL);
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

$('joinBtn').addEventListener('click', async () => {
  const teamId = $('teamSelect').value;
  $('joinMsg').textContent = '';
  if(!teamId){ $('joinMsg').textContent = '조를 선택해주세요.'; return; }

  const stateSnap = await getDoc(GAME_REF);
  const state = stateSnap.exists() ? stateSnap.data() : { status:'waiting' };
  if(state.status === 'running') { $('joinMsg').textContent = '이미 퀴즈가 시작되었습니다. 진행자에게 문의해주세요.'; return; }

  const teamRef = doc(db, 'teams', teamId);
  const teamSnap = await getDoc(teamRef);
  if(teamSnap.exists() && teamSnap.data().joined && !teamSnap.data().completed){
    $('joinMsg').textContent = '이미 입장한 조입니다. 같은 조는 한 기기만 입장해주세요.';
    return;
  }

  myTeam = teamId;
  localStorage.setItem('labseries_team', teamId);
  await setDoc(teamRef, {
    teamId,
    joined: true,
    completed: false,
    score: 0,
    answers: [],
    elapsedMs: null,
    joinedAt: serverTimestamp()
  }, { merge: true });

  $('waitTeam').textContent = TEAM_LABELS[Number(teamId)-1];
  $('teamBadge').textContent = TEAM_LABELS[Number(teamId)-1];
  show('waitScreen');
  listenMyTeam();
});

function listenMyTeam(){
  if(teamDocUnsub) teamDocUnsub();
  if(!myTeam) return;
  teamDocUnsub = onSnapshot(doc(db,'teams',myTeam), (snap)=>{
    const data = snap.data();
    if(data?.completed && data?.score !== undefined){
      $('myScore').textContent = `${data.score}점`;
    }
  });
}

onSnapshot(GAME_REF, async (snap) => {
  const state = snap.exists() ? snap.data() : { status:'waiting' };
  if(state.status === 'waiting'){
    if(myTeam){ $('waitTeam').textContent = TEAM_LABELS[Number(myTeam)-1]; show('waitScreen'); }
    else show('joinScreen');
  }
  if(state.status === 'running'){
    if(!myTeam) return;
    const tSnap = await getDoc(doc(db,'teams',myTeam));
    if(tSnap.exists() && tSnap.data().completed){ show('doneScreen'); return; }
    startQuiz(state.startAtMs || Date.now());
  }
  if(state.status === 'finished'){
    if(myTeam) show('doneScreen');
  }
  if(state.status === 'revealed'){
    const teams = await fetchAllTeams();
    renderResults(teams);
    show('resultScreen');
  }
});

function startQuiz(startMs){
  startAtMs = startMs;
  answers = [];
  currentIndex = 0;
  selected = '';
  showQuestion();
  show('quizScreen');
}

function showQuestion(){
  selected = '';
  const q = QUESTIONS[currentIndex];
  $('qCount').textContent = `Q${currentIndex+1} / ${QUESTIONS.length}`;
  $('questionText').textContent = q.text;
  $('progressBar').style.width = `${(currentIndex / QUESTIONS.length) * 100}%`;
  $('nextBtn').disabled = true;
  document.querySelectorAll('.oxbtn').forEach(btn => btn.classList.remove('selected'));
}

document.querySelectorAll('.oxbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    selected = btn.dataset.answer;
    document.querySelectorAll('.oxbtn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    $('nextBtn').disabled = false;
  });
});

$('nextBtn').addEventListener('click', async () => {
  if(!selected) return;
  const q = QUESTIONS[currentIndex];
  const isCorrect = selected === q.answer;
  answers.push({ questionIndex: currentIndex, answer: selected, correctAnswer: q.answer, isCorrect, answeredAtMs: Date.now() });
  currentIndex++;
  if(currentIndex >= QUESTIONS.length){
    const finishedAtMs = Date.now();
    const score = answers.filter(a=>a.isCorrect).length;
    await setDoc(doc(db,'teams',myTeam), {
      answers,
      score,
      completed: true,
      finishedAtMs,
      elapsedMs: finishedAtMs - startAtMs,
      submittedAt: serverTimestamp()
    }, { merge: true });
    $('progressBar').style.width = '100%';
    $('myScore').textContent = `${score}점`;
    show('doneScreen');
  } else {
    showQuestion();
  }
});
