import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFile = path.join(root, 'glossika-day-15-25.md');
const generatedRoot = path.join(root, 'content', 'generated');

const romanPattern = /\(([^()]+)\)/u;

function slug(value) {
  return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
}

function cleanMarkdown(value) {
  return String(value || '').replace(/\*\*/gu, '').replace(/\s+/gu, ' ').trim();
}

function parseWeekSections(markdown) {
  const matches = [...markdown.matchAll(/^##\s+Week\s+(\d+):\s+(.+?)\s*$/gmu)];
  return matches.map((match, index) => ({
    week: Number(match[1]),
    topic: match[2].trim(),
    body: markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length)
  }));
}

function parseFunctional(body, unitId) {
  const match = body.match(/###\s+Functional Language(?::\s*(.+?))?\s*\n([\s\S]*?)(?=\n###\s+Vocabulary|\n###\s+Vocabulary \(|\n###\s+Situation Patterns|\n---|$)/u);
  if (!match) return [];
  const functionName = cleanMarkdown(match[1] || 'Functional language');
  return [...match[2].matchAll(/^\s*-\s*\*\*(.+?)\*\*\s*\(([^)]+)\)\s*$/gmu)].map((row, index) => ({
    id: `${unitId}-functional-${String(index + 1).padStart(2, '0')}`,
    type: 'functional-language',
    function: functionName,
    functionId: slug(functionName),
    register: 'standard',
    bengali: '',
    roman: row[2].trim(),
    literalGloss: '',
    english: row[1].trim(),
    tamil: ''
  }));
}

function parseFunctionalCompact(body, unitId) {
  const match = body.match(/###\s+Functional Language(?::\s*(.+?))?\s*\n([\s\S]*?)(?=\n###\s+Vocabulary|\n###\s+Vocabulary \(|\n###\s+Situation Patterns|\n---|$)/u);
  if (!match) return [];
  const rows = [...match[2].matchAll(/^\s*-\s*\*\*(.+?)\*\*\s*\(([^)]+)\)\s*$/gmu)];
  return rows.map((row, index) => ({
    id: `${unitId}-functional-${String(index + 1).padStart(2, '0')}`,
    type: 'functional-language',
    function: cleanMarkdown(match[1] || 'Functional language'),
    functionId: slug(match[1] || 'Functional language'),
    register: 'standard',
    bengali: '',
    roman: row[2].trim(),
    literalGloss: '',
    english: row[1].trim(),
    tamil: ''
  }));
}

function parseVocabularyTable(body, unitId) {
  const table = body.match(/###\s+Vocabulary(?: \([^\n]+\))?\s*\n([\s\S]*?)(?=\n###\s+Situation Patterns|\n---|$)/u)?.[1] || '';
  const rows = [...table.matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gmu)]
    .filter(row => row[1].trim() !== 'Bengali' && !/^[-: ]+$/u.test(row[1]));
  return rows.map((row, index) => ({
    id: `${unitId}-vocab-${String(index + 1).padStart(3, '0')}`,
    type: 'vocabulary', bengali: row[1].trim(), roman: row[2].trim(), english: row[3].trim(), tamil: '', partOfSpeech: 'word', oppositeId: ''
  }));
}

function parseCompactVocabulary(body, unitId) {
  const section = body.match(/###\s+Vocabulary(?: \([^\n]+\))?\s*\n([\s\S]*?)(?=\n###\s+Situation Patterns|\n---|$)/u)?.[1] || '';
  const items = [];
  for (const line of section.split(/\r?\n/u)) {
    const compact = line.replace(/^\s*-\s*/u, '').replace(/^\*\*.*?\*\*:\s*/u, '').trim();
    if (!compact || compact.startsWith('|')) continue;
    for (const match of compact.matchAll(/([^,;]+?)\s*\(([^()]+?)\)\s*(?:,|;|\.$|$)/gu)) {
      const raw = match[1].trim();
      const gloss = match[2].trim();
      const english = gloss.includes(' - ') ? gloss.split(' - ')[0].trim() : gloss;
      const parts = english.match(/^(.+?)\s+\((.+)\)$/u);
      items.push({ raw, roman: parts ? parts[2] : '', english: parts ? parts[1] : english });
    }
  }
  return items.map((item, index) => ({
    id: `${unitId}-vocab-${String(index + 1).padStart(3, '0')}`,
    type: 'vocabulary', bengali: item.raw, roman: item.roman, english: item.english, tamil: '', partOfSpeech: 'word', oppositeId: ''
  }));
}

function parseSituationPatterns(body, unitId) {
  const section = body.match(/###\s+Situation Patterns\s*\n([\s\S]*?)(?=\n---|$)/u)?.[1] || '';
  return [...section.matchAll(/^\s*-\s*\*\*(.+?)\*\*\s*\(([^)]+)\)\s*$/gmu)].map((row, index) => ({
    id: `${unitId}-pattern-${String(index + 1).padStart(2, '0')}`,
    type: 'situation-pattern', register: 'standard', bengali: '', roman: row[2].trim(), literalGloss: '', english: row[1].trim(), tamil: ''
  }));
}

function parseWeek(section) {
  const unitId = `a1-week-${section.week}-glossika`;
  let vocabulary = parseVocabularyTable(section.body, unitId);
  if (!vocabulary.length) vocabulary = parseCompactVocabulary(section.body, unitId);
  const functionalLanguage = parseFunctionalCompact(section.body, unitId);
  const situationPatterns = parseSituationPatterns(section.body, unitId);
  return {
    id: unitId, level: 'A1', week: section.week, sequence: section.week, topic: section.topic,
    status: 'source-imported', source: 'glossika-day-15-25.md', prerequisite: 'foundation-mixed-alphabets',
    sourceFile: 'glossika-day-15-25.md', functionalLanguage, vocabulary, numbers: [], situationPatterns, dialogues: []
  };
}

async function main() {
  const markdown = await fs.readFile(sourceFile, 'utf8');
  const sections = parseWeekSections(markdown);
  const imported = sections.map(parseWeek).filter(unit => unit.functionalLanguage.length || unit.vocabulary.length || unit.situationPatterns.length);
  const jsonPath = path.join(generatedRoot, 'curriculum-content.json');
  const current = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
  const byWeek = new Map(current.units.map(unit => [Number(unit.week), unit]));
  for (const unit of imported) byWeek.set(Number(unit.week), unit);
  const units = [...byWeek.values()].sort((a, b) => Number(a.sequence) - Number(b.sequence));
  const payload = { schemaVersion: current.schemaVersion || 1, unitCount: units.length, units };
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  await fs.writeFile(path.join(generatedRoot, 'curriculum-content.js'), `window.BENGALI_CURRICULUM = ${JSON.stringify(payload, null, 2)};\n`);
  const importedSummary = imported.map(unit => `- Week ${unit.week}: ${unit.topic} (${unit.vocabulary.length} vocabulary, ${unit.functionalLanguage.length} functional expressions, ${unit.situationPatterns.length} patterns)`).join('\n');
  await fs.writeFile(path.join(generatedRoot, 'glossika-curriculum-report.md'), `# Glossika curriculum import\n\nSource: glossika-day-15-25.md\n\nImported ${imported.length} units. Existing units not represented in the source archive are retained.\n\n${importedSummary}\n`);
  console.log(`Imported ${imported.length} Glossika curriculum units; course now has ${units.length} units.`);
}

await main();
