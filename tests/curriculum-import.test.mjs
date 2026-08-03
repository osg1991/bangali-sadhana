import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCurriculumMarkdown, validateCourse } from '../scripts/sync-curriculum.mjs';

const root = resolve(import.meta.dirname, '..');
const markdown = readFileSync(resolve(root, 'content/curriculum/a1/week-20-common-adjectives.md'), 'utf8');
const course = parseCurriculumMarkdown(markdown, 'week-20-common-adjectives.md');

test('Week 20 Markdown parses all curriculum sections', () => {
  assert.equal(course.id, 'a1-week-20-common-adjectives');
  assert.equal(course.level, 'A1');
  assert.equal(course.week, 20);
  assert.equal(course.vocabulary.length, 40);
  assert.equal(course.functionalLanguage.length, 6);
  assert.equal(course.numbers.length, 10);
  assert.equal(course.situationPatterns.length, 9);
  assert.equal(course.dialogues.length, 2);
  assert.equal(course.dialogues.reduce((sum, dialogue) => sum + dialogue.turns.length, 0), 6);
});

test('curriculum IDs are unique and number values are numeric', () => {
  const validation = validateCourse(course);
  assert.deepEqual(validation.errors, []);
  assert.ok(course.numbers.every(item => Number.isFinite(item.numericValue)));
  const ids = [
    ...course.vocabulary,
    ...course.functionalLanguage,
    ...course.numbers,
    ...course.situationPatterns
  ].map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('reviewed curriculum includes Tamil meanings', () => {
  const items = [
    ...course.vocabulary,
    ...course.functionalLanguage,
    ...course.numbers,
    ...course.situationPatterns,
    ...course.dialogues.flatMap(dialogue => dialogue.turns)
  ];
  assert.ok(items.every(item => item.tamil));
});
