import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../learning/srs-engine.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const engine = context.globalThis.BENGALI_SRS_ENGINE;

test('buildConcepts generates script and two word directions', () => {
  const concepts = engine.buildConcepts(
    { script: [{ bengali: 'ক', roman: 'ka', group: 'Consonants' }], words: [{ bengali: 'জল', meaning: 'Water', category: 'Daily' }] },
    { words: [] }
  );
  assert.deepEqual(Array.from(concepts, item => item.id), ['script:ক:sound', 'word:জল:bn-en', 'word:জল:en-bn']);
});

test('pending lyric meanings are excluded from exact meaning tests', () => {
  const concepts = engine.buildConcepts({}, { words: [
    { bengali: 'মা', englishMeaning: 'Mother', reviewStatus: 'reviewed' },
    { bengali: 'অজানা', englishMeaning: 'Meaning pending — source context only', reviewStatus: 'pending' }
  ] });
  assert.ok(concepts.some(item => item.conceptId === 'word:মা'));
  assert.ok(!concepts.some(item => item.conceptId === 'word:অজানা'));
});

test('new cards are limited and overdue cards come first', () => {
  const concepts = Array.from({ length: 10 }, (_, index) => ({ id: `c${index}` }));
  const records = { c8: { cardId: 'c8', state: 'review', due: '2026-07-28', lapses: 2 } };
  const queue = engine.buildQueue(concepts, records, { today: '2026-07-29', maxReviews: 6, maxNew: 5 });
  assert.equal(queue[0].id, 'c8');
  assert.equal(queue.length, 6);
});

test('Again keeps a card due today and increases lapses', () => {
  const result = engine.schedule(engine.defaultRecord('word:মা:bn-en', '2026-07-29'), 'again', '2026-07-29');
  assert.equal(result.due, '2026-07-29');
  assert.equal(result.lapses, 1);
  assert.equal(result.state, 'learning');
});

test('Good grows from one day to three days', () => {
  const first = engine.schedule(engine.defaultRecord('x', '2026-07-29'), 'good', '2026-07-29');
  const second = engine.schedule(first, 'good', '2026-07-30');
  assert.equal(first.intervalDays, 1);
  assert.equal(second.intervalDays, 3);
  assert.equal(second.due, '2026-08-02');
});

test('Easy creates a longer first interval', () => {
  const result = engine.schedule(engine.defaultRecord('x', '2026-07-29'), 'easy', '2026-07-29');
  assert.equal(result.intervalDays, 4);
  assert.equal(result.due, '2026-08-02');
});

test('question generation includes correct answer and unique options', () => {
  const concepts = engine.buildConcepts({ words: [
    { bengali: 'জল', meaning: 'Water' }, { bengali: 'মা', meaning: 'Mother' },
    { bengali: 'গান', meaning: 'Song' }, { bengali: 'ঘর', meaning: 'Room' }
  ] }, {});
  const card = concepts.find(item => item.id === 'word:জল:bn-en');
  const question = engine.createQuestion(card, concepts);
  assert.ok(question.options.includes('Water'));
  assert.equal(new Set(question.options).size, question.options.length);
});
