import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const curriculumRoot = path.join(root, 'content', 'curriculum');
const generatedRoot = path.join(root, 'content', 'generated');

function scalar(value) {
  const trimmed = String(value ?? '').trim();
  if (/^-?\d+$/u.test(trimmed)) return Number(trimmed);
  if (/^(true|false)$/iu.test(trimmed)) return trimmed.toLowerCase() === 'true';
  return trimmed.replace(/^['"]|['"]$/gu, '');
}

export function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/u);
  if (!match) throw new Error('Missing YAML-style front matter.');
  const meta = {};
  for (const line of match[1].split(/\r?\n/u)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator < 1) throw new Error(`Invalid front-matter line: ${line}`);
    meta[line.slice(0, separator).trim()] = scalar(line.slice(separator + 1));
  }
  return { meta, body: markdown.slice(match[0].length) };
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/u, '').replace(/\|$/u, '');
  return trimmed.split('|').map(cell => cell.trim().replaceAll('\\|', '|'));
}

function isSeparator(line) {
  return /^\s*\|?\s*:?-{3,}/u.test(line);
}

export function parseTables(body) {
  const lines = body.split(/\r?\n/u);
  const tables = [];
  let section = '';
  let group = '';

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const h2 = line.match(/^##\s+(.+?)\s*$/u);
    if (h2) { section = h2[1].trim(); group = ''; continue; }
    const h3 = line.match(/^###\s+(.+?)\s*$/u);
    if (h3) { group = h3[1].trim(); continue; }
    if (!line.trim().startsWith('|') || index + 1 >= lines.length || !isSeparator(lines[index + 1])) continue;

    const headers = splitTableRow(line);
    const rows = [];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith('|')) {
      const values = splitTableRow(lines[index]);
      const row = {};
      headers.forEach((header, cellIndex) => { row[header] = values[cellIndex] ?? ''; });
      rows.push(row);
      index += 1;
    }
    index -= 1;
    tables.push({ section, group, headers, rows });
  }
  return tables;
}

function slug(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function required(row, column, context) {
  const value = String(row[column] ?? '').trim();
  if (!value) throw new Error(`${context}: missing ${column}`);
  return value;
}

function optional(row, column) {
  return String(row[column] ?? '').trim();
}

function mapFunctional(table, unitId) {
  const functionId = slug(table.group);
  return table.rows.map((row, index) => ({
    id: required(row, 'ID', `${unitId} functional row ${index + 1}`), type: 'functional-language', function: table.group, functionId,
    register: required(row, 'Register', `${unitId} functional row ${index + 1}`).toLowerCase(),
    bengali: required(row, 'Bengali', `${unitId} functional row ${index + 1}`), roman: required(row, 'Romanization', `${unitId} functional row ${index + 1}`),
    literalGloss: optional(row, 'Literal gloss'), english: required(row, 'English', `${unitId} functional row ${index + 1}`), tamil: optional(row, 'Tamil')
  }));
}

function mapVocabulary(table, unitId) {
  return table.rows.map((row, index) => ({
    id: required(row, 'ID', `${unitId} vocabulary row ${index + 1}`), type: 'vocabulary',
    bengali: required(row, 'Bengali', `${unitId} vocabulary row ${index + 1}`), roman: required(row, 'Romanization', `${unitId} vocabulary row ${index + 1}`),
    english: required(row, 'English', `${unitId} vocabulary row ${index + 1}`), tamil: optional(row, 'Tamil'),
    partOfSpeech: optional(row, 'Part of speech') || 'word', oppositeId: optional(row, 'Opposite ID')
  }));
}

function mapNumbers(table, unitId) {
  return table.rows.map((row, index) => {
    const rawValue = required(row, 'Numeric value', `${unitId} number row ${index + 1}`);
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) throw new Error(`${unitId} number row ${index + 1}: invalid Numeric value ${rawValue}`);
    return {
      id: required(row, 'ID', `${unitId} number row ${index + 1}`), type: 'number',
      bengali: required(row, 'Bengali', `${unitId} number row ${index + 1}`), roman: required(row, 'Romanization', `${unitId} number row ${index + 1}`), numericValue,
      english: required(row, 'English', `${unitId} number row ${index + 1}`), tamil: optional(row, 'Tamil')
    };
  });
}

function mapPatterns(table, unitId) {
  return table.rows.map((row, index) => ({
    id: required(row, 'ID', `${unitId} pattern row ${index + 1}`), type: 'situation-pattern',
    register: required(row, 'Register', `${unitId} pattern row ${index + 1}`).toLowerCase(),
    bengali: required(row, 'Bengali', `${unitId} pattern row ${index + 1}`), roman: required(row, 'Romanization', `${unitId} pattern row ${index + 1}`),
    literalGloss: optional(row, 'Literal gloss'), english: required(row, 'English', `${unitId} pattern row ${index + 1}`), tamil: optional(row, 'Tamil')
  }));
}

function mapDialogue(table, unitId, dialogueIndex) {
  const id = `${unitId}-dialogue-${dialogueIndex + 1}`;
  return {
    id, type: 'mini-dialogue', title: table.group || `Dialogue ${dialogueIndex + 1}`,
    turns: table.rows.map((row, index) => ({
      turn: Number(optional(row, 'Turn') || index + 1), speaker: required(row, 'Speaker', `${id} turn ${index + 1}`),
      register: required(row, 'Register', `${id} turn ${index + 1}`).toLowerCase(), bengali: required(row, 'Bengali', `${id} turn ${index + 1}`),
      roman: required(row, 'Romanization', `${id} turn ${index + 1}`), literalGloss: optional(row, 'Literal gloss'),
      english: required(row, 'English', `${id} turn ${index + 1}`), tamil: optional(row, 'Tamil')
    }))
  };
}

export function parseCurriculumMarkdown(markdown, sourceFile = '') {
  const { meta, body } = parseFrontMatter(markdown);
  for (const key of ['id', 'level', 'week', 'sequence', 'topic']) {
    if (meta[key] === undefined || meta[key] === '') throw new Error(`${sourceFile || 'curriculum'}: missing front-matter ${key}`);
  }
  const tables = parseTables(body);
  return {
    ...meta, sourceFile,
    functionalLanguage: tables.filter(table => table.section === 'Functional Language').flatMap(table => mapFunctional(table, meta.id)),
    vocabulary: tables.filter(table => table.section === 'Vocabulary').flatMap(table => mapVocabulary(table, meta.id)),
    numbers: tables.filter(table => table.section === 'Numbers').flatMap(table => mapNumbers(table, meta.id)),
    situationPatterns: tables.filter(table => table.section === 'Situation Patterns').flatMap(table => mapPatterns(table, meta.id)),
    dialogues: tables.filter(table => table.section === 'Mini-Dialogues').map((table, index) => mapDialogue(table, meta.id, index))
  };
}

export function validateCourse(course) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const collect = [
    ...course.functionalLanguage, ...course.vocabulary, ...course.numbers, ...course.situationPatterns, ...course.dialogues,
    ...course.dialogues.flatMap(dialogue => dialogue.turns.map(turn => ({ ...turn, id: `${dialogue.id}:turn-${turn.turn}` })))
  ];
  for (const item of collect) {
    if (ids.has(item.id)) errors.push(`Duplicate ID ${item.id}`);
    ids.set(item.id, true);
  }
  const vocabIds = new Set(course.vocabulary.map(item => item.id));
  for (const word of course.vocabulary) {
    if (word.oppositeId && !vocabIds.has(word.oppositeId)) warnings.push(`${word.id}: opposite ID ${word.oppositeId} is not present in this unit`);
    if (!word.tamil) warnings.push(`${word.id}: Tamil meaning is empty`);
  }
  for (const section of [course.functionalLanguage, course.situationPatterns]) {
    for (const item of section) if (!item.tamil) warnings.push(`${item.id}: Tamil meaning is empty`);
  }
  return { errors, warnings };
}

async function markdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(full));
    else if (/^week-.*\.md$/u.test(entry.name)) result.push(full);
  }
  return result.sort();
}

function reportFor(courses, validations) {
  const totals = courses.reduce((sum, course) => ({
    vocabulary: sum.vocabulary + course.vocabulary.length, functional: sum.functional + course.functionalLanguage.length,
    numbers: sum.numbers + course.numbers.length, patterns: sum.patterns + course.situationPatterns.length,
    dialogues: sum.dialogues + course.dialogues.length,
    dialogueTurns: sum.dialogueTurns + course.dialogues.reduce((count, dialogue) => count + dialogue.turns.length, 0)
  }), { vocabulary: 0, functional: 0, numbers: 0, patterns: 0, dialogues: 0, dialogueTurns: 0 });
  const errors = validations.flatMap(item => item.errors);
  const warnings = validations.flatMap(item => item.warnings);
  return `# Curriculum generation report\n\n- Units: ${courses.length}\n- Vocabulary: ${totals.vocabulary}\n- Functional expressions: ${totals.functional}\n- Number expressions: ${totals.numbers}\n- Situation patterns: ${totals.patterns}\n- Mini-dialogues: ${totals.dialogues}\n- Dialogue turns: ${totals.dialogueTurns}\n- Errors: ${errors.length}\n- Warnings: ${warnings.length}\n\n## Units\n\n${courses.map(course => `- ${course.level} · Week ${course.week}: ${course.topic} (${course.vocabulary.length} words, ${course.functionalLanguage.length} functional expressions, ${course.situationPatterns.length} patterns)`).join('\n')}\n\n## Warnings\n\n${warnings.length ? warnings.map(item => `- ${item}`).join('\n') : '- None'}\n`;
}

export async function syncCurriculum({ sourceRoot = curriculumRoot, outputRoot = generatedRoot } = {}) {
  const files = await markdownFiles(sourceRoot);
  const courses = [];
  const validations = [];
  for (const file of files) {
    const markdown = await fs.readFile(file, 'utf8');
    const sourceFile = path.relative(root, file).replaceAll(path.sep, '/');
    const course = parseCurriculumMarkdown(markdown, sourceFile);
    const validation = validateCourse(course);
    if (validation.errors.length) throw new Error(`${sourceFile}:\n${validation.errors.join('\n')}`);
    courses.push(course);
    validations.push(validation);
  }
  courses.sort((left, right) => Number(left.sequence) - Number(right.sequence));
  await fs.mkdir(outputRoot, { recursive: true });
  const payload = { schemaVersion: 1, unitCount: courses.length, units: courses };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await fs.writeFile(path.join(outputRoot, 'curriculum-content.json'), json);
  await fs.writeFile(path.join(outputRoot, 'curriculum-content.js'), `window.BENGALI_CURRICULUM = ${json.trim()};\n`);
  await fs.writeFile(path.join(outputRoot, 'curriculum-report.md'), reportFor(courses, validations));
  return payload;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payload = await syncCurriculum();
  const unit = payload.units[0];
  console.log(`Generated ${payload.unitCount} curriculum unit(s)${unit ? `; first unit: ${unit.level} Week ${unit.week} — ${unit.topic}` : ''}.`);
}
