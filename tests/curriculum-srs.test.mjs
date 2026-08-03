import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
globalThis.window = globalThis;
globalThis.BENGALI_CURRICULUM = JSON.parse(readFileSync(resolve(root, 'content/generated/curriculum-content.json'), 'utf8'));
globalThis.BENGALI_SRS_ENGINE = {
  buildConcepts() { return [{ id: 'script:অ:sound', kind: 'script', trackStage: 'vowels' }]; },
  createQuestion() { return { prompt: 'base', answer: 'base', options: ['base'], explanation: 'base' }; },
  stableHash(value) {
    let hash = 0;
    for (const character of String(value)) hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
    return hash >>> 0;
  }
};
await import('../learning/curriculum-engine.js');

const engine = globalThis.BENGALI_SRS_ENGINE;
const curriculumEngine = globalThis.BENGALI_CURRICULUM_ENGINE;

test('curriculum engine creates cards for all lesson sections', () => {
  const concepts = curriculumEngine.buildCurriculumConcepts(globalThis.BENGALI_CURRICULUM);
  assert.ok(concepts.some(card => card.section === 'Vocabulary'));
  assert.ok(concepts.some(card => card.section === 'Numbers'));
  assert.ok(concepts.some(card => card.section.startsWith('Functional')));
  assert.ok(concepts.some(card => card.section === 'Situation patterns'));
  assert.ok(concepts.some(card => card.section.startsWith('Mini-dialogue')));
});

test('all topic cards use the post-foundation words stage', () => {
  const concepts = engine.buildConcepts({}, {});
  const topicCards = concepts.filter(card => card.curriculum);
  assert.ok(topicCards.length > 0);
  assert.ok(topicCards.every(card => card.trackStage === 'words'));
  assert.equal(concepts.at(-1).trackStage, 'vowels');
});

test('first topic session mixes vocabulary, functions, numbers and patterns', () => {
  const cards = curriculumEngine.unitConcepts(globalThis.BENGALI_CURRICULUM.units[0]).slice(0, 5);
  assert.deepEqual(cards.map(card => card.section), [
    'Vocabulary',
    'Vocabulary',
    'Functional · Congratulating',
    'Numbers',
    'Situation patterns'
  ]);
});

test('curriculum question has unique choices and a useful explanation', () => {
  const concepts = curriculumEngine.buildCurriculumConcepts(globalThis.BENGALI_CURRICULUM);
  const card = concepts.find(item => item.direction === 'topic-dialogue-next');
  const question = engine.createQuestion(card, concepts);
  assert.ok(question.prompt.includes(card.promptBengali));
  assert.ok(question.options.includes(card.answer));
  assert.equal(new Set(question.options).size, question.options.length);
  assert.match(question.explanation, /Tamil:/u);
});
