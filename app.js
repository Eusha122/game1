import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const appRoot = document.querySelector('#app');
const letters = ['A', 'B', 'C', 'D'];
const slapGif = 'https://media1.tenor.com/m/p4nJMjBtwIMAAAAd/cats-funny.gif';
let db = null;
let draft = { owner: '', title: '', questions: [], activeIndex: 0 };
let editingQuizId = null;
let editingOwnerKey = null;

try {
  if (!firebaseConfig.apiKey.startsWith('PASTE_')) db = getFirestore(initializeApp(firebaseConfig));
} catch (error) { console.error(error); }

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
const homeUrl = () => `${location.origin}/setquestion`;
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500); }
function layout(content) { appRoot.innerHTML = `<section class="shell">${content}</section>`; }
function nav(path) { history.pushState({}, '', path); route(); }
function topbar(back = false) { return `<div class="topbar">${back ? '<button class="back" data-go-home aria-label="Go back">‹</button>' : '<a class="brand" href="/setquestion">✦ PopQuiz</a>'}<span></span></div>`; }

function home() {
  layout(`<div class="page hero">${topbar()}<div class="hero-art">🧠</div><p class="eyebrow">Tiny quizzes, big reactions</p><h1 class="headline">Make a quiz<br>worth sharing.</h1><p class="subhead">Build playful multiple-choice quizzes, then send one simple link to everyone.</p><div class="hero-actions"><button class="btn btn-primary" id="makeQuiz">Create a quiz</button><button class="btn btn-secondary" id="openQuiz">I have a quiz link</button></div></div>`);
  document.querySelector('#makeQuiz').onclick = () => nav('/setquestion');
  document.querySelector('#openQuiz').onclick = () => toast('Paste the quiz link directly in your browser.');
}

function emptyQuestion() {
  return { text: '', options: ['', '', '', ''], correct: 0 };
}

function showBuilderError(message) {
  const error = document.querySelector('#formError');
  error.textContent = message;
  error.classList.remove('hidden');
}

function isQuestionComplete(question) {
  return question.text.trim() && question.options.every(option => option.trim());
}

function builderV2() {
  if (!draft.questions.length) draft.questions.push(emptyQuestion());
  const activeIndex = Math.min(draft.activeIndex ?? 0, draft.questions.length - 1);
  draft.activeIndex = activeIndex;
  const question = draft.questions[activeIndex];
  const editing = Boolean(editingQuizId);
  layout(`<div class="page">${topbar(true)}
    <div class="builder-header"><div><p class="eyebrow">${editing ? 'Edit published quiz' : 'Create a quiz'}</p><h1 class="headline">${editing ? 'Update questions' : 'Your questions'}</h1></div><div class="count">${activeIndex + 1}</div></div>
    <p class="subhead">${editing ? 'Edit any question below, add more, then republish the same link.' : 'Give your quiz a name, then add as many questions as you like.'}</p>
    <div class="card"><div class="field"><label for="owner">Your username</label><input id="owner" maxlength="32" value="${escapeHtml(draft.owner)}" placeholder="e.g. shoily" autocomplete="nickname" ${editing ? 'readonly' : ''}></div><div class="field"><label for="title">Quiz title</label><input id="title" maxlength="70" value="${escapeHtml(draft.title)}" placeholder="e.g. Friday fun quiz"></div></div>
    <div class="card" style="margin-top:14px"><div class="field"><label for="question">Question ${activeIndex + 1}</label><textarea id="question" maxlength="300" placeholder="Type your question...">${escapeHtml(question.text)}</textarea></div><div id="options">${question.options.map((option, index) => `<div class="option-row"><span class="option-letter">${letters[index]}</span><input data-option="${index}" maxlength="150" value="${escapeHtml(option)}" placeholder="Option ${letters[index]}"></div>`).join('')}</div><p class="answer-label">Which answer is correct?</p><div class="correct-options">${letters.map((letter, index) => `<label><input type="radio" name="correct" value="${index}" ${question.correct === index ? 'checked' : ''}>${letter}</label>`).join('')}</div><div class="builder-actions"><button class="btn btn-secondary" id="addQuestion">+ Add question</button><button class="btn btn-primary" id="publishQuiz">${editing ? 'Republish updates' : 'Publish quiz'}</button></div></div>
    <div class="question-list"><h3>${editing ? 'Published questions' : 'Added questions'}</h3>${draft.questions.map((item, index) => `<div class="saved-question ${index === activeIndex ? 'active-question' : ''}"><b>${index + 1}</b><span>${escapeHtml(item.text || 'Untitled question')}</span><button class="edit-question" data-edit="${index}">${index === activeIndex ? 'Editing' : 'Edit'}</button>${draft.questions.length > 1 ? `<button data-delete="${index}" aria-label="Delete question">x</button>` : ''}</div>`).join('')}</div><div id="formError" class="error hidden"></div>
  </div>`);

  const sync = () => {
    draft.owner = document.querySelector('#owner').value;
    draft.title = document.querySelector('#title').value;
    question.text = document.querySelector('#question').value;
    question.options = [...document.querySelectorAll('[data-option]')].map(input => input.value);
    question.correct = Number(document.querySelector('input[name="correct"]:checked')?.value ?? 0);
  };
  document.querySelectorAll('input, textarea').forEach(element => element.oninput = sync);
  document.querySelectorAll('input[name="correct"]').forEach(element => element.onchange = sync);
  document.querySelector('#addQuestion').onclick = () => {
    sync();
    if (!draft.owner.trim() || !draft.title.trim() || !isQuestionComplete(question)) return showBuilderError('Complete the username, title, question, and all four options first.');
    draft.questions.push(emptyQuestion());
    draft.activeIndex = draft.questions.length - 1;
    builderV2();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  document.querySelector('#publishQuiz').onclick = publishV2;
  document.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => { sync(); draft.activeIndex = Number(button.dataset.edit); builderV2(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => { sync(); const index = Number(button.dataset.delete); draft.questions.splice(index, 1); draft.activeIndex = Math.min(draft.activeIndex, draft.questions.length - 1); builderV2(); });
  document.querySelector('[data-go-home]').onclick = () => { if (confirm('Discard this quiz draft?')) { draft = { owner: '', title: '', questions: [], activeIndex: 0 }; editingQuizId = null; editingOwnerKey = null; nav('/'); } };
}

async function publishV2() {
  const active = draft.questions[draft.activeIndex];
  active.text = document.querySelector('#question').value;
  active.options = [...document.querySelectorAll('[data-option]')].map(input => input.value);
  active.correct = Number(document.querySelector('input[name="correct"]:checked')?.value ?? 0);
  draft.title = document.querySelector('#title').value;
  draft.owner = document.querySelector('#owner').value;
  if (!draft.owner.trim() || !draft.title.trim()) return showBuilderError('Add your username and quiz title.');
  const incomplete = draft.questions.findIndex(question => !isQuestionComplete(question));
  if (incomplete !== -1) { draft.activeIndex = incomplete; builderV2(); return showBuilderError(`Question ${incomplete + 1} needs a question and all four options.`); }
  if (!db) return toast('Firebase is not connected yet.');
  const slug = editingQuizId || slugify(draft.owner);
  const button = document.querySelector('#publishQuiz');
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    const ownerKey = editingOwnerKey || crypto.randomUUID();
    await setDoc(doc(db, 'quizzes', slug), { owner: draft.owner.trim(), title: draft.title.trim(), questions: draft.questions.map(question => ({ text: question.text.trim(), options: question.options.map(option => option.trim()), correct: question.correct })), ownerKey, updatedAt: serverTimestamp() }, { merge: true });
    localStorage.setItem(`popquiz-owner-${slug}`, ownerKey);
    draft = { owner: '', title: '', questions: [], activeIndex: 0 };
    editingQuizId = null;
    editingOwnerKey = null;
    nav(`/${slug}/results`);
  } catch (error) { console.error(error); toast('Could not save the quiz. Check Firebase setup and rules.'); button.disabled = false; button.textContent = 'Try again'; }
}

async function resultsV2(slug) {
  if (!db) return configNeeded();
  layout(`<div class="page">${topbar(true)}<p class="eyebrow">Quiz dashboard</p><h1 class="headline">Loading results...</h1></div>`);
  try {
    const snapshot = await getDoc(doc(db, 'quizzes', slug));
    if (!snapshot.exists()) return notFound();
    const data = snapshot.data();
    const key = localStorage.getItem(`popquiz-owner-${slug}`);
    if (key !== data.ownerKey) { layout(`<div class="page hero">${topbar(true)}<div class="hero-art">Locked</div><h1 class="headline">This dashboard is private.</h1><p class="subhead">Open it from the browser where you created this quiz.</p></div>`); return; }
    const attempts = await getDocs(query(collection(db, 'quizzes', slug, 'attempts'), orderBy('finishedAt', 'desc')));
    const link = `${location.origin}/${slug}`;
    layout(`<div class="page">${topbar(true)}<p class="eyebrow">${escapeHtml(data.title)}</p><h1 class="headline">Your results</h1><p class="subhead">${attempts.size} ${attempts.size === 1 ? 'person has' : 'people have'} completed this quiz.</p><div class="builder-actions dashboard-actions"><button class="btn btn-primary" id="editQuiz">Edit questions</button><button class="btn btn-secondary" id="addMore">+ Add questions</button></div><div class="question-list"><h3>Published questions (${data.questions.length})</h3>${data.questions.map((question, index) => `<div class="saved-question"><b>${index + 1}</b><span>${escapeHtml(question.text)}</span></div>`).join('')}</div><div class="share-box"><p>Share your quiz</p><div class="share-row"><input readonly value="${link}"><button class="btn btn-small btn-secondary" id="copy">Copy</button></div></div><div class="question-list"><h3>Completed attempts</h3>${attempts.empty ? '<div class="card empty">No completed attempts yet.<br>Share the link to get started!</div>' : attempts.docs.map(item => { const attempt = item.data(); const date = attempt.finishedAt?.toDate?.().toLocaleString() || 'Just now'; return `<div class="attempt"><div><div class="attempt-name">${escapeHtml(attempt.name)}</div><div class="attempt-date">${date}</div></div><div class="attempt-score">${attempt.score}/${attempt.total}</div></div>`; }).join('')}</div></div>`);
    const openEditor = (newQuestion) => { draft = { owner: data.owner, title: data.title, questions: data.questions.map(question => ({ ...question, options: [...question.options] })), activeIndex: newQuestion ? data.questions.length : 0 }; if (newQuestion) draft.questions.push(emptyQuestion()); editingQuizId = slug; editingOwnerKey = data.ownerKey; nav('/setquestion'); };
    document.querySelector('#editQuiz').onclick = () => openEditor(false);
    document.querySelector('#addMore').onclick = () => openEditor(true);
    document.querySelector('#copy').onclick = () => navigator.clipboard.writeText(link).then(() => toast('Link copied!'));
    document.querySelector('[data-go-home]').onclick = () => nav('/setquestion');
  } catch (error) { console.error(error); toast('Could not load results. Check Firestore rules.'); }
}

function builder() {
  if (!draft.questions.length) draft.questions.push({ text: '', options: ['', '', '', ''], correct: 0 });
  const question = draft.questions[draft.questions.length - 1];
  layout(`<div class="page">${topbar(true)}<div class="builder-header"><div><p class="eyebrow">Create a quiz</p><h1 class="headline">Your questions</h1></div><div class="count">${draft.questions.length}</div></div><p class="subhead">Give your quiz a name, then add as many questions as you like.</p><div class="card" id="creatorCard"><div class="field"><label for="owner">Your username</label><input id="owner" maxlength="32" value="${escapeHtml(draft.owner)}" placeholder="e.g. shoily" autocomplete="nickname"></div><div class="field"><label for="title">Quiz title</label><input id="title" maxlength="70" value="${escapeHtml(draft.title)}" placeholder="e.g. Friday fun quiz"></div></div><div class="card" style="margin-top:14px"><div class="field"><label for="question">Question ${draft.questions.length}</label><textarea id="question" maxlength="300" placeholder="Type your question…">${escapeHtml(question.text)}</textarea></div><div id="options">${question.options.map((opt,i)=>`<div class="option-row"><span class="option-letter">${letters[i]}</span><input data-option="${i}" maxlength="150" value="${escapeHtml(opt)}" placeholder="Option ${letters[i]}"></div>`).join('')}</div><p class="answer-label">Which answer is correct?</p><div class="correct-options">${letters.map((letter,i)=>`<label><input type="radio" name="correct" value="${i}" ${question.correct===i?'checked':''}>${letter}</label>`).join('')}</div><div class="builder-actions"><button class="btn btn-secondary" id="addQuestion">+ Add another</button><button class="btn btn-primary" id="publishQuiz">Publish quiz</button></div></div><div class="question-list ${draft.questions.length < 2 ? 'hidden' : ''}"><h3>Added questions</h3>${draft.questions.slice(0,-1).map((q,i)=>`<div class="saved-question"><b>${i+1}</b><span>${escapeHtml(q.text)}</span><button data-delete="${i}" aria-label="Delete question">×</button></div>`).join('')}</div><div id="formError" class="error hidden"></div></div>`);
  const sync = () => { draft.owner = document.querySelector('#owner').value; draft.title = document.querySelector('#title').value; question.text = document.querySelector('#question').value; question.options = [...document.querySelectorAll('[data-option]')].map(i => i.value); question.correct = Number(document.querySelector('input[name="correct"]:checked')?.value ?? 0); };
  document.querySelectorAll('input,textarea').forEach(el => el.oninput = sync);
  document.querySelectorAll('input[name="correct"]').forEach(el => el.onchange = sync);
  document.querySelector('#addQuestion').onclick = () => { sync(); if (!validQuestion(question)) return; draft.questions.push({text:'',options:['','','',''],correct:0}); builder(); window.scrollTo({top:0,behavior:'smooth'}); };
  document.querySelector('#publishQuiz').onclick = publish;
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => { sync(); draft.questions.splice(Number(btn.dataset.delete),1); builder(); });
  document.querySelector('[data-go-home]').onclick = () => { if(confirm('Discard this quiz draft?')) { draft={owner:'',title:'',questions:[]}; nav('/'); } };
}
function validQuestion(question) { const err = document.querySelector('#formError'); const message = !draft.owner.trim() ? 'Add your username first.' : !draft.title.trim() ? 'Add a quiz title.' : !question.text.trim() ? 'Write a question before continuing.' : question.options.some(o=>!o.trim()) ? 'Every question needs all four options.' : ''; if(message){err.textContent=message;err.classList.remove('hidden');return false;} err.classList.add('hidden');return true; }
async function publish() { const current = draft.questions.at(-1); const before = draft.questions.slice(0,-1); if (!validQuestion(current)) return; const all = [...before,current]; if (!db) { toast('Add your Firebase config in firebase-config.js first.'); return; } const slug = slugify(draft.owner); if (!slug) return; const button = document.querySelector('#publishQuiz'); button.disabled=true;button.textContent='Publishing…'; try { const ownerKey = crypto.randomUUID(); await setDoc(doc(db,'quizzes',slug), { owner: draft.owner.trim(), title: draft.title.trim(), questions: all.map(q=>({text:q.text.trim(),options:q.options.map(o=>o.trim()),correct:q.correct})), ownerKey, createdAt: serverTimestamp() }); localStorage.setItem(`popquiz-owner-${slug}`, ownerKey); draft={owner:'',title:'',questions:[]}; nav(`/${slug}/results`); } catch(e){ console.error(e); toast('Could not publish. Check Firebase setup and rules.');button.disabled=false;button.textContent='Publish quiz'; } }

async function quiz(slug) { layout(`<div class="page"><div class="topbar"><a class="brand" href="/setquestion">✦ PopQuiz</a></div><div class="empty">Loading quiz…</div></div>`); if(!db){return configNeeded();} try { const snap = await getDoc(doc(db,'quizzes',slug)); if (!snap.exists()) return notFound(); const data=snap.data(); nameGate(slug,data); } catch(e){console.error(e);configNeeded();} }
function nameGate(slug,data) { layout(`<div class="page hero">${topbar()}<div class="hero-art">🎯</div><p class="eyebrow">${escapeHtml(data.owner)} made a quiz</p><h1 class="headline">${escapeHtml(data.title)}</h1><p class="subhead">${data.questions.length} questions. One at a time. Ready?</p><div class="card" style="width:min(100%,390px);text-align:left"><div class="field"><label for="playerName">What’s your name?</label><input id="playerName" maxlength="50" placeholder="Your name" autocomplete="name"></div><button class="btn btn-primary" id="startQuiz" style="width:100%">Start the quiz →</button></div></div>`); document.querySelector('#startQuiz').onclick=()=>{const name=document.querySelector('#playerName').value.trim();if(!name)return toast('Tell us your name first.');playQuiz(slug,data,name,0,0);}; }
function playQuiz(slug,data,name,index,score) { const q=data.questions[index]; layout(`<div class="page"><div class="quiz-top"><a class="brand" href="/setquestion">✦ PopQuiz</a><span class="pill">${index+1} of ${data.questions.length}</span></div><div class="progress"><i style="width:${(index/data.questions.length)*100}%"></i></div><p class="eyebrow">Question ${index+1}</p><h1 class="question-text">${escapeHtml(q.text)}</h1><div class="answers">${q.options.map((option,i)=>`<button class="answer" data-answer="${i}"><span class="letter">${letters[i]}</span><span>${escapeHtml(option)}</span></button>`).join('')}</div><div id="reaction"></div></div>`); document.querySelectorAll('[data-answer]').forEach(btn=>btn.onclick=()=>chooseAnswer(Number(btn.dataset.answer),q,slug,data,name,index,score)); }
function chooseAnswer(answer,q,slug,data,name,index,score) { const buttons=document.querySelectorAll('[data-answer]');buttons.forEach(b=>{b.disabled=true;const n=Number(b.dataset.answer);if(n===q.correct)b.classList.add('right');else if(n===answer)b.classList.add('wrong');}); const correct=answer===q.correct; const reaction=document.querySelector('#reaction'); if(correct){reaction.innerHTML='<p class="feedback">Nice! That’s right ✨</p>';}else{reaction.innerHTML=`<div class="gif-card"><img src="${slapGif}" alt="Funny cats reaction"></div><p class="feedback">Oof. Not quite!</p>`;} setTimeout(()=> index+1<data.questions.length ? playQuiz(slug,data,name,index+1,score+(correct?1:0)) : finishQuiz(slug,data,name,score+(correct?1:0)),3000); }
async function finishQuiz(slug,data,name,score) { if(db){try{await addDoc(collection(db,'quizzes',slug,'attempts'),{name,score,total:data.questions.length,finishedAt:serverTimestamp()});}catch(e){console.error(e)}} const link=`${location.origin}/${slug}`; layout(`<div class="page"><div class="score-card"><div class="score-orb">${score}<small>/${data.questions.length}</small></div><p class="eyebrow">All done, ${escapeHtml(name)}!</p><h1 class="headline">You got ${score} right.</h1><p class="subhead">Thanks for playing “${escapeHtml(data.title)}”.</p><button class="btn btn-primary" id="again">Play again</button><div class="share-box"><p>Send this quiz to a friend</p><div class="share-row"><input readonly value="${link}"><button class="btn btn-small btn-secondary" id="copy">Copy</button></div></div></div></div>`); document.querySelector('#again').onclick=()=>nameGate(slug,data);document.querySelector('#copy').onclick=()=>navigator.clipboard.writeText(link).then(()=>toast('Link copied!')); }
async function results(slug) { if(!db)return configNeeded(); layout(`<div class="page">${topbar(true)}<p class="eyebrow">Quiz dashboard</p><h1 class="headline">Loading results…</h1></div>`);try{const snap=await getDoc(doc(db,'quizzes',slug));if(!snap.exists())return notFound();const data=snap.data();const key=localStorage.getItem(`popquiz-owner-${slug}`);if(key!==data.ownerKey){layout(`<div class="page hero">${topbar(true)}<div class="hero-art">🔒</div><h1 class="headline">This dashboard is private.</h1><p class="subhead">Open it from the browser where you created this quiz.</p></div>`);return;}const attempts=await getDocs(query(collection(db,'quizzes',slug,'attempts'),orderBy('finishedAt','desc')));const link=`${location.origin}/${slug}`;layout(`<div class="page">${topbar(true)}<p class="eyebrow">${escapeHtml(data.title)}</p><h1 class="headline">Your results</h1><p class="subhead">${attempts.size} ${attempts.size===1?'person has':'people have'} completed this quiz.</p><div class="share-box"><p>Share your quiz</p><div class="share-row"><input readonly value="${link}"><button class="btn btn-small btn-secondary" id="copy">Copy</button></div></div><div class="question-list"><h3>Completed attempts</h3>${attempts.empty?'<div class="card empty">No completed attempts yet.<br>Share the link to get started!</div>':attempts.docs.map(d=>{const a=d.data();const date=a.finishedAt?.toDate?.().toLocaleString()||'Just now';return `<div class="attempt"><div><div class="attempt-name">${escapeHtml(a.name)}</div><div class="attempt-date">${date}</div></div><div class="attempt-score">${a.score}/${a.total}</div></div>`}).join('')}</div></div>`);document.querySelector('#copy').onclick=()=>navigator.clipboard.writeText(link).then(()=>toast('Link copied!'));document.querySelector('[data-go-home]').onclick=()=>nav('/setquestion');}catch(e){console.error(e);toast('Could not load results. Check Firestore indexes/rules.');}}
function configNeeded(){layout(`<div class="page hero">${topbar()}<div class="hero-art">⚙️</div><h1 class="headline">Connect Firebase first.</h1><p class="subhead">Add your project’s web configuration to <code>firebase-config.js</code>, then reload.</p><button class="btn btn-secondary" id="goCreate">Go to creator</button></div>`);document.querySelector('#goCreate').onclick=()=>nav('/setquestion');}
function notFound(){layout(`<div class="page hero">${topbar()}<div class="hero-art">🕵️</div><h1 class="headline">Quiz not found.</h1><p class="subhead">Check the link, or make a fresh quiz.</p><button class="btn btn-primary" id="goCreate">Create a quiz</button></div>`);document.querySelector('#goCreate').onclick=()=>nav('/setquestion');}
function route(){const parts=location.pathname.replace(/^\/+|\/+$/g,'').split('/').filter(Boolean);if(!parts.length)return home();if(parts[0]==='setquestion')return builderV2();if(parts.length===2&&parts[1]==='results')return resultsV2(parts[0]);return quiz(parts[0]);}window.addEventListener('popstate',route);route();
