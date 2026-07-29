(() => {
  'use strict';

  const engine = window.BENGALI_SRS_ENGINE;
  if (!engine) return;

  const STORAGE_KEY = 'bengali-sadhana-srs-v1';
  const MAX_REVIEWS = 20;
  const MAX_NEW = 5;
  const app = document.getElementById('app');
  const concepts = engine.buildConcepts(window.BENGALI_BASE_CONTENT || {}, window.RAMPRASAD_CONTENT || {});
  const conceptMap = new Map(concepts.map(concept => [concept.id, concept]));

  let store = loadStore();
  let session = null;

  function loadStore() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { version: 1, records: parsed?.records || {}, sessions: parsed?.sessions || [] };
    } catch {
      return { version: 1, records: {}, sessions: [] };
    }
  }

  function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function queueForToday() {
    return engine.buildQueue(concepts, store.records, {
      today: engine.localIso(),
      maxReviews: MAX_REVIEWS,
      maxNew: MAX_NEW
    });
  }

  function summary() {
    const stats = engine.summarise(store.records, engine.localIso());
    const queue = queueForToday();
    const newCount = queue.filter(card => !store.records[card.id]).length;
    return { ...stats, queueCount: queue.length, newCount, conceptCount: concepts.length };
  }

  function setReviewNavActive() {
    document.querySelectorAll('.nav-button').forEach(button => {
      button.classList.toggle('active', button.dataset.view === 'review');
    });
  }

  function renderDashboard() {
    session = null;
    setReviewNavActive();
    const stats = summary();
    app.innerHTML = `
      <section class="hero srs-hero">
        <p class="kicker">Spaced repetition</p>
        <h2>পুনরাবৃত্তি · Review</h2>
        <p>Short adaptive tests for letters, practical words and reviewed Ramprasad vocabulary.</p>
      </section>

      <section class="srs-stats" aria-label="Review statistics">
        <article class="card srs-stat"><strong>${stats.queueCount}</strong><span>Ready now</span></article>
        <article class="card srs-stat"><strong>${stats.reviewedToday}</strong><span>Reviewed today</span></article>
        <article class="card srs-stat"><strong>${stats.mature}</strong><span>Mature cards</span></article>
        <article class="card srs-stat"><strong>${stats.accuracy}%</strong><span>Overall accuracy</span></article>
      </section>

      <section class="card srs-dashboard-card">
        <h2>${stats.queueCount ? `${stats.queueCount} cards are ready` : 'No cards are due'}</h2>
        <p>${stats.newCount ? `${stats.newCount} new cards will be introduced. ` : ''}A session contains at most ${MAX_REVIEWS} cards and no more than ${MAX_NEW} new cards.</p>
        <button class="primary-button" data-srs-start ${stats.queueCount ? '' : 'disabled'}>${stats.queueCount ? 'Start review' : 'Review complete for today'}</button>
      </section>

      <section class="card srs-dashboard-card">
        <h3>Coverage</h3>
        <p>${stats.conceptCount} test cards are available across script recognition and two-way word recall.</p>
        <p class="small-note">Ramprasad words marked pending are kept in the reading library but excluded from exact-meaning tests until their English and Tamil meanings are reviewed.</p>
      </section>`;
    app.focus({ preventScroll: true });
  }

  function startSession() {
    const queue = queueForToday();
    session = {
      cards: queue.map(card => card.id),
      index: 0,
      selected: '',
      revealed: false,
      currentCorrect: false,
      correct: 0,
      incorrect: 0,
      startedAt: new Date().toISOString()
    };
    renderSession();
  }

  function currentCard() {
    return session ? conceptMap.get(session.cards[session.index]) : null;
  }

  function renderSession() {
    setReviewNavActive();
    const card = currentCard();
    if (!card) {
      finishSession();
      return;
    }
    const question = engine.createQuestion(card, concepts);
    const progress = Math.round((session.index / session.cards.length) * 100);
    const record = store.records[card.id];
    const stateLabel = record ? `${record.state} · ${record.intervalDays || 0}d interval` : 'new card';

    app.innerHTML = `
      <section class="srs-session-head">
        <div><p class="kicker">Card ${session.index + 1} of ${session.cards.length}</p><h2>Daily review</h2></div>
        <button class="secondary-button" data-srs-exit>Exit</button>
      </section>
      <div class="progress-bar srs-progress"><div class="progress-fill" style="width:${progress}%"></div></div>

      <article class="card srs-question-card">
        <div class="card-top"><span class="badge">${escapeHtml(card.group)}</span><span class="small-note">${escapeHtml(stateLabel)}</span></div>
        <h2 class="srs-prompt ${question.promptClass === 'bengali' ? 'bengali-lg' : ''}">${escapeHtml(question.prompt)}</h2>
        <div class="quiz-options srs-options">
          ${question.options.map(option => {
            const selected = session.selected === option;
            const isCorrect = session.revealed && option === question.answer;
            const isWrong = session.revealed && selected && option !== question.answer;
            return `<button class="quiz-option ${selected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}" data-srs-option="${escapeHtml(option)}" ${session.revealed ? 'disabled' : ''}>${escapeHtml(option)}</button>`;
          }).join('')}
        </div>
        ${session.revealed ? `
          <div class="srs-feedback ${session.currentCorrect ? 'correct' : 'wrong'}">
            <strong>${session.currentCorrect ? 'Correct' : 'Review this once more'}</strong>
            <p>${escapeHtml(question.explanation)}</p>
          </div>
          <div class="srs-ratings" aria-label="Rate recall">
            <button data-srs-rate="again"><strong>Again</strong><small>Today</small></button>
            <button data-srs-rate="hard"><strong>Hard</strong><small>1+ day</small></button>
            <button data-srs-rate="good"><strong>Good</strong><small>Normal</small></button>
            <button data-srs-rate="easy"><strong>Easy</strong><small>Longer</small></button>
          </div>` : '<p class="small-note srs-hint">Choose an answer to reveal the result and scheduling choices.</p>'}
      </article>`;
    app.focus({ preventScroll: true });
  }

  function chooseAnswer(answer) {
    if (!session || session.revealed) return;
    const card = currentCard();
    const question = engine.createQuestion(card, concepts);
    session.selected = answer;
    session.revealed = true;
    session.currentCorrect = answer === question.answer;
    renderSession();
  }

  function rateCurrent(rating) {
    if (!session || !session.revealed) return;
    const card = currentCard();
    const today = engine.localIso();
    let record = store.records[card.id] || engine.defaultRecord(card.id, today);
    record = engine.recordAnswer(record, session.currentCorrect);
    store.records[card.id] = engine.schedule(record, rating, today);

    if (session.currentCorrect) session.correct += 1;
    else session.incorrect += 1;

    if (rating === engine.RATINGS.again && session.cards.length < MAX_REVIEWS + 5) {
      const remaining = session.cards.slice(session.index + 1);
      if (!remaining.includes(card.id)) session.cards.push(card.id);
    }

    session.index += 1;
    session.selected = '';
    session.revealed = false;
    session.currentCorrect = false;
    saveStore();
    renderSession();
  }

  function finishSession() {
    const completed = session || { correct: 0, incorrect: 0, startedAt: new Date().toISOString() };
    const total = completed.correct + completed.incorrect;
    store.sessions = [...store.sessions.slice(-29), {
      date: engine.localIso(),
      correct: completed.correct,
      incorrect: completed.incorrect,
      startedAt: completed.startedAt,
      completedAt: new Date().toISOString()
    }];
    saveStore();
    session = null;
    const stats = summary();
    app.innerHTML = `
      <section class="hero srs-hero"><p class="kicker">Session complete</p><h2>সাধনা সম্পূর্ণ</h2><p>Your next intervals have been updated on this device.</p></section>
      <section class="card quiz-result srs-finish">
        <p class="bengali-lg">${completed.correct}/${total || 0}</p>
        <p>${total && completed.correct / total >= 0.8 ? 'Strong recall.' : 'The difficult cards will return sooner.'}</p>
        <div class="action-row"><button class="primary-button" data-srs-dashboard>Review dashboard</button>${stats.queueCount ? '<button class="secondary-button" data-srs-start>Continue due cards</button>' : ''}</div>
      </section>`;
  }

  function injectTodayPanel() {
    if (!app || document.querySelector('.nav-button.active')?.dataset.view === 'review') return;
    const hero = app.querySelector(':scope > .hero');
    if (!hero || app.querySelector('.srs-today-panel')) return;
    const stats = summary();
    const panel = document.createElement('section');
    panel.className = 'card srs-today-panel';
    panel.innerHTML = `
      <div><span class="badge">Spaced repetition</span><h2>${stats.queueCount} review card${stats.queueCount === 1 ? '' : 's'} ready</h2><p class="small-note">${stats.newCount} new · ${stats.reviewedToday} reviewed today · ${stats.accuracy}% accuracy</p></div>
      <button class="primary-button" data-srs-start ${stats.queueCount ? '' : 'disabled'}>${stats.queueCount ? 'Start review' : 'Done for today'}</button>`;
    hero.insertAdjacentElement('afterend', panel);
  }

  document.addEventListener('click', event => {
    const reviewNav = event.target.closest('.nav-button[data-view="review"]');
    if (reviewNav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderDashboard();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const start = event.target.closest('[data-srs-start]');
    if (start) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startSession();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const option = event.target.closest('[data-srs-option]');
    if (option) {
      event.preventDefault();
      event.stopImmediatePropagation();
      chooseAnswer(option.dataset.srsOption);
      return;
    }

    const rating = event.target.closest('[data-srs-rate]');
    if (rating) {
      event.preventDefault();
      event.stopImmediatePropagation();
      rateCurrent(rating.dataset.srsRate);
      return;
    }

    if (event.target.closest('[data-srs-dashboard]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderDashboard();
      return;
    }

    if (event.target.closest('[data-srs-exit]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      renderDashboard();
      return;
    }

    const ordinaryNav = event.target.closest('.nav-button:not([data-view="review"])');
    if (ordinaryNav) queueMicrotask(injectTodayPanel);
  }, true);

  const observer = new MutationObserver(() => queueMicrotask(injectTodayPanel));
  observer.observe(app, { childList: true });
  window.addEventListener('load', injectTodayPanel);

  window.BENGALI_SRS = { renderDashboard, startSession, summary, concepts: () => concepts.slice() };
})();
