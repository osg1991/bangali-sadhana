(() => {
  'use strict';

  const baseContent = window.BENGALI_BASE_CONTENT || { script: [], words: [], sentences: [] };
  const ramprasadContent = window.RAMPRASAD_CONTENT || { meta: {}, songs: [], words: [] };

  const dedupeWords = (items) => {
    const seen = new Set();
    return items.filter(item => {
      const key = item.bengali.normalize('NFC');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const content = {
    script: baseContent.script || [],
    practicalWords: baseContent.words || [],
    lyricWords: ramprasadContent.words || [],
    words: [...(baseContent.words || []), ...(ramprasadContent.words || [])],
    sentences: baseContent.sentences || [],
    songs: ramprasadContent.songs || [],
    ramprasadMeta: ramprasadContent.meta || {}
  };
  const app = document.getElementById('app');
  const navButtons = [...document.querySelectorAll('.nav-button')];
  const settingsDialog = document.getElementById('settings-dialog');
  const installButton = document.getElementById('install-button');
  const networkStatus = document.getElementById('network-status');
  const streakStatus = document.getElementById('streak-status');
  const toast = document.getElementById('toast');

  const STORAGE_KEY = 'bengali-sadhana-state-v1';
  const defaultState = {
    view: 'today',
    completedDates: [],
    mastered: [],
    settings: { roman: true, devanagari: true, tamil: false }
  };

  let state = loadState();
  let deferredInstallPrompt = null;
  let quizAnswers = {};
  let quizSubmitted = false;

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return {
        ...defaultState,
        ...stored,
        settings: { ...defaultState.settings, ...(stored?.settings || {}) }
      };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateStatus();
  }

  function todayIso() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dailySeed() {
    const start = Date.UTC(2026, 6, 28);
    const now = new Date();
    const current = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.floor((current - start) / 86400000));
  }

  function pickItems(items, count, seed, stride = 1, offset = 0) {
    if (!items.length || count <= 0) return [];
    const picked = [];
    let cursor = seed * stride + offset;
    while (picked.length < Math.min(count, items.length)) {
      const item = items[((cursor % items.length) + items.length) % items.length];
      if (!picked.includes(item)) picked.push(item);
      cursor += 1;
    }
    return picked;
  }

  function dailyItems() {
    const day = dailySeed();
    const song = content.songs.length ? content.songs[day % content.songs.length] : null;
    const songSpecificWords = song
      ? content.lyricWords.filter(word => word.songIds?.includes(song.id))
      : [];
    const lyricPool = songSpecificWords.length >= 2 ? songSpecificWords : content.lyricWords;
    const words = dedupeWords([
      ...pickItems(content.practicalWords, 3, day, 5, 2),
      ...pickItems(lyricPool, 2, day, 3, 1)
    ]);
    for (const fallback of pickItems(content.words, 5, day, 7, 4)) {
      if (words.length >= 5) break;
      if (!words.some(item => item.bengali === fallback.bengali)) words.push(fallback);
    }

    return {
      day: day + 1,
      script: pickItems(content.script, 3, day, 3),
      words,
      sentences: pickItems(content.sentences, 2, day, 2, 1),
      song
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function bridgeLines(item) {
    const lines = [];
    if (state.settings.roman && item.roman) lines.push(`<p class="bridge"><strong>Roman:</strong> ${escapeHtml(item.roman)}</p>`);
    if (state.settings.devanagari && item.devanagari) lines.push(`<p class="bridge"><strong>Devanagari:</strong> ${escapeHtml(item.devanagari)}</p>`);
    if (state.settings.tamil && item.tamil) lines.push(`<p class="bridge"><strong>Tamil bridge:</strong> ${escapeHtml(item.tamil)}</p>`);
    return lines.join('');
  }

  function wordMeaning(item) {
    return item.englishMeaning || item.meaning || '';
  }

  function itemKey(type, item, index = 0) {
    return item.id || `${type}-${item.bengali}-${index}`;
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) {
      showToast('Speech is not available in this browser.');
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'bn-IN';
    utterance.rate = 0.76;
    const voices = speechSynthesis.getVoices();
    utterance.voice = voices.find(voice => voice.lang.toLowerCase().startsWith('bn')) || null;
    speechSynthesis.speak(utterance);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function updateStatus() {
    networkStatus.textContent = navigator.onLine ? 'Online · offline copy ready' : 'Offline mode';
    networkStatus.className = `status-chip ${navigator.onLine ? 'online' : 'offline'}`;
    streakStatus.textContent = `${state.completedDates.length} day${state.completedDates.length === 1 ? '' : 's'} completed`;
  }

  function isMastered(type, key) {
    return state.mastered.includes(`${type}:${key}`);
  }

  function toggleMastered(type, key) {
    const token = `${type}:${key}`;
    state.mastered = isMastered(type, key)
      ? state.mastered.filter(item => item !== token)
      : [...state.mastered, token];
    saveState();
    renderCurrentView();
  }

  function scriptCard(item, index) {
    const key = itemKey('script', item, index);
    const mastered = isMastered('script', key);
    return `
      <article class="card">
        <div class="card-top">
          <span class="badge">${escapeHtml(item.group)}</span>
          <button class="speak-button" data-speak="${escapeHtml(item.bengali)}" aria-label="Pronounce ${escapeHtml(item.bengali)}">Hear</button>
        </div>
        <p class="bengali-xl">${escapeHtml(item.bengali)}</p>
        ${bridgeLines(item)}
        <div class="example">
          <p class="bengali-md">${escapeHtml(item.example)}</p>
          <p class="bridge">${escapeHtml(item.exampleRoman)}</p>
          <p class="meaning">${escapeHtml(item.meaning)}</p>
        </div>
        <div class="action-row">
          <button class="master-button ${mastered ? 'mastered' : ''}" data-master-type="script" data-master-key="${escapeHtml(key)}">${mastered ? 'Mastered ✓' : 'Mark mastered'}</button>
        </div>
      </article>`;
  }

  function wordCard(item, index) {
    const key = itemKey('word', item, index);
    const mastered = isMastered('word', key);
    const isLyricWord = item.category === 'Ramprasadi vocabulary';
    return `
      <article class="card compact ${isLyricWord ? 'lyric-word-card' : ''}">
        <div class="card-top">
          <span class="badge">${escapeHtml(item.category)}</span>
          <button class="speak-button" data-speak="${escapeHtml(item.bengali)}">Hear</button>
        </div>
        <p class="bengali-lg">${escapeHtml(item.bengali)}</p>
        ${bridgeLines(item)}
        <p class="meaning"><strong>English:</strong> ${escapeHtml(wordMeaning(item))}</p>
        ${item.tamilMeaning ? `<p class="meaning tamil-meaning"><strong>Tamil:</strong> ${escapeHtml(item.tamilMeaning)}</p>` : ''}
        ${item.sourceTitle ? `<details class="source-context"><summary>Seen in Ramprasad song</summary><p><strong>${escapeHtml(item.sourceTitle)}</strong></p><p class="bengali-md">${escapeHtml(item.sourceLine || '')}</p></details>` : ''}
        <div class="action-row">
          <button class="master-button ${mastered ? 'mastered' : ''}" data-master-type="word" data-master-key="${escapeHtml(key)}">${mastered ? 'Mastered ✓' : 'Mark mastered'}</button>
        </div>
      </article>`;
  }

  function sentenceCard(item, index) {
    const key = itemKey('sentence', item, index);
    const mastered = isMastered('sentence', key);
    return `
      <article class="card">
        <div class="card-top">
          <span class="badge">${escapeHtml(item.category)}</span>
          <button class="speak-button" data-speak="${escapeHtml(item.bengali)}">Hear</button>
        </div>
        <p class="bengali-lg">${escapeHtml(item.bengali)}</p>
        ${bridgeLines(item)}
        <details class="example">
          <summary>Reveal meaning</summary>
          <p class="meaning">${escapeHtml(item.meaning)}</p>
        </details>
        <div class="action-row">
          <button class="master-button ${mastered ? 'mastered' : ''}" data-master-type="sentence" data-master-key="${escapeHtml(key)}">${mastered ? 'Mastered ✓' : 'Mark mastered'}</button>
        </div>
      </article>`;
  }

  function songLine(song) {
    return song?.featuredLine || song || {};
  }

  function songWordPieces(song) {
    return (song.words || []).map(word => {
      const bengali = Array.isArray(word) ? word[0] : word.bengali;
      const english = Array.isArray(word) ? word[1] : word.englishMeaning;
      const tamil = Array.isArray(word) ? '' : word.tamilMeaning;
      return `<div class="word-piece"><strong>${escapeHtml(bengali)}</strong><span>${escapeHtml(english || '')}</span>${tamil ? `<small>${escapeHtml(tamil)}</small>` : ''}</div>`;
    }).join('');
  }

  function renderImportedVerses(song) {
    if (!song.verses?.length) return '';
    return `<details class="song-verses"><summary>Show imported lyrics (${song.verses.length} sections)</summary>${song.verses.map((verse, verseIndex) => `
      <section class="verse-block"><h4>Verse ${verseIndex + 1}</h4>${verse.bengali.map((line, lineIndex) => `
        <div class="verse-line">
          <p class="bengali-md">${escapeHtml(line)}</p>
          ${state.settings.roman && verse.roman?.[lineIndex] ? `<p class="bridge">${escapeHtml(verse.roman[lineIndex])}</p>` : ''}
          ${verse.englishMeaning?.[lineIndex] ? `<p class="meaning">${escapeHtml(verse.englishMeaning[lineIndex])}</p>` : ''}
          ${verse.tamilMeaning?.[lineIndex] ? `<p class="meaning tamil-meaning">${escapeHtml(verse.tamilMeaning[lineIndex])}</p>` : ''}
        </div>`).join('')}</section>`).join('')}</details>`;
  }

  function songCard(song, expanded = true) {
    if (!song) return '<article class="card"><p>No imported song content is available yet. Run the Ramprasad sync.</p></article>';
    const line = songLine(song);
    return `
      <article class="card">
        <span class="badge">Ramprasad Sen · imported</span>
        <h3>${escapeHtml(song.title)}</h3>
        <p class="bengali-lg">${escapeHtml(line.bengali || '')}</p>
        ${state.settings.roman && line.roman ? `<p class="bridge"><strong>Roman:</strong> ${escapeHtml(line.roman)}</p>` : ''}
        <p class="meaning"><strong>English:</strong> ${escapeHtml(line.englishMeaning || line.meaning || '')}</p>
        ${line.tamilMeaning ? `<p class="meaning tamil-meaning"><strong>Tamil:</strong> ${escapeHtml(line.tamilMeaning)}</p>` : ''}
        ${expanded && song.words?.length ? `<div class="word-breakdown">${songWordPieces(song)}</div>` : ''}
        ${song.audio ? `<audio controls preload="none" src="${escapeHtml(song.audio)}">Your browser does not support audio.</audio>` : '<p class="small-note">No audio link was found in the source index.</p>'}
        ${expanded ? renderImportedVerses(song) : ''}
        <div class="action-row">
          <button class="speak-button" data-speak="${escapeHtml(line.bengali || '')}">Hear spoken line</button>
          <a class="secondary-button" href="${escapeHtml(song.source)}" target="_blank" rel="noopener">Open source Markdown</a>
        </div>
      </article>`;
  }

  function renderToday() {
    const daily = dailyItems();
    const complete = state.completedDates.includes(todayIso());
    const masteredToday = [
      ...daily.script.map(item => isMastered('script', itemKey('script', item, content.script.indexOf(item)))),
      ...daily.words.map(item => isMastered('word', itemKey('word', item, content.words.indexOf(item)))),
      ...daily.sentences.map(item => isMastered('sentence', itemKey('sentence', item, content.sentences.indexOf(item))))
    ].filter(Boolean).length;
    const total = daily.script.length + daily.words.length + daily.sentences.length;
    const progress = complete ? 100 : Math.round((masteredToday / total) * 100);

    app.innerHTML = `
      <section class="hero">
        <p class="kicker">Daily practice · Day ${daily.day}</p>
        <h2>আজকের সাধনা</h2>
        <p>Three letters, five words, two sentences and one devotional line. Complete what you can; continuity matters more than quantity.</p>
        <div class="hero-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <p class="small-note">${complete ? 'Today completed' : `${progress}% of today marked mastered`}</p>
        </div>
      </section>

      <div class="section-heading"><div><h2>1. Letters</h2><p>Recognise, pronounce and connect.</p></div></div>
      <section class="card-grid three">${daily.script.map(item => scriptCard(item, content.script.indexOf(item))).join('')}</section>

      <div class="section-heading"><div><h2>2. Useful words</h2><p>Three practical words and two words taken from today’s Ramprasad song.</p></div></div>
      <section class="card-grid two">${daily.words.map(item => wordCard(item, content.words.indexOf(item))).join('')}</section>

      <div class="section-heading"><div><h2>3. Spoken Bengali</h2><p>Listen, hide the meaning and recall.</p></div></div>
      <section class="card-grid">${daily.sentences.map(item => sentenceCard(item, content.sentences.indexOf(item))).join('')}</section>

      <div class="section-heading"><div><h2>4. Ramprasadi line</h2><p>Learn Bengali through devotion from the first day.</p></div></div>
      <section>${songCard(daily.song)}</section>

      <div class="section-heading"><div><h2>5. Recall check</h2><p>Five quick questions from today’s words.</p></div></div>
      <section id="quiz-section">${renderQuiz(daily.words)}</section>

      <section class="card" style="margin-top:16px;text-align:center">
        <h2>${complete ? 'Practice recorded' : 'Finish today’s practice'}</h2>
        <p class="small-note">This only records continuity. You may revisit every card at any time.</p>
        <button id="complete-day" class="primary-button">${complete ? 'Completed today ✓' : 'Mark today complete'}</button>
      </section>`;
  }

  function quizOptions(correct, questionIndex) {
    const pool = [...new Set(content.words.map(wordMeaning))].filter(value => value && value !== correct);
    const selected = [];
    let cursor = (dailySeed() * 7 + questionIndex * 11) % pool.length;
    while (selected.length < 3) {
      const option = pool[cursor % pool.length];
      if (!selected.includes(option)) selected.push(option);
      cursor += 7;
    }
    const options = [...selected, correct];
    return options.sort((a, b) => hashString(`${a}-${questionIndex}`) - hashString(`${b}-${questionIndex}`));
  }

  function hashString(value) {
    let hash = 0;
    for (const char of value) hash = ((hash << 5) - hash) + char.charCodeAt(0);
    return Math.abs(hash);
  }

  function renderQuiz(words) {
    if (quizSubmitted) {
      const score = words.filter((item, index) => quizAnswers[index] === wordMeaning(item)).length;
      return `<div class="card quiz-result"><p class="bengali-lg">${score}/5</p><p>${score >= 4 ? 'Excellent recall.' : score >= 2 ? 'Good beginning. Review the missed words once.' : 'Review today’s five word cards and try again.'}</p><button id="retry-quiz" class="secondary-button">Try again</button></div>`;
    }

    return `<div class="card">${words.map((item, index) => `
      <div class="quiz-question">
        <h3>${index + 1}. What does <span class="bengali-md">${escapeHtml(item.bengali)}</span> mean?</h3>
        <div class="quiz-options">
          ${quizOptions(wordMeaning(item), index).map(option => `<button class="quiz-option ${quizAnswers[index] === option ? 'selected' : ''}" data-question="${index}" data-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}
        </div>
      </div>`).join('')}
      <button id="submit-quiz" class="primary-button" ${Object.keys(quizAnswers).length < words.length ? 'disabled' : ''}>Check answers</button>
    </div>`;
  }

  function renderLibrary(type) {
    const configurations = {
      script: { title: 'অক্ষর · Script', subtitle: 'Vowels, consonants, vowel signs and common conjuncts.', items: content.script, card: scriptCard },
      words: { title: 'শব্দ · Words', subtitle: 'Practical vocabulary plus reviewed words imported from Ramprasad Sen lyrics.', items: content.words, card: wordCard },
      sentences: { title: 'বাক্য · Sentences', subtitle: 'Daily phrases for speaking and comprehension.', items: content.sentences, card: sentenceCard }
    };
    const config = configurations[type];
    const groups = [...new Set(config.items.map(item => item.group || item.category))];

    app.innerHTML = `
      <section class="hero"><p class="kicker">Learning library</p><h2>${config.title}</h2><p>${config.subtitle}</p></section>
      <div class="search-panel">
        <input id="library-search" type="search" placeholder="Search Bengali or meaning" aria-label="Search">
        <select id="library-filter" aria-label="Filter category"><option value="">All groups</option>${groups.map(group => `<option>${escapeHtml(group)}</option>`).join('')}</select>
      </div>
      <section id="library-results" class="card-grid ${type === 'sentences' ? '' : 'two'}"></section>`;

    const renderResults = () => {
      const search = document.getElementById('library-search').value.trim().toLowerCase();
      const group = document.getElementById('library-filter').value;
      const filtered = config.items
        .map((item, originalIndex) => ({ item, originalIndex }))
        .filter(({ item }) => !group || (item.group || item.category) === group)
        .filter(({ item }) => !search || Object.values(item).join(' ').toLowerCase().includes(search));
      document.getElementById('library-results').innerHTML = filtered.length
        ? filtered.map(({ item, originalIndex }) => config.card(item, originalIndex)).join('')
        : '<div class="empty-state">No matching items.</div>';
    };

    document.getElementById('library-search').addEventListener('input', renderResults);
    document.getElementById('library-filter').addEventListener('change', renderResults);
    renderResults();
  }

  function renderSongs() {
    const meta = content.ramprasadMeta;
    app.innerHTML = `
      <section class="hero"><p class="kicker">Devotional immersion</p><h2>রামপ্রসাদী গান</h2><p>The song archive is imported at build time. Each reviewed lyric word can enter the daily lesson vocabulary.</p></section>
      <div class="sync-summary"><span>${content.songs.length} songs imported</span><span>${content.lyricWords.length} reviewed lyric words</span>${meta.sourceCommit ? `<span>Source ${escapeHtml(meta.sourceCommit.slice(0, 7))}</span>` : ''}</div>
      <div class="section-heading"><div><h2>Imported songs</h2><p>Lyrics stay traceable to the canonical RamprasadSen repository.</p></div></div>
      <section class="card-grid">${content.songs.map(song => songCard(song)).join('')}</section>`;
  }

  function renderCurrentView() {
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
    quizAnswers = state.view === 'today' ? quizAnswers : {};
    quizSubmitted = state.view === 'today' ? quizSubmitted : false;

    if (state.view === 'today') renderToday();
    else if (state.view === 'songs') renderSongs();
    else renderLibrary(state.view);

    app.focus({ preventScroll: true });
  }

  document.addEventListener('click', event => {
    const speakButton = event.target.closest('[data-speak]');
    if (speakButton) speak(speakButton.dataset.speak);

    const masterButton = event.target.closest('[data-master-type]');
    if (masterButton) toggleMastered(masterButton.dataset.masterType, masterButton.dataset.masterKey);

    const quizOption = event.target.closest('.quiz-option');
    if (quizOption) {
      quizAnswers[Number(quizOption.dataset.question)] = quizOption.dataset.answer;
      const daily = dailyItems();
      document.getElementById('quiz-section').innerHTML = renderQuiz(daily.words);
    }

    if (event.target.id === 'submit-quiz') {
      quizSubmitted = true;
      document.getElementById('quiz-section').innerHTML = renderQuiz(dailyItems().words);
    }

    if (event.target.id === 'retry-quiz') {
      quizAnswers = {};
      quizSubmitted = false;
      document.getElementById('quiz-section').innerHTML = renderQuiz(dailyItems().words);
    }

    if (event.target.id === 'complete-day') {
      const date = todayIso();
      state.completedDates = state.completedDates.includes(date)
        ? state.completedDates
        : [...state.completedDates, date];
      saveState();
      renderToday();
      showToast('Today’s practice recorded.');
    }
  });

  navButtons.forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    saveState();
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }));

  document.getElementById('settings-button').addEventListener('click', () => settingsDialog.showModal());
  const settingsInputs = {
    roman: document.getElementById('show-roman'),
    devanagari: document.getElementById('show-devanagari'),
    tamil: document.getElementById('show-tamil')
  };
  Object.entries(settingsInputs).forEach(([key, input]) => {
    input.checked = state.settings[key];
    input.addEventListener('change', () => {
      state.settings[key] = input.checked;
      saveState();
      renderCurrentView();
    });
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener('appinstalled', () => showToast('Bengali Sadhana installed.'));
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {
      showToast('Offline setup could not be completed.');
    }));
  }

  updateStatus();
  renderCurrentView();
})();
