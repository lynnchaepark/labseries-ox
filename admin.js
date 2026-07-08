import { db, doc, setDoc, onSnapshot, collection, getDocs, deleteDoc, serverTimestamp } from './firebase.js';
import { TEAM_LABELS } from './questions.js';

const GAME_REF = doc(db, 'game', 'current');
const TEAMS_COL = collection(db, 'teams');

const $ = (id) => document.getElementById(id);
const VALID_TEAM_IDS = ['1','2','3','4'];

function getTeamLabel(teamId){
  const idx = Number(teamId) - 1;
  return TEAM_LABELS[idx] || `${teamId}조`;
}
function formatMs(ms){
  if(!ms && ms !== 0) return '-';
  const sec = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function rankTeams(teamDocs){
  return teamDocs
    .filter(t => t.completed && VALID_TEAM_IDS.includes(String(t.teamId)))
    .sort((a,b) => (b.score - a.score) || ((a.elapsedMs ?? 999999999) - (b.elapsedMs ?? 999999999)) || Number(a.teamId)-Number(b.teamId));
}
function renderTeamStatus(teamDocs){
  const map = Object.fromEntries(teamDocs.map(t => [String(t.teamId), t]));
  $('teamStatus').innerHTML = [1,2,3,4].map(n => {
    const t = map[String(n)];
    const joined = !!t?.joined;
    const completed = !!t?.completed;
    return `
      <div class="teamCard ${completed ? 'done' : ''}">
        <h4>${getTeamLabel(n)}</h4>
        <p>${joined ? '입장 완료' : '미입장'}</p>
        <p>${completed ? `제출 완료 · ${t.score}점 · ${formatMs(t.elapsedMs)}` : '진행 전/진행 중'}</p>
      </div>
    `;
  }).join('');
}
function renderResults(teamDocs){
  const ranked = rankTeams(teamDocs);
  if(!ranked.length){ $('adminResults').innerHTML = '<p class="sub">아직 완료된 팀이 없습니다.</p>'; return; }
  $('adminResults').innerHTML = ranked.map((t, i) => `
    <div class="resultItem ${i===0?'first':''}">
      <div class="rank">${i+1}등</div>
      <div>
        <div class="teamName">${getTeamLabel(t.teamId)}</div>
        <div class="meta">제출 소요시간 ${formatMs(t.elapsedMs)}</div>
      </div>
      <div class="score">${t.score}점</div>
    </div>
  `).join('');
}

async function fetchTeams(){
  const snap = await getDocs(TEAMS_COL);
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

onSnapshot(GAME_REF, (snap) => {
  const state = snap.exists() ? snap.data() : { status:'waiting' };
  const label = {
    waiting: '대기 중',
    running: '퀴즈 진행 중',
    finished: '퀴즈 종료 / 결과 대기',
    revealed: '결과 공개 완료'
  }[state.status] || '-';
  $('gameStatus').textContent = label;
});

onSnapshot(TEAMS_COL, (snap) => {
  const teams = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(t => VALID_TEAM_IDS.includes(String(t.teamId)));
  renderTeamStatus(teams);
  renderResults(teams);
});

$('resetBtn').addEventListener('click', async () => {
  if(!confirm('기존 참가/점수 데이터를 모두 초기화할까요?')) return;
  const snap = await getDocs(TEAMS_COL);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db,'teams',d.id))));
  await setDoc(GAME_REF, {
    status: 'waiting',
    startAtMs: null,
    resultsVisible: false,
    updatedAt: serverTimestamp()
  });
  alert('초기화 완료');
});

$('startBtn').addEventListener('click', async () => {
  const startAtMs = Date.now();
  await setDoc(GAME_REF, {
    status: 'running',
    startAtMs,
    resultsVisible: false,
    updatedAt: serverTimestamp()
  }, { merge: true });
});

$('revealBtn').addEventListener('click', async () => {
  await setDoc(GAME_REF, {
    status: 'revealed',
    resultsVisible: true,
    revealedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
});
