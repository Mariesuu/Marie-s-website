const modules = {
  listening: `
    <div class="card exercise">
      <h2>听力练习</h2>
      <p class="note">练习：听一段短对话，选择正确答案（DELE A2 常见题型）</p>
      <audio id="audio-src" controls src="assets/media/sample-audio.mp3"></audio>
      <div class="controls">
        <select id="q-select">
          <option value="1">问题 1</option>
          <option value="2">问题 2</option>
        </select>
        <button id="submit-listen" class="btn">提交答案</button>
      </div>
    </div>
  `,
  speaking: `
    <div class="card exercise">
      <h2>口语练习</h2>
      <p class="note">与 AI 进行口语对话。点击录音开始练习，然后发送到 AI 获取反馈（占位）。</p>
      <div class="controls">
        <button id="start-record" class="btn">开始录音</button>
        <button id="stop-record" class="btn secondary">停止</button>
      </div>
      <div id="rec-result" class="note">录音结果：<span id="rec-text">无</span></div>
    </div>
  `,
  reading: `
    <div class="card exercise">
      <h2>阅读练习</h2>
      <p class="note">短文阅读，选择最佳答案（模仿DELE题型）</p>
      <div id="reading-text">[西语短文占位]</div>
      <div class="controls">
        <button id="start-quiz" class="btn">开始测验</button>
      </div>
    </div>
  `,
  writing: `
    <div class="card exercise">
      <h2>写作练习</h2>
      <p class="note">写一段 60-80 词的短文，主题由系统给出，AI 将提供评分与修改建议（占位）。</p>
      <textarea id="writing-area" rows="6" style="width:100%;border-radius:8px;padding:8px;border:1px solid #f0dbe3"></textarea>
      <div class="controls">
        <button id="submit-write" class="btn">提交作文</button>
      </div>
      <div id="write-feedback" class="note"></div>
    </div>
  `
}

const moduleArea = document.getElementById('module-area')
const navBtns = document.querySelectorAll('.nav-btn')

function loadModule(name){
  moduleArea.innerHTML = modules[name]
  navBtns.forEach(b=>b.classList.toggle('active', b.dataset.module===name))
}

navBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    const m = b.dataset.module
    if(m) loadModule(m)
  })
})

// initial
loadModule('listening')

// AI chat toggle
const chat = document.getElementById('ai-chat')
const aiToggle = document.getElementById('ai-chat-toggle')
const closeChat = document.getElementById('close-chat')

aiToggle.addEventListener('click', ()=>chat.classList.toggle('hidden'))
closeChat.addEventListener('click', ()=>chat.classList.add('hidden'))

// simple chat placeholder
const sendChatBtn = document.getElementById('send-chat')
const messages = document.getElementById('messages')
const chatInput = document.getElementById('chat-input')

if(sendChatBtn){
  sendChatBtn.addEventListener('click', async ()=>{
    const text = chatInput.value.trim()
    if(!text) return
    appendMessage('user', text)
    chatInput.value = ''
    appendMessage('ai', '（AI 正在思考...）')
    // placeholder: simulate response
    setTimeout(()=>{
      appendMessage('ai', 'Hola! Soy tu asistente. 请用西班牙语继续对话或请求纠错。')
    }, 900)
  })
}

function appendMessage(who, text){
  const el = document.createElement('div')
  el.className = 'message ' + (who==='user' ? 'user' : 'ai')
  el.textContent = text
  messages.appendChild(el)
  messages.scrollTop = messages.scrollHeight
}

// simple local scoring & progress
let score = 0
function addScore(n){
  score += n
  document.getElementById('score').textContent = score
  const prog = Math.min(100, Math.floor(score / 10))
  document.getElementById('progress').textContent = `进度：${prog}%`
}

// writing submit
window.addEventListener('click', (e)=>{
  if(e.target && e.target.id==='submit-write'){
    const txt = document.getElementById('writing-area').value.trim()
    if(txt.length<20){
      document.getElementById('write-feedback').textContent = '作文太短，至少 20 字。'
      return
    }
    document.getElementById('write-feedback').textContent = '已提交，AI 评分处理中（占位）...'
    setTimeout(()=>{
      document.getElementById('write-feedback').textContent = '评分：7/10。建议：句子连接更自然，注意过去时态。'
      addScore(7)
    },1200)
  }
})

// recording (placeholder using Web Speech API for recognition)
let recognition
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
  recognition = new SpeechRec()
  recognition.lang = 'es-ES'
  recognition.interimResults = false
  recognition.onresult = (e)=>{
    const t = e.results[0][0].transcript
    document.getElementById('rec-text').textContent = t
    addScore(3)
  }
}

window.addEventListener('click', (e)=>{
  if(e.target && e.target.id==='start-record'){
    if(recognition) recognition.start()
  }
  if(e.target && e.target.id==='stop-record'){
    if(recognition) recognition.stop()
  }
})
(function(){
  // 简化并改为基于题库 JSON 的抽题流程
  let questions = null;
  let currentLevel = 'A2';
  let currentIndex = 0;
  let score = 0;
  const API_BASE = 'http://localhost:3000';
  const moduleArea = document.getElementById('module-area');
  const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
  const scoreEl = document.getElementById('score');
  const progressEl = document.getElementById('progress');
  const levelSelect = document.getElementById('level-select');

  async function loadQuestions(){
+    try{
+      const res = await fetch('data/questions.json');
+      const j = await res.json();
+      questions = j.bank || {};
+    }catch(e){
+      console.error('无法加载题库', e);
+      questions = {A2:[],B1:[],B2:[],C1:[]};
+    }
+  }
+
  navBtns.forEach(btn=>{
+    btn.addEventListener('click',()=>{
+      navBtns.forEach(b=>b.classList.remove('active'));
+      btn.classList.add('active');
+      const m = btn.dataset.module;
+      renderModule(m);
+    });
+  });
+
  levelSelect.addEventListener('change',()=>{
+    currentLevel = levelSelect.value;
+    currentIndex = 0;
+    renderModule(document.querySelector('.nav-btn.active').dataset.module || 'listening');
+  });
+
  document.getElementById('ai-chat-toggle').addEventListener('click',()=>{
+    document.getElementById('ai-chat').classList.remove('hidden');
+  });
+  document.getElementById('close-chat').addEventListener('click',()=>{
+    document.getElementById('ai-chat').classList.add('hidden');
+  });
+  document.getElementById('send-chat').addEventListener('click',sendChat);
+
  function renderModule(name){
+    moduleArea.innerHTML = '';
+    const h = document.createElement('h2'); h.textContent = name==='listening'?'听力':name==='speaking'?'口语':name==='reading'?'阅读':'写作';
+    moduleArea.appendChild(h);
+    const card = document.createElement('div'); card.className='card exercise';
+    moduleArea.appendChild(card);
+    const list = (questions && questions[currentLevel]) || [];
+    if(list.length===0){ card.innerHTML = '<p class="note">该级别暂无题目。</p>'; return; }
+
+    // find next relevant type for module
+    let item = null;
+    for(let i=currentIndex;i<list.length;i++){
+      const t = list[i];
+      if((name==='listening' && t.type.startsWith('listening')) || (name==='speaking' && t.type==='speaking') || (name==='reading' && (t.type==='mcq' || t.type==='short_answer' || t.type==='cloze')) || (name==='writing' && t.type==='writing')){ item = t; currentIndex = i+1; break; }
+    }
+    if(!item){ card.innerHTML = '<p class="note">本次级别已完成该模块题目。</p>'; return; }
+
+    renderQuestion(card, item);
+  }
+
+
+  function renderQuestion(container, q){
+    const p = document.createElement('p'); p.textContent = q.prompt; container.appendChild(p);
+    if(q.type==='mcq'){
+      const choices = document.createElement('div'); choices.className='controls';
+      q.choices.forEach((c,idx)=>{
+        const b = document.createElement('button'); b.className='btn secondary'; b.textContent = c; b.addEventListener('click', ()=>{
+          if(idx===q.answer){ addScore(10); alert('回答正确 +10'); } else { alert('回答错误'); }
+          renderModule(document.querySelector('.nav-btn.active').dataset.module || 'listening');
+        });
+        choices.appendChild(b);
+      });
+      container.appendChild(choices);
+    } else if(q.type==='cloze'){
+      const inp = document.createElement('input'); inp.style.padding='8px'; inp.style.borderRadius='8px'; inp.style.width='100%'; container.appendChild(inp);
+      const b = document.createElement('button'); b.className='btn'; b.textContent='提交'; b.addEventListener('click', ()=>{
+        const val = inp.value.trim().toLowerCase(); if(val.includes(q.answer.toLowerCase())){ addScore(10); alert('回答正确 +10'); } else { alert('不完全正确'); } renderModule(document.querySelector('.nav-btn.active').dataset.module || 'listening');
+      }); container.appendChild(b);
+    } else if(q.type==='listening'){
+      if(q.audio){
+        const a = document.createElement('audio'); a.controls=true; a.src = q.audio; container.appendChild(a);
+      }
+      if(q.choices && q.choices.length){
+        const choices = document.createElement('div'); choices.className='controls';
+        q.choices.forEach((c,idx)=>{
          const b = document.createElement('button'); b.className='btn secondary'; b.textContent=c; b.addEventListener('click', ()=>{ if(idx===q.answer){ addScore(10); alert('回答正确 +10'); } else { alert('错误'); } renderModule(document.querySelector('.nav-btn.active').dataset.module || 'listening'); }); choices.appendChild(b);
        });
        container.appendChild(choices);
+      } else {
+        const note = document.createElement('div'); note.className='note'; note.textContent='此题需听力音频或摘要后回答。'; container.appendChild(note);
+      }
    } else if(q.type==='speaking'){
      const note = document.createElement('div'); note.className='note'; note.textContent='口语题：' + q.prompt; container.appendChild(note);
      const rec = document.createElement('button'); rec.className='btn'; rec.textContent='开始录音并提交判分(需浏览器支持)'; rec.addEventListener('click', ()=>{ startRecognitionAndScore(q, container); }); container.appendChild(rec);
    } else if(q.type==='writing'){
      const ta = document.createElement('textarea'); ta.rows=6; ta.style.width='100%'; ta.style.borderRadius='8px'; container.appendChild(ta);
      const fb = document.createElement('div'); fb.className='note'; fb.id='write-feedback-local'; container.appendChild(fb);
      const b = document.createElement('button'); b.className='btn'; b.textContent='提交作文并请求 AI 判分'; b.addEventListener('click', async ()=>{
        const text = ta.value.trim(); if(text.split(/\s+/).length<20){ alert('请写至少20词'); return; }
        fb.textContent = '正在提交给 AI 判分...';
        const res = await sendWritingToAI(text, q, currentLevel).catch(e=>{ fb.textContent = 'AI 判分失败：' + e.message; return null; });
        if(res){
          fb.textContent = 'AI 评分：' + (res.score ?? 'N/A') + '；建议：' + (res.feedback || '无');
          if(typeof res.score === 'number' && res.score>0) addScore(res.score);
        }
        renderModule(document.querySelector('.nav-btn.active').dataset.module || 'writing');
      }); container.appendChild(b);
+    } else if(q.type==='short_answer'){
+      const inp = document.createElement('input'); inp.style.padding='8px'; inp.style.borderRadius='8px'; inp.style.width='100%'; container.appendChild(inp);
+      const b = document.createElement('button'); b.className='btn'; b.textContent='提交'; b.addEventListener('click', ()=>{ addScore(10); alert('已提交（占位判分）'); renderModule(document.querySelector('.nav-btn.active').dataset.module || 'reading'); }); container.appendChild(b);
+    }
+  }
+
+  function addScore(n){ score += n; scoreEl.textContent = score; const prog = Math.min(100, Math.floor(score/10)); progressEl.textContent = '进度：' + prog + '%'; localStorage.setItem('mi_score', score); localStorage.setItem('mi_progress', prog); }
+
+  // TTS 简化
+  function speakText(text){ if('speechSynthesis' in window){ const u = new SpeechSynthesisUtterance(text); u.lang='es-ES'; window.speechSynthesis.speak(u); } }
+
+  // 简易 STT 占位实现
+  function startRecognitionMock(){ alert('开始录音（仅占位，浏览器需支持 SpeechRecognition）'); }
+
+
  // AI Chat (占位)
  async function sendChat(){ const input = document.getElementById('chat-input'); const t = input.value.trim(); if(!t) return; appendMessage('user', t); input.value=''; appendMessage('ai','（占位）请配置后端以获取真实回复'); }
  function appendMessage(who, text){ const messages = document.getElementById('messages'); const el = document.createElement('div'); el.className='message ' + (who==='user'?'user':'ai'); el.textContent = text; messages.appendChild(el); messages.scrollTop = messages.scrollHeight; }

  // === AI 判分辅助函数（占位） ===
  // 口语：识别后发送到后端评分接口 /api/ai/score
  async function startRecognitionAndScore(q, container){
    if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)){
      alert('当前浏览器不支持语音识别（SpeechRecognition），无法进行口语自动判分');
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec(); rec.lang='es-ES'; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onresult = async (e)=>{
      const text = e.results[0][0].transcript;
      const note = document.createElement('div'); note.className='note'; note.textContent = '识别结果：' + text; container.appendChild(note);
      try{
        const res = await fetch(API_BASE + '/api/ai/score', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({type:'speaking', level:currentLevel, prompt:q.prompt, transcript:text})
        });
        const j = await res.json();
        const out = document.createElement('div'); out.className='note'; out.textContent = 'AI 评分：' + (j.score ?? 'N/A') + '；建议：' + (j.feedback || '无'); container.appendChild(out);
        if(typeof j.score === 'number') addScore(j.score);
      }catch(err){
        const out = document.createElement('div'); out.className='note'; out.textContent = 'AI 判分失败（占位）。请配置后端。'; container.appendChild(out);
      }
      renderModule(document.querySelector('.nav-btn.active').dataset.module || 'speaking');
    };
    rec.onerror = (e)=>{ alert('识别错误：' + e.error); };
    rec.start();
  }

  // 写作：将文本发送到后端 /api/ai/score，返回 {score, feedback}
  async function sendWritingToAI(text, q, level){
    try{
      const res = await fetch(API_BASE + '/api/ai/score', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type:'writing', level, prompt:q.prompt, text})
      });
      return await res.json();
    }catch(e){
      throw e;
    }
  }

  // 初始化加载题库并渲染默认模块
  async function init(){ await loadQuestions(); renderModule('listening'); const savedScore = parseInt(localStorage.getItem('mi_score')||'0',10); score = isNaN(savedScore)?0:savedScore; scoreEl.textContent = score; }
  init();

})();
