import { db, GAME_ID } from './firebase.js';
import { QUESTIONS, QUESTION_SECONDS } from './questions.js';
import { doc, setDoc, getDoc, onSnapshot, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = (id)=>document.getElementById(id);
const joinScreen=$('joinScreen'), waitingScreen=$('waitingScreen'), quizScreen=$('quizScreen'), doneScreen=$('doneScreen'), resultScreen=$('resultScreen');
const teamSelect=$('teamSelect'), nameInput=$('nameInput'), joinBtn=$('joinBtn');
const playerInfo=$('playerInfo'), questionCount=$('questionCount'), timeText=$('timeText'), progressBar=$('progressBar'), questionText=$('questionText'), answerStatus=$('answerStatus'), resultList=$('resultList');
let playerId = localStorage.getItem('labseriesPlayerId') || crypto.randomUUID();
localStorage.setItem('labseriesPlayerId', playerId);
let player = JSON.parse(localStorage.getItem('labseriesPlayer') || 'null');
let currentIndex=0, score=0, answers=[], selected=null, timer=null;

function show(el){[joinScreen,waitingScreen,quizScreen,doneScreen,resultScreen].forEach(s=>s.classList.add('hidden')); el.classList.remove('hidden')}
function playerRef(){return doc(db,'games',GAME_ID,'players',playerId)}
function gameRef(){return doc(db,'games',GAME_ID)}

async function restore(){
  if(player){
    playerInfo.textContent = `${player.team} · ${player.name}`;
    show(waitingScreen);
    await setDoc(playerRef(), {...player, id: playerId, joinedAt: serverTimestamp(), completed:false, score:0, answers:[]}, {merge:true});
  }
  listenGame();
}

joinBtn.onclick = async ()=>{
  const team=teamSelect.value, name=nameInput.value.trim();
  if(!team || !name){ alert('조와 이름을 입력해주세요.'); return; }
  player={team,name};
  localStorage.setItem('labseriesPlayer', JSON.stringify(player));
  await setDoc(playerRef(), {id:playerId, team, name, joinedAt:serverTimestamp(), completed:false, score:0, answers:[]}, {merge:true});
  playerInfo.textContent=`${team} · ${name}`;
  show(waitingScreen);
};

function listenGame(){
  onSnapshot(gameRef(), async snap=>{
    const game=snap.exists()?snap.data():{};
    if(!player) return;
    if(game.status==='running' && !quizScreen.classList.contains('hidden')===false){
      const me=await getDoc(playerRef());
      if(me.exists() && me.data().completed){ show(doneScreen); return; }
      startLocalQuiz();
    }
    if(game.status==='results'){ renderResults(game.results || {}); show(resultScreen); }
    if(game.status==='waiting'){ show(waitingScreen); }
  });
}

function startLocalQuiz(){
  currentIndex=0; score=0; answers=[]; selected=null;
  show(quizScreen);
  runQuestion();
}
function runQuestion(){
  selected=null;
  answerStatus.textContent='정답을 선택하세요.';
  document.querySelectorAll('.ox-grid button').forEach(b=>{b.disabled=false; b.style.opacity='1'});
  const q=QUESTIONS[currentIndex];
  questionCount.textContent=`Q${currentIndex+1} / ${QUESTIONS.length}`;
  questionText.textContent=q.text;
  let remain=QUESTION_SECONDS;
  timeText.textContent=`${remain}초`;
  progressBar.style.width='100%';
  clearInterval(timer);
  timer=setInterval(()=>{
    remain-=1;
    timeText.textContent=`${Math.max(remain,0)}초`;
    progressBar.style.width=`${Math.max(remain,0)/QUESTION_SECONDS*100}%`;
    if(remain<=0){ clearInterval(timer); finishQuestion(); }
  },1000);
}

document.querySelectorAll('.ox-grid button').forEach(btn=>{
  btn.onclick=()=>{
    selected=btn.dataset.answer;
    answerStatus.textContent=`${selected} 선택 완료`;
    document.querySelectorAll('.ox-grid button').forEach(b=>{b.disabled=true; b.style.opacity=b===btn?'1':'.35'});
  };
});

async function finishQuestion(){
  const q=QUESTIONS[currentIndex];
  const correct=selected===q.answer;
  if(correct) score+=1;
  answers.push({index:currentIndex, selected:selected || null, answer:q.answer, correct});
  currentIndex+=1;
  if(currentIndex>=QUESTIONS.length){
    await setDoc(playerRef(), {completed:true, score, answers, finishedAt:serverTimestamp()}, {merge:true});
    show(doneScreen);
  } else {
    runQuestion();
  }
}

function renderResults(results){
  const teams=['1조','2조','3조','4조'];
  resultList.innerHTML=teams.map(team=>{
    const winners=results[team] || [];
    const body=winners.length?winners.map(w=>`<div>🥇 <strong>${w.name}</strong> <span>${w.score}점</span></div>`).join(''):'<div>결과 없음</div>';
    return `<div class="result-card"><strong>${team}</strong>${body}</div>`;
  }).join('');
}
restore();
