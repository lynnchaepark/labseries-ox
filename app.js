import { db, doc, setDoc, getDoc, onSnapshot, collection, getDocs, serverTimestamp } from './firebase.js';
import { QUESTIONS, TEAM_LABELS } from './questions.js';

const GAME_REF = doc(db, 'game', 'current');
const TEAMS_COL = collection(db, 'teams');

let myTeam = localStorage.getItem('labseries_team') || '';
let answers = [];
let currentIndex = 0;
let currentAnswer = null;
let startAtMs = 0;
let teamDocUnsub = null;

const $ = (id) => document.getElementById(id);
const screens = ['joinScreen','waitScreen','quizScreen','doneScreen','resultScreen'];
function show(id){ screens.forEach(s => $(s).classList.toggle('hidden', s!==id)); }
function normalize(v){ return String(v ?? '').trim().replace(/\s+/g,'').toLowerCase(); }
function formatScore(n){ return Number.isInteger(n) ? `${n}점` : `${n.toFixed(1)}점`; }
function formatMs(ms){
  if(!ms && ms !== 0) return '-';
  const total = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(total/60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function rankTeams(teamDocs){
  return teamDocs
    .filter(t => t.completed)
    .sort((a,b) => (Number(b.score || 0) - Number(a.score || 0)) || ((a.elapsedMs ?? 999999999) - (b.elapsedMs ?? 999999999)) || Number(a.teamId)-Number(b.teamId));
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
      <div class="score">${formatScore(Number(t.score || 0))}</div>
    </div>
  `).join('');
}
async function fetchAllTeams(){
  const snap = await getDocs(TEAMS_COL);
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}
function scoreQuestion(q, answer){
  if(q.type === 'ox') return answer === q.answer ? (q.points ?? 1) : 0;
  if(q.type === 'short'){
    const user = normalize(answer);
    return (q.answers || []).some(a => normalize(a) === user) ? (q.points ?? 1) : 0;
  }
  if(q.type === 'blanks'){
    const a = answer || {};
    let score = 0;
    if(normalize(a.sweatMin) === '30' && normalize(a.sweatMax) === '40') score += 0.5;
    if(normalize(a.water) === '3') score += 0.5;
    return score;
  }
  if(q.type === 'multi'){
    const chosen = Array.isArray(answer) ? answer : [];
    const correctLabels = (q.options || []).filter(o=>o.correct).map(o=>o.label).sort();
    const chosenSorted = [...chosen].sort();
    const same = correctLabels.length === chosenSorted.length && correctLabels.every((v,i)=>v===chosenSorted[i]);
    return same ? (q.points ?? 1) : 0;
  }
  return 0;
}
function isAnswered(q){
  if(q.type === 'ox') return currentAnswer === 'O' || currentAnswer === 'X';
  if(q.type === 'short') return normalize(currentAnswer).length > 0;
  if(q.type === 'blanks'){
    return currentAnswer && ['sweatMin','sweatMax','water'].every(k => normalize(currentAnswer[k]).length > 0);
  }
  if(q.type === 'multi') return Array.isArray(currentAnswer) && currentAnswer.length > 0;
  return false;
}
function updateNext(){ $('nextBtn').disabled = !isAnswered(QUESTIONS[currentIndex]); }

$('joinBtn').addEventListener('click', async () => {
  const teamId = $('teamSelect').value;
  $('joinMsg').textContent = '';
  if(!teamId){ $('joinMsg').textContent = '조를 선택해주세요.'; return; }

  const stateSnap = await getDoc(GAME_REF);
  const state = stateSnap.exists() ? stateSnap.data() : { status:'waiting' };
  if(state.status === 'running') { $('joinMsg').textContent = '이미 퀴즈가 시작되었습니다. 진행자에게 문의해주세요.'; return; }
  if(state.status === 'revealed') { $('joinMsg').textContent = '결과가 이미 공개되었습니다. 진행자에게 문의해주세요.'; return; }

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
      $('myScore').textContent = formatScore(Number(data.score || 0));
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
  currentAnswer = null;
  showQuestion();
  show('quizScreen');
}

function showQuestion(){
  currentAnswer = null;
  const q = QUESTIONS[currentIndex];
  $('qCount').textContent = `Q${currentIndex+1} / ${QUESTIONS.length}`;
  $('questionText').textContent = q.text;
  $('progressBar').style.width = `${(currentIndex / QUESTIONS.length) * 100}%`;
  $('nextBtn').disabled = true;
  renderAnswer(q);
}

function renderAnswer(q){
  const area = $('answerArea');
  if(q.type === 'ox'){
    area.innerHTML = `
      <div class="oxgrid">
        <button class="oxbtn" data-answer="O">O</button>
        <button class="oxbtn" data-answer="X">X</button>
      </div>`;
    area.querySelectorAll('.oxbtn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentAnswer = btn.dataset.answer;
        area.querySelectorAll('.oxbtn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateNext();
      });
    });
    return;
  }
  if(q.type === 'short'){
    area.innerHTML = `<input id="shortAnswer" class="input bigInput" placeholder="${q.placeholder || '정답 입력'}" autocomplete="off" />`;
    const input = $('shortAnswer');
    input.addEventListener('input', () => { currentAnswer = input.value; updateNext(); });
    input.focus();
    return;
  }
  if(q.type === 'blanks'){
    currentAnswer = { sweatMin:'', sweatMax:'', water:'' };
    area.innerHTML = `<div class="blankGrid">${q.fields.map(f => `
      <label class="blankField">
        <span>${f.label}</span>
        <input class="input blankInput" data-key="${f.key}" placeholder="${f.placeholder}" inputmode="numeric" />
      </label>`).join('')}</div>
      <p class="tiny">30과 40을 모두 맞히면 0.5점, 3을 맞히면 0.5점입니다.</p>`;
    area.querySelectorAll('.blankInput').forEach(input => {
      input.addEventListener('input', () => {
        currentAnswer[input.dataset.key] = input.value;
        updateNext();
      });
    });
    return;
  }
  if(q.type === 'multi'){
    currentAnswer = [];
    area.innerHTML = `<div class="choiceGrid">${q.options.map(o => `
      <button class="choiceBtn" data-label="${o.label}">${o.label}</button>`).join('')}</div>`;
    area.querySelectorAll('.choiceBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        const label = btn.dataset.label;
        if(currentAnswer.includes(label)){
          currentAnswer = currentAnswer.filter(v => v !== label);
          btn.classList.remove('selected');
        } else {
          currentAnswer.push(label);
          btn.classList.add('selected');
        }
        updateNext();
      });
    });
  }
}

$('nextBtn').addEventListener('click', async () => {
  const q = QUESTIONS[currentIndex];
  if(!isAnswered(q)) return;
  const earned = scoreQuestion(q, currentAnswer);
  answers.push({ questionIndex: currentIndex, type:q.type, answer: currentAnswer, points: earned, answeredAtMs: Date.now() });
  currentIndex++;
  if(currentIndex >= QUESTIONS.length){
    const finishedAtMs = Date.now();
    const score = answers.reduce((sum,a)=>sum + Number(a.points || 0), 0);
    await setDoc(doc(db,'teams',myTeam), {
      answers,
      score,
      completed: true,
      finishedAtMs,
      elapsedMs: finishedAtMs - startAtMs,
      submittedAt: serverTimestamp()
    }, { merge: true });
    $('progressBar').style.width = '100%';
    $('myScore').textContent = formatScore(score);
    show('doneScreen');
  } else {
    showQuestion();
  }
});
