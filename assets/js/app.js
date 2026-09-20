(() => {
  const moduleArea = document.getElementById('module-area');
  const navButtons = Array.from(document.querySelectorAll('.nav-btn[data-module]'));
  const levelSelect = document.getElementById('level-select');
  const scoreElement = document.getElementById('score');
  const progressElement = document.getElementById('progress');
  const chat = document.getElementById('ai-chat');
  const messages = document.getElementById('messages');
  const chatInput = document.getElementById('chat-input');
  const apiBase = 'http://localhost:3000';

  let questions = {};
  let currentLevel = levelSelect.value;
  let currentModule = 'listening';
  let currentIndex = 0;
  let score = Number.parseInt(localStorage.getItem('mi_score') || '0', 10) || 0;

  function updateScore(points) {
    score += points;
    scoreElement.textContent = score;
    progressElement.textContent = `进度：${Math.min(100, Math.floor(score / 10))}%`;
    localStorage.setItem('mi_score', String(score));
  }

  function appendMessage(who, text) {
    const element = document.createElement('div');
    element.className = `message ${who === 'user' ? 'user' : 'ai'}`;
    element.textContent = text;
    messages.appendChild(element);
    messages.scrollTop = messages.scrollHeight;
  }

  function showNextQuestion() {
    renderModule(currentModule);
  }

  function createChoiceButtons(container, question) {
    const choices = document.createElement('div');
    choices.className = 'controls';
    question.choices.forEach((choice, index) => {
      const button = document.createElement('button');
      button.className = 'btn secondary';
      button.textContent = choice;
      button.addEventListener('click', () => {
        const correct = index === question.answer;
        if (correct) updateScore(10);
        alert(correct ? '回答正确 +10' : '回答错误');
        showNextQuestion();
      });
      choices.appendChild(button);
    });
    container.appendChild(choices);
  }

  function createTextAnswer(container, question) {
    const input = document.createElement('input');
    input.style.cssText = 'padding:8px;border-radius:8px;width:100%;';
    container.appendChild(input);
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = '提交';
    button.addEventListener('click', () => {
      const answer = input.value.trim().toLowerCase();
      const expected = String(question.answer || '').toLowerCase();
      const correct = expected.split('/').some(item => answer.includes(item.trim()));
      if (correct) updateScore(10);
      alert(correct ? '回答正确 +10' : '答案不完全正确');
      showNextQuestion();
    });
    container.appendChild(button);
  }

  function createWritingQuestion(container, question) {
    const textarea = document.createElement('textarea');
    textarea.rows = 6;
    textarea.style.cssText = 'width:100%;border-radius:8px;padding:8px;';
    container.appendChild(textarea);
    const feedback = document.createElement('div');
    feedback.className = 'note';
    container.appendChild(feedback);
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = '提交作文并请求 AI 判分';
    button.addEventListener('click', async () => {
      const text = textarea.value.trim();
      if (text.split(/\s+/).filter(Boolean).length < 20) {
        feedback.textContent = '请写至少 20 个词。';
        return;
      }
      feedback.textContent = '正在提交给 AI 判分...';
      try {
        const response = await fetch(`${apiBase}/api/ai/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'writing', level: currentLevel, prompt: question.prompt, text })
        });
        const result = await response.json();
        feedback.textContent = `AI 评分：${result.score ?? 'N/A'}；建议：${result.feedback || '无'}`;
        if (typeof result.score === 'number') updateScore(result.score);
      } catch (error) {
        feedback.textContent = 'AI 判分失败，请先启动本地后端服务。';
      }
    });
    container.appendChild(button);
  }

  function createSpeakingQuestion(container, question) {
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = '开始录音并提交判分';
    button.addEventListener('click', () => startRecognitionAndScore(question, container));
    container.appendChild(button);
  }

  function renderQuestion(container, question) {
    const prompt = document.createElement('p');
    prompt.textContent = question.prompt;
    container.appendChild(prompt);
    if (question.type === 'listening' || question.type === 'mcq') {
      if (question.audio) {
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = question.audio;
        container.appendChild(audio);
      }
      createChoiceButtons(container, question);
    } else if (question.type === 'cloze' || question.type === 'short_answer') {
      createTextAnswer(container, question);
    } else if (question.type === 'speaking') {
      createSpeakingQuestion(container, question);
    } else if (question.type === 'writing') {
      createWritingQuestion(container, question);
    }
  }

  function matchesModule(question) {
    if (currentModule === 'listening') return question.type === 'listening';
    if (currentModule === 'speaking') return question.type === 'speaking';
    if (currentModule === 'writing') return question.type === 'writing';
    return ['mcq', 'short_answer', 'cloze'].includes(question.type);
  }

  function renderModule(name) {
    currentModule = name;
    moduleArea.innerHTML = '';
    const title = document.createElement('h2');
    title.textContent = { listening: '听力', speaking: '口语', reading: '阅读', writing: '写作' }[name] || '练习';
    moduleArea.appendChild(title);
    const card = document.createElement('div');
    card.className = 'card exercise';
    moduleArea.appendChild(card);
    const list = questions[currentLevel] || [];
    const questionIndex = list.findIndex((question, index) => index >= currentIndex && matchesModule(question));
    if (questionIndex === -1) {
      card.innerHTML = `<p class="note">${list.length ? '本次级别已完成该模块题目。' : '该级别暂无题目。'}</p>`;
      return;
    }
    currentIndex = questionIndex + 1;
    renderQuestion(card, list[questionIndex]);
  }

  async function loadQuestions() {
    try {
      const response = await fetch('data/questions.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      questions = data.bank || {};
    } catch (error) {
      console.error('无法加载题库', error);
      questions = {};
    }
  }

  function startRecognitionAndScore(question, container) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('当前浏览器不支持语音识别。');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.onresult = async event => {
      const transcript = event.results[0][0].transcript;
      const result = document.createElement('div');
      result.className = 'note';
      result.textContent = `识别结果：${transcript}`;
      container.appendChild(result);
      try {
        const response = await fetch(`${apiBase}/api/ai/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'speaking', level: currentLevel, prompt: question.prompt, transcript })
        });
        const data = await response.json();
        result.textContent += `；AI 评分：${data.score ?? 'N/A'}；建议：${data.feedback || '无'}`;
        if (typeof data.score === 'number') updateScore(data.score);
      } catch (error) {
        result.textContent += '；AI 判分失败，请先启动本地后端服务。';
      }
    };
    recognition.onerror = event => alert(`识别错误：${event.error}`);
    recognition.start();
  }

  navButtons.forEach(button => button.addEventListener('click', () => {
    navButtons.forEach(item => item.classList.toggle('active', item === button));
    currentIndex = 0;
    renderModule(button.dataset.module);
  }));

  levelSelect.addEventListener('change', () => {
    currentLevel = levelSelect.value;
    currentIndex = 0;
    renderModule(currentModule);
  });

  document.getElementById('ai-chat-toggle').addEventListener('click', () => chat.classList.remove('hidden'));
  document.getElementById('close-chat').addEventListener('click', () => chat.classList.add('hidden'));
  document.getElementById('send-chat').addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage('user', text);
    chatInput.value = '';
    appendMessage('ai', '（占位）请配置后端以获取真实回复。');
  });

  scoreElement.textContent = score;
  progressElement.textContent = `进度：${Math.min(100, Math.floor(score / 10))}%`;
  loadQuestions().then(() => renderModule('listening'));
})();
