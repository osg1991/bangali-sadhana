#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REPOSITORY = 'https://github.com/osg1991/RamprasadSen.git';
const GITHUB_BLOB_ROOT = 'https://github.com/osg1991/RamprasadSen/blob/main/';
const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/osg1991/RamprasadSen/main/';

function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, '\n').normalize('NFC');
}

function stripFrontmatter(markdown) {
  const text = normalizeNewlines(markdown);
  if (!text.startsWith('---\n')) return { metadata: {}, body: text };
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return { metadata: {}, body: text };

  const metadata = {};
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    metadata[key] = value;
  }
  return { metadata, body: text.slice(end + 5) };
}

function decodeRepositoryPath(url) {
  if (!url) return '';
  const withoutQuery = url.split(/[?#]/, 1)[0];
  const marker = '/blob/main/';
  const rawMarker = '/main/';
  const markerIndex = withoutQuery.indexOf(marker);
  const rawIndex = withoutQuery.includes('raw.githubusercontent.com') ? withoutQuery.indexOf(rawMarker) : -1;
  const encoded = markerIndex >= 0
    ? withoutQuery.slice(markerIndex + marker.length)
    : rawIndex >= 0
      ? withoutQuery.slice(rawIndex + rawMarker.length)
      : withoutQuery;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function parseReadmeIndex(markdown) {
  const map = new Map();
  for (const line of normalizeNewlines(markdown).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const links = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
    const songLink = links.find(([, , url]) => decodeRepositoryPath(url).toLowerCase().endsWith('.md'));
    if (!songLink) continue;
    const audioLink = links.find(([, label, url]) => /mp3/i.test(label) || decodeRepositoryPath(url).toLowerCase().endsWith('.mp3'));
    const file = decodeRepositoryPath(songLink[2]);
    map.set(file, {
      displayTitle: songLink[1].trim(),
      audioPath: audioLink ? decodeRepositoryPath(audioLink[2]) : ''
    });
  }
  return map;
}

function cleanMarkdownLine(line) {
  let value = line.trim();
  if (!value) return '';
  value = value
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/^🔸\s*/, '')
    .trim();
  return value;
}

function scriptOf(value) {
  if (/[\u0980-\u09FF]/u.test(value)) return 'bengali';
  if (/[\u0B80-\u0BFF]/u.test(value)) return 'tamil';
  if (/[A-Za-zÀ-ɏĀ-ž]/u.test(value)) return 'latin';
  return 'other';
}

function isBoilerplate(value) {
  return /^(would you like|let me know|reference:|for the items marked|these are all the poems)/i.test(value)
    || /^verse\s*\d+/i.test(value)
    || /^type:|^collections:|^tags:/i.test(value);
}

function detectLabel(value) {
  const normalized = value.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized === 'bengali' || normalized.startsWith('bengali ')) return 'bengali';
  if (/^(itrans|romanized|roman|transliteration)/.test(normalized)) return 'roman';
  if (normalized.startsWith('tamil meaning')) return 'tamilMeaning';
  if (normalized.startsWith('english meaning')) return 'englishMeaning';
  return '';
}

function emptyVerse() {
  return { bengali: [], roman: [], tamilMeaning: [], englishMeaning: [] };
}

function hasVerseContent(verse) {
  return verse.bengali.length > 0;
}

function normaliseVerse(verse) {
  const compact = {};
  for (const key of ['bengali', 'roman', 'tamilMeaning', 'englishMeaning']) {
    compact[key] = verse[key].map(value => value.trim()).filter(Boolean);
  }
  return compact;
}

function parseLabeledVerses(body) {
  const lines = normalizeNewlines(body).split('\n');
  const verses = [];
  let current = emptyVerse();
  let mode = '';
  let sawLabel = false;

  const push = () => {
    if (hasVerseContent(current)) verses.push(normaliseVerse(current));
    current = emptyVerse();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (/^---+$/.test(trimmed) || /^#{1,6}\s*verse\b/i.test(trimmed) || /^\*\*\s*verse\b/i.test(trimmed)) {
      if (hasVerseContent(current)) push();
      mode = '';
      continue;
    }

    const cleaned = cleanMarkdownLine(rawLine);
    if (!cleaned || isBoilerplate(cleaned)) continue;
    const label = detectLabel(cleaned);
    if (label) {
      mode = label;
      sawLabel = true;
      continue;
    }
    if (!mode) continue;

    if (mode === 'bengali' && scriptOf(cleaned) === 'bengali') current.bengali.push(cleaned);
    else if (mode === 'tamilMeaning' && scriptOf(cleaned) === 'tamil') current.tamilMeaning.push(cleaned);
    else if (mode === 'roman' && scriptOf(cleaned) === 'latin') current.roman.push(cleaned);
    else if (mode === 'englishMeaning' && scriptOf(cleaned) === 'latin') current.englishMeaning.push(cleaned);
  }
  push();
  return sawLabel ? verses : [];
}

function splitGenericSections(body) {
  const sections = [];
  let current = [];
  const push = () => {
    if (current.length) sections.push(current);
    current = [];
  };

  for (const rawLine of normalizeNewlines(body).split('\n')) {
    const trimmed = rawLine.trim();
    if (/^---+$/.test(trimmed) || /^#{1,6}\s*verse\b/i.test(trimmed) || /^\*\*\s*verse\b/i.test(trimmed)) {
      push();
      continue;
    }
    const cleaned = cleanMarkdownLine(rawLine);
    if (!cleaned || isBoilerplate(cleaned) || detectLabel(cleaned)) continue;
    current.push({ value: cleaned, script: scriptOf(cleaned) });
  }
  push();
  return sections;
}

function splitByBengaliRuns(lines) {
  const units = [];
  let current = [];
  let seenBengali = false;
  let seenFollowingText = false;

  for (const line of lines) {
    if (line.script === 'bengali') {
      if (seenBengali && seenFollowingText) {
        units.push(current);
        current = [];
        seenFollowingText = false;
      }
      seenBengali = true;
      current.push(line);
    } else if (seenBengali) {
      current.push(line);
      seenFollowingText = true;
    }
  }
  if (current.some(line => line.script === 'bengali')) units.push(current);
  return units;
}

function likelyEnglish(value) {
  return /\b(the|a|an|you|your|mother|who|with|and|of|in|is|are|art|thou|our|my|to|from|this|that|not|know|all|will|mind|gold|child|earth|water)\b/i.test(value)
    || /^[A-Z][a-z]+(?:\s+[A-Za-z'’-]+){2,}[.!?]?$/u.test(value);
}

function parseGenericUnit(unit) {
  const verse = emptyVerse();
  verse.bengali = unit.filter(line => line.script === 'bengali').map(line => line.value);
  const tamilIndexes = unit.map((line, index) => line.script === 'tamil' ? index : -1).filter(index => index >= 0);
  verse.tamilMeaning = unit.filter(line => line.script === 'tamil').map(line => line.value);

  const latin = unit.map((line, index) => ({ ...line, index })).filter(line => line.script === 'latin');
  if (!latin.length) return normaliseVerse(verse);

  if (tamilIndexes.length) {
    const firstTamil = Math.min(...tamilIndexes);
    const lastTamil = Math.max(...tamilIndexes);
    verse.roman = latin.filter(line => line.index < firstTamil).map(line => line.value);
    verse.englishMeaning = latin.filter(line => line.index > lastTamil).map(line => line.value);
  } else {
    const count = verse.bengali.length;
    if (latin.length >= count * 2) {
      verse.roman = latin.slice(0, count).map(line => line.value);
      verse.englishMeaning = latin.slice(count, count * 2).map(line => line.value);
    } else {
      for (const line of latin) {
        (likelyEnglish(line.value) ? verse.englishMeaning : verse.roman).push(line.value);
      }
      if (!verse.roman.length && verse.englishMeaning.length > count) {
        verse.roman = verse.englishMeaning.splice(0, count);
      }
    }
  }
  return normaliseVerse(verse);
}

function parseGenericVerses(body) {
  const verses = [];
  for (const section of splitGenericSections(body)) {
    for (const unit of splitByBengaliRuns(section)) {
      const verse = parseGenericUnit(unit);
      if (verse.bengali.length) verses.push(verse);
    }
  }
  return verses;
}

export function parseSongMarkdown(markdown, options = {}) {
  const { metadata, body } = stripFrontmatter(markdown);
  const labeled = parseLabeledVerses(body);
  const verses = labeled.length ? labeled : parseGenericVerses(body);
  const titleFromHeading = normalizeNewlines(body).split('\n')
    .map(cleanMarkdownLine)
    .find(value => value && scriptOf(value) === 'latin' && !isBoilerplate(value));
  const title = metadata.title || options.displayTitle || titleFromHeading || basename(options.file || '', '.md');
  return { title, metadata, verses };
}

function normalizeToken(value) {
  return value
    .normalize('NFC')
    .replace(/[\u200C\u200D]/g, '')
    .replace(/^[^\u0980-\u09FF]+|[^\u0980-\u09FF]+$/gu, '')
    .trim();
}

export function tokenizeBengali(value) {
  return value
    .normalize('NFC')
    .replace(/([\u0980-\u09FF]+)\s+ৎ\s+([\u0980-\u09FF]+)/gu, '$1ৎ$2')
    .replace(/([\u0980-\u09FF])['’]([\u0980-\u09FF])/gu, '$1$2')
    .split(/[\s,.;:!?“”"'‘’()\[\]{}—–\-/।]+/u)
    .map(normalizeToken)
    .filter(token => /[\u0980-\u09FF]/u.test(token));
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'song';
}

function unicodeKey(value) {
  return [...value.normalize('NFC')].map(character => character.codePointAt(0).toString(16)).join('-');
}

function alignLine(verse, index) {
  const pick = (array) => array[index] || (array.length === 1 ? array[0] : '');
  return {
    bengali: verse.bengali[index] || '',
    roman: pick(verse.roman),
    tamilMeaning: pick(verse.tamilMeaning),
    englishMeaning: pick(verse.englishMeaning)
  };
}

function flattenLines(verses) {
  const lines = [];
  for (const verse of verses) {
    for (let index = 0; index < verse.bengali.length; index += 1) lines.push(alignLine(verse, index));
  }
  return lines;
}

function readGitMetadata(sourceDir) {
  try {
    const sourceCommit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const sourceCommitDate = execFileSync('git', ['-C', sourceDir, 'show', '-s', '--format=%cI', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return { sourceCommit, sourceCommitDate };
  } catch {
    return { sourceCommit: '', sourceCommitDate: '' };
  }
}

function resolveSourceDirectory(cliSource) {
  const candidates = [
    cliSource,
    process.env.RAMPRASAD_REPO_DIR,
    join(ROOT, 'external', 'RamprasadSen'),
    join(ROOT, '.cache', 'RamprasadSen')
  ].filter(Boolean).map(value => resolve(ROOT, value));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'README.md'))) return candidate;
  }

  const cloneTarget = resolve(ROOT, '.cache', 'RamprasadSen');
  mkdirSync(dirname(cloneTarget), { recursive: true });
  console.log(`No local RamprasadSen checkout found. Cloning ${DEFAULT_REPOSITORY}...`);
  execFileSync('git', ['clone', '--depth', '1', DEFAULT_REPOSITORY, cloneTarget], { stdio: 'inherit' });
  return cloneTarget;
}

function parseArguments(argv) {
  const args = { source: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--source') args.source = argv[index + 1] || '';
  }
  return args;
}

function loadVocabularyDictionary() {
  const file = join(ROOT, 'content', 'ramprasad-vocabulary.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  const index = new Map();
  for (const entry of parsed.entries || []) {
    const aliases = [entry.bengali, ...(entry.aliases || [])];
    for (const alias of aliases) index.set(normalizeToken(alias), entry);
  }
  return { parsed, index };
}

function buildSongs(sourceDir, readmeIndex) {
  const files = readdirSync(sourceDir)
    .filter(file => /^\d+-.+\.md$/iu.test(file))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const songs = [];
  const parseFailures = [];
  for (const file of files) {
    const markdown = readFileSync(join(sourceDir, file), 'utf8');
    const readmeEntry = readmeIndex.get(file) || {};
    const parsed = parseSongMarkdown(markdown, { file, displayTitle: readmeEntry.displayTitle });
    const lines = flattenLines(parsed.verses).filter(line => line.bengali);
    if (!lines.length) {
      parseFailures.push(file);
      continue;
    }
    const id = `${String(Number.parseInt(file, 10) || songs.length + 1).padStart(2, '0')}-${slugify(parsed.title)}`;
    const audioPath = readmeEntry.audioPath || '';
    songs.push({
      id,
      number: Number.parseInt(file, 10) || songs.length + 1,
      title: parsed.title,
      file,
      source: `${GITHUB_BLOB_ROOT}${encodeURI(file)}`,
      audio: audioPath ? `${GITHUB_RAW_ROOT}${audioPath.split('/').map(encodeURIComponent).join('/')}` : '',
      featuredLine: lines[0],
      verses: parsed.verses,
      lines
    });
  }
  return { songs, parseFailures };
}

function buildVocabulary(songs, dictionaryIndex) {
  const mapped = new Map();
  const unmapped = new Map();

  for (const song of songs) {
    for (const line of song.lines) {
      for (const token of tokenizeBengali(line.bengali)) {
        const entry = dictionaryIndex.get(normalizeToken(token));
        if (entry) {
          const key = entry.bengali;
          const current = mapped.get(key) || {
            id: `ramprasadi-${unicodeKey(entry.bengali)}`,
            category: 'Ramprasadi vocabulary',
            bengali: entry.bengali,
            roman: entry.roman || '',
            devanagari: entry.devanagari || '',
            tamil: entry.tamilPronunciation || '',
            englishMeaning: entry.englishMeaning,
            tamilMeaning: entry.tamilMeaning,
            meaning: entry.englishMeaning,
            frequency: 0,
            songIds: [],
            sourceTitles: [],
            sourceLine: line.bengali
          };
          current.frequency += 1;
          if (!current.songIds.includes(song.id)) current.songIds.push(song.id);
          if (!current.sourceTitles.includes(song.title)) current.sourceTitles.push(song.title);
          mapped.set(key, current);
        } else {
          const current = unmapped.get(token) || { bengali: token, frequency: 0, sourceTitles: [], sampleLine: line.bengali };
          current.frequency += 1;
          if (!current.sourceTitles.includes(song.title)) current.sourceTitles.push(song.title);
          unmapped.set(token, current);
        }
      }
    }
  }

  const words = [...mapped.values()]
    .map(item => ({ ...item, sourceTitle: item.sourceTitles[0] || '' }))
    .sort((a, b) => b.frequency - a.frequency || a.bengali.localeCompare(b.bengali, 'bn'));
  const unmappedWords = [...unmapped.values()]
    .sort((a, b) => b.frequency - a.frequency || a.bengali.localeCompare(b.bengali, 'bn'));
  return { words, unmappedWords };
}

function attachVocabularyToSongs(songs, words) {
  const bySong = new Map();
  for (const word of words) {
    for (const songId of word.songIds) {
      if (!bySong.has(songId)) bySong.set(songId, []);
      bySong.get(songId).push(word);
    }
  }
  return songs.map(song => ({
    ...song,
    words: (bySong.get(song.id) || [])
      .sort((a, b) => {
        const aInFeatured = song.featuredLine.bengali.includes(a.bengali) ? 0 : 1;
        const bInFeatured = song.featuredLine.bengali.includes(b.bengali) ? 0 : 1;
        return aInFeatured - bInFeatured || b.frequency - a.frequency;
      })
      .slice(0, 16)
      .map(word => ({
        bengali: word.bengali,
        roman: word.roman,
        englishMeaning: word.englishMeaning,
        tamilMeaning: word.tamilMeaning
      }))
  }));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function buildReport(meta, songs, words, unmappedWords, parseFailures) {
  const topUnmapped = unmappedWords.slice(0, 100)
    .map(item => `| ${item.bengali} | ${item.frequency} | ${item.sourceTitles[0] || ''} | ${item.sampleLine.replaceAll('|', '\\|')} |`)
    .join('\n');
  const failures = parseFailures.length ? parseFailures.map(file => `- ${file}`).join('\n') : '- None';
  return `# Ramprasad content sync report\n\n` +
    `- Source commit: ${meta.sourceCommit || 'Unavailable'}\n` +
    `- Source commit date: ${meta.sourceCommitDate || 'Unavailable'}\n` +
    `- Parsed songs: ${songs.length}\n` +
    `- Mapped vocabulary entries: ${words.length}\n` +
    `- Unmapped Bengali word forms: ${unmappedWords.length}\n\n` +
    `## Parse failures\n\n${failures}\n\n` +
    `## Highest-frequency unmapped forms\n\n` +
    `Add reviewed meanings to \`content/ramprasad-vocabulary.json\`, then run the sync again.\n\n` +
    `| Bengali | Count | First song | Sample line |\n|---|---:|---|---|\n${topUnmapped}\n`;
}

export function syncRamprasad({ sourceDir }) {
  const source = resolveSourceDirectory(sourceDir);
  const readme = readFileSync(join(source, 'README.md'), 'utf8');
  const readmeIndex = parseReadmeIndex(readme);
  const { index: dictionaryIndex } = loadVocabularyDictionary();
  const { songs: rawSongs, parseFailures } = buildSongs(source, readmeIndex);
  const { words, unmappedWords } = buildVocabulary(rawSongs, dictionaryIndex);
  const songs = attachVocabularyToSongs(rawSongs, words);
  const meta = {
    ...readGitMetadata(source),
    sourceRepository: 'osg1991/RamprasadSen',
    songCount: songs.length,
    vocabularyCount: words.length,
    unmappedCount: unmappedWords.length
  };

  const generatedDir = join(ROOT, 'content', 'generated');
  mkdirSync(generatedDir, { recursive: true });
  writeJson(join(generatedDir, 'ramprasad-songs.json'), songs);
  writeJson(join(generatedDir, 'ramprasad-words.json'), words);
  writeJson(join(generatedDir, 'ramprasad-unmapped-words.json'), unmappedWords);
  writeJson(join(generatedDir, 'ramprasad-meta.json'), meta);
  writeFileSync(join(generatedDir, 'ramprasad-content.js'),
    `window.RAMPRASAD_CONTENT = ${JSON.stringify({ meta, songs, words }, null, 2)};\n`);
  writeFileSync(join(generatedDir, 'ramprasad-report.md'), buildReport(meta, songs, words, unmappedWords, parseFailures));

  console.log(`Parsed ${songs.length} songs; generated ${words.length} mapped words; ${unmappedWords.length} forms need review.`);
  return { source, meta, songs, words, unmappedWords, parseFailures };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  const args = parseArguments(process.argv.slice(2));
  syncRamprasad({ sourceDir: args.source });
}
