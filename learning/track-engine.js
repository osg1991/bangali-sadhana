(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BENGALI_LEARNING_TRACK = api;
  if (root.BENGALI_SRS_ENGINE) api.install(root.BENGALI_SRS_ENGINE);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STAGES = Object.freeze({
    vowels: 'vowels',
    consonants: 'consonants',
    mixed: 'mixed',
    words: 'words',
    advanced: 'advanced'
  });
  const REQUIRED_STAGES = [STAGES.vowels, STAGES.consonants, STAGES.mixed];
  const EXTRA_CONSONANTS = new Set(['ড়', 'ঢ়', 'য়', 'ৎ']);

  function normalise(value) {
    return String(value || '').normalize('NFC').trim();
  }

  function localIso(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function dueDate(record) {
    const value = normalise(record?.due).slice(0, 10);
    return value || '9999-12-31';
  }

  function classifyScript(card) {
    const group = normalise(card.group).toLowerCase();
    const bengali = normalise(card.bengali);
    if (group === 'vowels' || group === 'rare sanskrit vowels') return STAGES.vowels;
    if (group === 'consonants' || EXTRA_CONSONANTS.has(bengali)) return STAGES.consonants;
    return STAGES.advanced;
  }

  function stageForConcept(card) {
    if (card.trackStage) return card.trackStage;
    if (card.kind === 'word' || normalise(card.id).startsWith('word:')) return STAGES.words;
    if (card.kind === 'script' || normalise(card.id).startsWith('script:')) return classifyScript(card);
    return STAGES.advanced;
  }

  function mixedCard(card) {
    return {
      ...card,
      id: `mixed:${normalise(card.bengali)}:sound`,
      conceptId: `mixed:${normalise(card.bengali)}`,
      group: 'Mixed alphabets',
      trackStage: STAGES.mixed,
      sourceStage: card.trackStage,
      mixedPractice: true
    };
  }

  function enrichConcepts(concepts) {
    const vowels = [];
    const consonants = [];
    const words = [];
    const advanced = [];

    for (const concept of concepts) {
      const trackStage = stageForConcept(concept);
      const enriched = { ...concept, trackStage };
      if (trackStage === STAGES.vowels) vowels.push(enriched);
      else if (trackStage === STAGES.consonants) consonants.push(enriched);
      else if (trackStage === STAGES.words) words.push(enriched);
      else advanced.push(enriched);
    }

    const mixed = [...vowels, ...consonants].map(mixedCard);
    return [...vowels, ...consonants, ...mixed, ...words, ...advanced];
  }

  function cardMastered(card, record) {
    if (!record) return false;
    const correct = Number(record.correct) || 0;
    const incorrect = Number(record.incorrect) || 0;
    const total = correct + incorrect;
    const accuracy = total ? correct / total : 0;
    if (card.trackStage === STAGES.mixed) {
      return correct >= 1 && accuracy >= 0.75 && ['good', 'easy'].includes(record.lastRating);
    }
    return Number(record.repetitions) >= 2 && correct >= 2 && accuracy >= 0.75 && record.lastRating !== 'again';
  }

  function stageStats(concepts, records, stage) {
    const cards = concepts.filter(card => card.trackStage === stage);
    const mastered = cards.filter(card => cardMastered(card, records[card.id])).length;
    return {
      stage,
      total: cards.length,
      mastered,
      complete: cards.length > 0 && mastered === cards.length,
      percent: cards.length ? Math.round((mastered / cards.length) * 100) : 0
    };
  }

  function progress(concepts, records = {}) {
    const stages = {
      vowels: stageStats(concepts, records, STAGES.vowels),
      consonants: stageStats(concepts, records, STAGES.consonants),
      mixed: stageStats(concepts, records, STAGES.mixed)
    };
    const activeStage = REQUIRED_STAGES.find(stage => !stages[stage].complete) || STAGES.words;
    return {
      stages,
      activeStage,
      wordsUnlocked: activeStage === STAGES.words,
      completedStages: REQUIRED_STAGES.filter(stage => stages[stage].complete)
    };
  }

  function allowedConcepts(concepts, records = {}) {
    const current = progress(concepts, records);
    if (current.wordsUnlocked) return concepts;
    const activeIndex = REQUIRED_STAGES.indexOf(current.activeStage);
    const allowedStages = new Set(REQUIRED_STAGES.slice(0, activeIndex + 1));
    return concepts.filter(card => allowedStages.has(card.trackStage));
  }

  function orderedQueueConcepts(concepts, records = {}) {
    const allowed = allowedConcepts(concepts, records);
    const current = progress(concepts, records);
    if (!current.wordsUnlocked) return allowed;

    const words = allowed.filter(card => card.trackStage === STAGES.words);
    const advanced = allowed.filter(card => card.trackStage === STAGES.advanced);
    const foundation = allowed.filter(card => REQUIRED_STAGES.includes(card.trackStage));
    return [...words, ...advanced, ...foundation];
  }

  function buildTrackedQueue(concepts, records = {}, options = {}) {
    const today = options.today || localIso();
    const maxReviews = options.maxReviews ?? 20;
    const maxNew = options.maxNew ?? 5;
    const ordered = orderedQueueConcepts(concepts, records);
    const order = new Map(ordered.map((card, index) => [card.id, index]));

    const due = ordered
      .filter(card => records[card.id] && dueDate(records[card.id]) <= today)
      .sort((left, right) => {
        const dateOrder = dueDate(records[left.id]).localeCompare(dueDate(records[right.id]));
        return dateOrder || (order.get(left.id) - order.get(right.id));
      });

    const dueIds = new Set(due.map(card => card.id));
    const newCards = ordered
      .filter(card => !records[card.id] && !dueIds.has(card.id))
      .slice(0, maxNew);

    return [...due, ...newCards].slice(0, maxReviews);
  }

  function install(engine) {
    if (!engine || engine.__learningTrackInstalled) return engine;
    const originalBuildConcepts = engine.buildConcepts.bind(engine);

    engine.buildConcepts = function buildTrackedConcepts(baseContent, ramprasadContent) {
      return enrichConcepts(originalBuildConcepts(baseContent, ramprasadContent));
    };
    engine.buildQueue = buildTrackedQueue;
    engine.learningProgress = progress;
    engine.learningCardMastered = cardMastered;
    engine.learningAllowedConcepts = allowedConcepts;
    engine.learningOrderedConcepts = orderedQueueConcepts;
    engine.__learningTrackInstalled = true;
    return engine;
  }

  return {
    STAGES,
    REQUIRED_STAGES,
    classifyScript,
    stageForConcept,
    enrichConcepts,
    cardMastered,
    stageStats,
    progress,
    allowedConcepts,
    orderedQueueConcepts,
    buildTrackedQueue,
    install
  };
});
