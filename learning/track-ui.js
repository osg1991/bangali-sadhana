(() => {
  'use strict';

  const engine = window.BENGALI_SRS_ENGINE;
  const track = window.BENGALI_LEARNING_TRACK;
  const app = document.getElementById('app');
  if (!engine || !track || !app) return;

  const STORAGE_KEY = 'bengali-sadhana-srs-v1';
  const LOCKED_VIEWS = new Set(['words', 'sentences', 'songs']);
  const labels = {
    vowels: ['1', 'Vowels', 'Learn and retain every Bengali vowel.'],
    consonants: ['2', 'Consonants', 'Unlock after all vowels are mastered.'],
    mixed: ['3', 'Mixed alphabets', 'Recognise vowels and consonants in a shuffled mixed test.'],
    words: ['4', 'Words', 'Practical words and Ramprasad vocabulary unlock here.']
  };

  let observer = null;
  let refreshQueued = false;
  let refreshing = false;

  function records() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY))?.records || {};
    } catch {
      return {};
    }
  }

  function concepts() {
    return engine.buildConcepts(window.BENGALI_BASE_CONTENT || {}, window.RAMPRASAD_CONTENT || {});
  }

  function currentProgress() {
    return track.progress(concepts(), records());
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function stageCard(stage, progress) {
    const [number, title, description] = labels[stage];
    const stat = progress.stages[stage];
    const complete = stat?.complete;
    const active = progress.activeStage === stage;
    const locked = stage === 'words' ? !progress.wordsUnlocked : !complete && !active;
    const percent = stage === 'words' ? (progress.wordsUnlocked ? 100 : 0) : stat?.percent || 0;
    return `
      <article class="track-stage ${complete || stage === 'words' && progress.wordsUnlocked ? 'complete' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''}">
        <span class="track-stage-number">${number}</span>
        <div class="track-stage-copy">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(description)}</small>
          <div class="track-progress"><span style="width:${percent}%"></span></div>
          <small>${stage === 'words' ? (progress.wordsUnlocked ? 'Unlocked' : 'Locked') : `${stat.mastered}/${stat.total} mastered`}</small>
        </div>
        <span class="track-state">${complete || stage === 'words' && progress.wordsUnlocked ? '✓' : active ? 'Now' : '🔒'}</span>
      </article>`;
  }

  function panelMarkup(progress, compact = false) {
    return `
      <section class="card learning-track-panel ${compact ? 'compact' : ''}" data-learning-track-panel>
        <div class="track-heading">
          <div><span class="badge">Learning track</span><h2>অক্ষর আগে · Script first</h2></div>
          <span class="track-active-label">${progress.wordsUnlocked ? 'Words unlocked' : `${labels[progress.activeStage][1]} in progress`}</span>
        </div>
        <p class="small-note">Words, sentences and songs remain locked until vowels, consonants and mixed-alphabet recall are mastered through SRS.</p>
        <div class="track-stages">
          ${stageCard('vowels', progress)}
          ${stageCard('consonants', progress)}
          ${stageCard('mixed', progress)}
          ${stageCard('words', progress)}
        </div>
      </section>`;
  }

  function progressSignature(progress) {
    return [
      progress.activeStage,
      progress.wordsUnlocked ? 1 : 0,
      ...['vowels', 'consonants', 'mixed'].flatMap(stage => {
        const stat = progress.stages[stage] || {};
        return [stat.mastered || 0, stat.total || 0, stat.complete ? 1 : 0];
      })
    ].join(':');
  }

  function elementFromMarkup(markup) {
    const container = document.createElement('div');
    container.innerHTML = markup.trim();
    return container.firstElementChild;
  }

  function updateNavigation(progress) {
    document.querySelectorAll('.nav-button').forEach(button => {
      const locked = !progress.wordsUnlocked && LOCKED_VIEWS.has(button.dataset.view);
      button.classList.toggle('track-locked', locked);
      button.setAttribute('aria-disabled', locked ? 'true' : 'false');
      button.title = locked ? 'Complete the alphabet track first' : '';
    });
  }

  function restoreTodayContent() {
    app.querySelectorAll('.track-hidden').forEach(element => {
      element.hidden = false;
      element.classList.remove('track-hidden');
    });
    app.querySelector('[data-track-lock-message]')?.remove();
  }

  function gateToday(progress) {
    const activeView = document.querySelector('.nav-button.active')?.dataset.view;
    if (activeView !== 'today') return;
    if (progress.wordsUnlocked) {
      restoreTodayContent();
      return;
    }

    const directChildren = [...app.children];
    const start = directChildren.findIndex(element => {
      if (!element.classList.contains('section-heading')) return false;
      const heading = element.querySelector('h2')?.textContent || '';
      return /^2\./.test(heading.trim()) || /Useful words/i.test(heading);
    });
    if (start < 0) return;

    for (const element of directChildren.slice(start)) {
      if (!element.hidden) element.hidden = true;
      if (!element.classList.contains('track-hidden')) element.classList.add('track-hidden');
    }

    const signature = `${progress.activeStage}:${progress.wordsUnlocked ? 1 : 0}`;
    const existing = app.querySelector('[data-track-lock-message]');
    if (existing?.dataset.trackLockSignature === signature) return;

    const lock = elementFromMarkup(`
      <section class="card track-lock-message" data-track-lock-message>
        <span class="badge">Next content locked</span>
        <h2>Master ${escapeHtml(labels[progress.activeStage][1])} first</h2>
        <p>Continue in <strong>পুনরাবৃত্তি · Review</strong>. Words, sentences and Ramprasad songs will appear here automatically when the alphabet foundation is complete.</p>
        <button class="primary-button" data-track-open-review>Open today’s alphabet review</button>
      </section>`);
    lock.dataset.trackLockSignature = signature;

    if (existing) existing.replaceWith(lock);
    else directChildren[start].insertAdjacentElement('beforebegin', lock);
  }

  function injectPanels(progress) {
    const activeView = document.querySelector('.nav-button.active')?.dataset.view;
    const existing = app.querySelector('[data-learning-track-panel]');

    if (activeView !== 'today' && activeView !== 'review') {
      existing?.remove();
      return;
    }

    const hero = app.querySelector(':scope > .hero');
    if (!hero) return;

    const signature = `${activeView}:${progressSignature(progress)}`;
    if (existing?.dataset.trackPanelSignature === signature) return;

    const panel = elementFromMarkup(panelMarkup(progress, activeView === 'today'));
    panel.dataset.trackPanelSignature = signature;
    if (existing) existing.replaceWith(panel);
    else hero.insertAdjacentElement('afterend', panel);
  }

  function refresh() {
    if (refreshing) return;
    refreshing = true;
    observer?.disconnect();
    try {
      const progress = currentProgress();
      updateNavigation(progress);
      injectPanels(progress);
      gateToday(progress);
    } finally {
      observer?.observe(app, { childList: true });
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      refresh();
    });
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('.nav-button');
    const progress = currentProgress();
    if (nav && !progress.wordsUnlocked && LOCKED_VIEWS.has(nav.dataset.view)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showToast(`Complete ${labels[progress.activeStage][1]} before opening ${nav.dataset.view}.`);
      return;
    }
    if (event.target.closest('[data-track-open-review]')) {
      event.preventDefault();
      document.querySelector('.nav-button[data-view="review"]')?.click();
    }
  }, true);

  observer = new MutationObserver(scheduleRefresh);
  observer.observe(app, { childList: true });
  window.addEventListener('storage', scheduleRefresh);
  window.addEventListener('load', scheduleRefresh);
  scheduleRefresh();

  window.BENGALI_TRACK_UI = { refresh: scheduleRefresh };
})();
