import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../learning/srs-engine.js');
const track = require('../learning/track-engine.js');
track.install(engine);

const base = {
  script: [
    { group: 'Vowels', bengali: 'অ', roman: 'ô' },
    { group: 'Vowels', bengali: 'আ', roman: 'ā' },
    { group: 'Consonants', bengali: 'ক', roman: 'ka' },
    { group: 'Consonants', bengali: 'খ', roman: 'kha' },
    { group: 'Vowel signs', bengali: 'া', roman: 'ā' }
  ],
  words: [{ category: 'Daily', bengali: 'জল', meaning: 'water' }]
};

function masteredRecord(card, stage) {
  return {
    cardId: card.id,
    state: 'review',
    due: '2026-08-20',
    intervalDays: 3,
    ease: 2.5,
    repetitions: stage === 'mixed' ? 1 : 2,
    correct: stage === 'mixed' ? 1 : 2,
    incorrect: 0,
    lastRating: 'good',
    lastReviewed: '2026-08-01'
  };
}

test('concepts are ordered into vowels, consonants, mixed, words and advanced script', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  assert.deepEqual(concepts.map(card => card.trackStage), [
    'vowels', 'vowels', 'consonants', 'consonants',
    'mixed', 'mixed', 'mixed', 'mixed',
    'words', 'words', 'advanced'
  ]);
});

test('only vowel cards are introduced at the beginning', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  const queue = engine.buildQueue(concepts, {}, { today: '2026-08-01', maxReviews: 20, maxNew: 20 });
  assert.ok(queue.length > 0);
  assert.ok(queue.every(card => card.trackStage === 'vowels'));
});

test('consonants unlock only when every vowel is mastered', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  const records = {};
  for (const card of concepts.filter(item => item.trackStage === 'vowels')) records[card.id] = masteredRecord(card, 'vowels');
  const progress = track.progress(concepts, records);
  assert.equal(progress.activeStage, 'consonants');
  const queue = engine.buildQueue(concepts, records, { today: '2026-08-01', maxReviews: 20, maxNew: 20 });
  assert.ok(queue.some(card => card.trackStage === 'consonants'));
  assert.ok(queue.every(card => ['vowels', 'consonants'].includes(card.trackStage)));
});

test('mixed cards unlock after consonants and require Good or Easy recall', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  const records = {};
  for (const card of concepts.filter(item => ['vowels', 'consonants'].includes(item.trackStage))) {
    records[card.id] = masteredRecord(card, card.trackStage);
  }
  assert.equal(track.progress(concepts, records).activeStage, 'mixed');
  const mixed = concepts.find(card => card.trackStage === 'mixed');
  const again = { ...masteredRecord(mixed, 'mixed'), lastRating: 'again' };
  assert.equal(track.cardMastered(mixed, again), false);
  assert.equal(track.cardMastered(mixed, masteredRecord(mixed, 'mixed')), true);
});

test('word cards remain locked until all mixed cards are mastered', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  const records = {};
  for (const card of concepts.filter(item => ['vowels', 'consonants'].includes(item.trackStage))) {
    records[card.id] = masteredRecord(card, card.trackStage);
  }
  const partialMixed = concepts.filter(item => item.trackStage === 'mixed').slice(0, -1);
  for (const card of partialMixed) records[card.id] = masteredRecord(card, 'mixed');
  assert.equal(track.progress(concepts, records).wordsUnlocked, false);
  const queue = engine.buildQueue(concepts, records, { today: '2026-08-01', maxReviews: 30, maxNew: 30 });
  assert.equal(queue.some(card => card.kind === 'word'), false);
});

test('words unlock after vowels consonants and mixed alphabets are mastered', () => {
  const concepts = engine.buildConcepts(base, { words: [] });
  const records = {};
  for (const card of concepts.filter(item => ['vowels', 'consonants', 'mixed'].includes(item.trackStage))) {
    records[card.id] = masteredRecord(card, card.trackStage);
  }
  const progress = track.progress(concepts, records);
  assert.equal(progress.wordsUnlocked, true);
  const queue = engine.buildQueue(concepts, records, { today: '2026-08-01', maxReviews: 30, maxNew: 30 });
  assert.ok(queue.some(card => card.kind === 'word'));
});
