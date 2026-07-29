(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BENGALI_SRS_ENGINE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RATINGS = Object.freeze({ again: 'again', hard: 'hard', good: 'good', easy: 'easy' });

  function localIso(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function addDays(isoDate, days) {
    const date = new Date(`${isoDate}T12:00:00`);
    date.setDate(date.getDate() + days);
    return localIso(date);
  }

  function normalise(value) {
    return String(value || '').normalize('NFC').trim();
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function uniqueBy(items, selector) {
    const seen = new Set();
    return items.filter(item => {
      const key = selector(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isReviewedLyricWord(word) {
    const status = String(word.reviewStatus || word.status || '').toLowerCase();
    const meaning = normalise(word.englishMeaning || word.meaning);
    if (status === 'pending' || status === 'unreviewed') return false;
    if (!meaning || /pending|unmapped|context only/i.test(meaning)) return false;
    return true;
  }

  function buildConcepts(baseContent = {}, ramprasadContent = {}) {
    const script = uniqueBy(baseContent.script || [], item => normalise(item.bengali)).map(item => ({
      id: `script:${normalise(item.bengali)}:sound`,
      conceptId: `script:${normalise(item.bengali)}`,
      kind: 'script',
      direction: 'bn-sound',
      bengali: normalise(item.bengali),
      answer: normalise(item.roman),
      group: normalise(item.group) || 'Script',
      example: normalise(item.example),
      exampleMeaning: normalise(item.meaning),
      source: item
    })).filter(item => item.bengali && item.answer);

    const practicalWords = (baseContent.words || []).map(item => ({ ...item, sourceKind: 'practical' }));
    const lyricWords = (ramprasadContent.words || [])
      .filter(isReviewedLyricWord)
      .map(item => ({ ...item, sourceKind: 'lyric' }));
    const words = uniqueBy([...practicalWords, ...lyricWords], item => normalise(item.bengali));

    const wordCards = words.flatMap(item => {
      const bengali = normalise(item.bengali);
      const meaning = normalise(item.englishMeaning || item.meaning);
      if (!bengali || !meaning) return [];
      const common = {
        conceptId: `word:${bengali}`,
        kind: 'word',
        bengali,
        meaning,
        group: normalise(item.category) || (item.sourceKind === 'lyric' ? 'Ramprasadi vocabulary' : 'Words'),
        tamilMeaning: normalise(item.tamilMeaning),
        sourceKind: item.sourceKind,
        source: item
      };
      return [
        { ...common, id: `word:${bengali}:bn-en`, direction: 'bn-en', answer: meaning },
        { ...common, id: `word:${bengali}:en-bn`, direction: 'en-bn', answer: bengali }
      ];
    });

    return interleave([script, wordCards.filter(card => card.direction === 'bn-en'), wordCards.filter(card => card.direction === 'en-bn')]);
  }

  function interleave(groups) {
    const result = [];
    const maxLength = Math.max(0, ...groups.map(group => group.length));
    for (let index = 0; index < maxLength; index += 1) {
      for (const group of groups) if (group[index]) result.push(group[index]);
    }
    return result;
  }

  function defaultRecord(cardId, today = localIso()) {
    return { cardId, state: 'new', due: today, intervalDays: 0, ease: 2.5, repetitions: 0, lapses: 0, correct: 0, incorrect: 0, lastReviewed: '', lastRating: '' };
  }

  function schedule(record, rating, today = localIso()) {
    const current = { ...defaultRecord(record.cardId, today), ...record };
    let intervalDays = Number(current.intervalDays) || 0;
    let ease = Number(current.ease) || 2.5;
    let repetitions = Number(current.repetitions) || 0;
    let lapses = Number(current.lapses) || 0;
    let state = current.state || 'new';

    if (rating === RATINGS.again) {
      intervalDays = 0; ease = Math.max(1.3, ease - 0.2); repetitions = 0; lapses += 1; state = 'learning';
    } else if (rating === RATINGS.hard) {
      intervalDays = repetitions === 0 ? 1 : Math.max(1, Math.round(Math.max(1, intervalDays) * 1.2));
      ease = Math.max(1.3, ease - 0.15); repetitions += 1; state = intervalDays >= 21 ? 'mature' : 'learning';
    } else if (rating === RATINGS.easy) {
      intervalDays = repetitions === 0 ? 4 : Math.max(4, Math.round(Math.max(1, intervalDays) * (ease + 0.3)));
      ease = Math.min(3.2, ease + 0.15); repetitions += 1; state = intervalDays >= 21 ? 'mature' : 'review';
    } else {
      intervalDays = repetitions === 0 ? 1 : repetitions === 1 ? 3 : Math.max(3, Math.round(Math.max(1, intervalDays) * ease));
      repetitions += 1; state = intervalDays >= 21 ? 'mature' : 'review';
    }

    return { ...current, state, intervalDays, ease: Number(ease.toFixed(2)), repetitions, lapses, due: addDays(today, intervalDays), lastReviewed: today, lastRating: rating };
  }

  function buildQueue(concepts, records = {}, options = {}) {
    const today = options.today || localIso();
    const maxReviews = options.maxReviews ?? 20;
    const maxNew = options.maxNew ?? 5;
    const conceptMap = new Map(concepts.map(concept => [concept.id, concept]));
    const due = Object.values(records)
      .filter(record => conceptMap.has(record.cardId) && record.state !== 'new' && normalise(record.due) <= today)
      .sort((a, b) => String(a.due).localeCompare(String(b.due)) || (b.lapses || 0) - (a.lapses || 0))
      .map(record => conceptMap.get(record.cardId));
    const newCards = concepts.filter(concept => !records[concept.id]).slice(0, Math.min(maxNew, Math.max(0, maxReviews - due.length)));
    return [...due, ...newCards].slice(0, maxReviews);
  }

  function distractorsFor(card, concepts, count = 3) {
    const candidates = concepts
      .filter(candidate => candidate.id !== card.id && candidate.kind === card.kind && candidate.direction === card.direction)
      .filter(candidate => candidate.answer && candidate.answer !== card.answer);
    const sameGroup = candidates.filter(candidate => candidate.group === card.group);
    return uniqueBy([...sameGroup, ...candidates], candidate => candidate.answer)
      .sort((a, b) => stableHash(`${card.id}:${a.id}`) - stableHash(`${card.id}:${b.id}`))
      .slice(0, count)
      .map(candidate => candidate.answer);
  }

  function createQuestion(card, concepts) {
    const labels = {
      'bn-sound': `Which sound matches ${card.bengali}?`,
      'bn-en': `What does ${card.bengali} mean?`,
      'en-bn': `Which Bengali word means “${card.meaning}”?`
    };
    const options = uniqueBy([...distractorsFor(card, concepts), card.answer], value => value)
      .sort((a, b) => stableHash(`${card.id}:${a}`) - stableHash(`${card.id}:${b}`));
    return {
      cardId: card.id,
      conceptId: card.conceptId,
      kind: card.kind,
      direction: card.direction,
      prompt: labels[card.direction] || 'Choose the correct answer.',
      promptClass: card.direction === 'en-bn' ? '' : 'bengali',
      answer: card.answer,
      options,
      explanation: card.kind === 'script'
        ? `${card.bengali} is read as ${card.answer}${card.example ? `; example: ${card.example}${card.exampleMeaning ? ` — ${card.exampleMeaning}` : ''}` : ''}.`
        : `${card.bengali} means ${card.meaning}${card.tamilMeaning ? `; Tamil: ${card.tamilMeaning}` : ''}.`
    };
  }

  function summarise(records = {}, today = localIso()) {
    const values = Object.values(records);
    const reviewedToday = values.filter(record => record.lastReviewed === today).length;
    const due = values.filter(record => record.state !== 'new' && normalise(record.due) <= today).length;
    const mature = values.filter(record => record.state === 'mature' || (record.intervalDays || 0) >= 21).length;
    const correct = values.reduce((sum, record) => sum + (record.correct || 0), 0);
    const incorrect = values.reduce((sum, record) => sum + (record.incorrect || 0), 0);
    const totalAnswers = correct + incorrect;
    return { tracked: values.length, due, mature, reviewedToday, accuracy: totalAnswers ? Math.round((correct / totalAnswers) * 100) : 0 };
  }

  function recordAnswer(record, correct) {
    return { ...record, correct: (record.correct || 0) + (correct ? 1 : 0), incorrect: (record.incorrect || 0) + (correct ? 0 : 1) };
  }

  return { RATINGS, localIso, addDays, normalise, stableHash, isReviewedLyricWord, buildConcepts, defaultRecord, schedule, buildQueue, createQuestion, summarise, recordAnswer };
});
