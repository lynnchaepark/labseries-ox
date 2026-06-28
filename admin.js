import { db, GAME_ID } from './firebase.js';
import { doc, setDoc, onSnapshot, collection, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $=(id)=>document.getElementById(id);
const startBtn=$('startBtn'), resetBtn=$('resetBtn'), showResultBtn=$('showResultBtn');
const gameStatus=$('gameStatus'), completionStatus=$('completionStatus'), teamCounts=$('teamCounts'), playersTable=$('playersTable'), adminResults=$('adminResults');
const teams=['1조','2조','3조','4조'];
let players=[];
const gameRef=doc(db,'games',GAME_ID);
const playersCol=collection(db,'games',GAME_ID,'players');

onSnapshot(gameRef, snap=>{
  const game=snap.exists()?snap.data():{status:'waiting'};
  gameStatus.textContent = statusText(game.status);
  if(game.results) renderResults(game.results);
});
onSnapshot(playersCol, snap=>{
  players=snap.docs.map(d=>({docId:d.id,...d.data()}));
  renderPlayers();
});
function statusText(s){return {waiting:'대기 중',running:'퀴즈 진행 중',done:'퀴즈 종료 / 결과 공개 전',results:'결과 공개 완료'}[s]||'대기 중'}
function renderPlayers(){
  const total=players.length;
  const done=players.filter(p=>p.completed).length;
  completionStatus.textContent=`${done} / ${total} 완료`;
  teamCounts.innerHTML=teams.map(t=>{
    const list=players.filter(p=>p.team===t);
    const d=list.filter(p=>p.completed).length;
    return `<div class="team-pill">${t}<br>${d}/${list.length}</div>`;
  }).join('');
  playersTable.innerHTML=players.sort((a,b)=>(a.team||'').localeCompare(b.team||'') || (b.score||0)-(a.score||0)).map(p=>`
    <div class="player-row"><span>${p.team||'-'}</span><strong>${p.name||'-'}</strong><span>${p.score??0}점</span><span class="${p.completed?'done':'notdone'}">${p.completed?'완료':'진행/대기'}</span></div>
  `).join('') || '<p class="hint">아직 입장한 참가자가 없습니다.</p>';
}
function calculateResults(){
  const results={};
  teams.forEach(team=>{
    const list=players.filter(p=>p.team===team && p.completed);
    if(!list.length){results[team]=[]; return;}
    const max=Math.max(...list.map(p=>p.score||0));
    results[team]=list.filter(p=>(p.score||0)===max).map(p=>({name:p.name, score:p.score||0}));
  });
  return results;
}
function renderResults(results){
  adminResults.innerHTML=teams.map(team=>{
    const winners=results[team]||[];
    const body=winners.length?winners.map(w=>`<div>🥇 <strong>${w.name}</strong> <span>${w.score}점</span></div>`).join(''):'<div>결과 없음</div>';
    return `<div class="result-card"><strong>${team}</strong>${body}</div>`;
  }).join('');
}
startBtn.onclick=async()=>{
  if(!players.length && !confirm('입장한 참가자가 없습니다. 그래도 시작할까요?')) return;
  await setDoc(gameRef,{status:'running', startedAt:serverTimestamp(), resultsVisible:false, results:{}},{merge:true});
};
showResultBtn.onclick=async()=>{
  const results=calculateResults();
  await setDoc(gameRef,{status:'results', resultsVisible:true, results, revealedAt:serverTimestamp()},{merge:true});
  renderResults(results);
};
resetBtn.onclick=async()=>{
  if(!confirm('게임을 초기화합니다. 참가자 기록도 모두 지울까요?')) return;
  const snap=await getDocs(playersCol);
  const deletes=snap.docs.map(d=>setDoc(doc(db,'games',GAME_ID,'players',d.id),{deleted:true, completed:false, score:0, answers:[], name:'', team:''},{merge:true}));
  await Promise.all(deletes);
  await setDoc(gameRef,{status:'waiting', resultsVisible:false, results:{}, resetAt:serverTimestamp()},{merge:true});
  alert('초기화 완료. 참가자는 새로고침 후 다시 입장하게 안내하세요.');
};
