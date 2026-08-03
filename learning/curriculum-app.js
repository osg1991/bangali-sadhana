(() => {
  'use strict';

  const curriculum = window.BENGALI_CURRICULUM || { units: [] };
  const app = document.getElementById('app');
  const nav = document.querySelector('.bottom-nav');
  if (!app || !nav || !curriculum.units?.length) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function srsRecords() {
    try {
      return JSON.parse(localStorage.getItem('bengali-sadhana-srs-v1'))?.records || {};
    } catch {
      return {};
    }
  }

  function foundationProgress() {
    const track = window.BENGALI_LEARNING_TRACK;
    const concepts = window.BENGALI_SRS?.concepts?.() || [];
    if (!track?.progress || !concepts.length) return { wordsUnlocked: false, activeStage: 'vowels', stages: {} };
    return track.progress(concepts, srsRecords());
  }

  function speakButton(text) {
    return `<button class="speak-button" data-speak="${escapeHtml(text)}">Hear</button>`;
  }

  function expressionCard(item, badge) {
    return `<article class="card compact curriculum-expression">
      <div class="card-top"><span class="badge">${escapeHtml(badge)}</span>${speakButton(item.bengali)}</div>
      <p class="bengali-lg">${escapeHtml(item.bengali)}</p>
      <p class="bridge"><strong>Roman:</strong> ${escapeHtml(item.roman)}</p>
      ${item.literalGloss ? `<p class="small-note"><strong>Literal:</strong> ${escapeHtml(item.literalGloss)}</p>` : ''}
      <p class="meaning"><strong>English:</strong> ${escapeHtml(item.english)}</p>
      ${item.tamil ? `<p class="meaning tamil-meaning"><strong>Tamil:</strong> ${escapeHtml(item.tamil)}</p>` : ''}
    </article>`;
  }

  function vocabularyTable(words) {
    return `<div class="curriculum-table-wrap"><table class="curriculum-table">
      <thead><tr><th>বাংলা</th><th>Roman</th><th>English</th><th>Tamil</th></tr></thead>
      <tbody>${words.map(word => `<tr><td class="bengali-md">${escapeHtml(word.bengali)}</td><td>${escapeHtml(word.roman)}</td><td>${escapeHtml(word.english)}</td><td>${escapeHtml(word.tamil)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function numberTable(numbers) {
    return `<div class="curriculum-table-wrap"><table class="curriculum-table">
      <thead><tr><th>বাংলা</th><th>Roman</th><th>Value</th><th>English</th><th>Tamil</th></tr></thead>
      <tbody>${numbers.map(item => `<tr><td class="bengali-md">${escapeHtml(item.bengali)}</td><td>${escapeHtml(item.roman)}</td><td>${Number(item.numericValue).toLocaleString('en-IN')}</td><td>${escapeHtml(item.english)}</td><td>${escapeHtml(item.tamil)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  function dialogueCard(dialogue) {
    return `<article class="card curriculum-dialogue"><span class="badge">Mini-dialogue</span><h3>${escapeHtml(dialogue.title)}</h3>
      <div class="dialogue-turns">${dialogue.turns.map(turn => `<div class="dialogue-turn">
        <div class="dialogue-speaker">${escapeHtml(turn.speaker)}</div>
        <div><div class="card-top"><p class="bengali-md">${escapeHtml(turn.bengali)}</p>${speakButton(turn.bengali)}</div>
        <p class="bridge">${escapeHtml(turn.roman)}</p><p class="meaning">${escapeHtml(turn.english)}</p>${turn.tamil ? `<p class="meaning tamil-meaning">${escapeHtml(turn.tamil)}</p>` : ''}</div>
      </div>`).join('')}</div></article>`;
  }

  function renderLocked(progress) {
    const active = progress.activeStage || 'vowels';
    const labels = { vowels: 'vowels', consonants: 'consonants', mixed: 'mixed alphabet recognition' };
    app.innerHTML = `<section class="hero curriculum-hero"><p class="kicker">Topic curriculum</p><h2>பாடங்கள் · বিষয়ভিত্তিক পাঠ</h2>
      <p>Weekly vocabulary, functional language, number expressions, situation patterns and dialogues will open after the alphabet foundation is mastered.</p></section>
      <section class="card curriculum-lock"><span class="badge">Locked by learning track</span><h2>Complete ${escapeHtml(labels[active] || active)} first</h2>
      <p>The topic course follows the same strict sequence: vowels → consonants → mixed alphabets → words and situations.</p>
      <button class="primary-button" data-curriculum-review>Continue foundation review</button></section>`;
  }

  function renderUnit(unit) {
    const functionalGroups = new Map();
    for (const item of unit.functionalLanguage || []) {
      if (!functionalGroups.has(item.function)) functionalGroups.set(item.function, []);
      functionalGroups.get(item.function).push(item);
    }

    app.innerHTML = `<section class="hero curriculum-hero"><p class="kicker">${escapeHtml(unit.level)} · Week ${escapeHtml(unit.week)} of 25</p>
      <h2>${escapeHtml(unit.topic)}</h2><p>Vocabulary, useful expressions, large numbers, situation patterns and connected mini-dialogues.</p>
      <div class="sync-summary"><span>${unit.vocabulary.length} vocabulary items</span><span>${unit.functionalLanguage.length} functional expressions</span><span>${unit.situationPatterns.length} patterns</span><span>${unit.dialogues.length} dialogues</span></div>
      <button class="primary-button" data-curriculum-review>Practise this topic in Review</button></section>

      <div class="section-heading"><div><h2>Vocabulary</h2><p>Common adjectives with English and Tamil meanings.</p></div></div>
      ${vocabularyTable(unit.vocabulary)}

      <div class="section-heading"><div><h2>Numbers</h2><p>Read large Bengali number expressions in the Indian numbering system.</p></div></div>
      ${numberTable(unit.numbers)}

      <div class="section-heading"><div><h2>Functional language</h2><p>Learn the communicative purpose and register, not only the literal meaning.</p></div></div>
      ${[...functionalGroups.entries()].map(([name, items]) => `<section class="curriculum-subsection"><h3>${escapeHtml(name)}</h3><div class="card-grid two">${items.map(item => expressionCard(item, item.register)).join('')}</div></section>`).join('')}

      <div class="section-heading"><div><h2>Situation patterns</h2><p>Complete sentences showing the adjectives in natural contexts.</p></div></div>
      <section class="card-grid two">${unit.situationPatterns.map(item => expressionCard(item, item.register)).join('')}</section>

      <div class="section-heading"><div><h2>Mini-dialogues</h2><p>Review each line in context and practise the next response.</p></div></div>
      <section class="card-grid">${unit.dialogues.map(dialogueCard).join('')}</section>`;
    app.focus({ preventScroll: true });
  }

  function renderTopics() {
    document.querySelectorAll('.nav-button').forEach(button => button.classList.toggle('active', button.dataset.view === 'topics'));
    const progress = foundationProgress();
    if (!progress.wordsUnlocked) renderLocked(progress);
    else renderUnit(curriculum.units[0]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const button = document.createElement('button');
  button.className = 'nav-button';
  button.dataset.view = 'topics';
  button.innerHTML = '<span>বিষয়</span><small>Topics</small>';
  const wordsButton = nav.querySelector('[data-view="words"]');
  nav.insertBefore(button, wordsButton || null);

  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    renderTopics();
  });

  document.querySelectorAll('.nav-button:not([data-view="topics"])').forEach(other => {
    other.addEventListener('click', () => button.classList.remove('active'));
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-curriculum-review]')) return;
    event.preventDefault();
    document.querySelector('.nav-button[data-view="review"]')?.click();
  });

  window.BENGALI_CURRICULUM_APP = { renderTopics, foundationProgress };
})();
