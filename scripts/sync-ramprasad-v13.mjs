#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncRamprasad, tokenizeBengali } from './sync-ramprasad.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATED = join(ROOT, 'content', 'generated');

function normalizeToken(value) {
  return value.normalize('NFC').replace(/[\u200C\u200D]/g, '').trim();
}

function unicodeKey(value) {
  return [...value.normalize('NFC')].map(character => character.codePointAt(0).toString(16)).join('-');
}

function loadDictionary() {
  const parsed = JSON.parse(readFileSync(join(ROOT, 'content', 'ramprasad-vocabulary.json'), 'utf8'));
  const index = new Map();
  for (const entry of parsed.entries || []) {
    for (const form of [entry.bengali, ...(entry.aliases || [])]) index.set(normalizeToken(form), entry);
  }
  return index;
}

export function buildCompleteVocabulary(songs, dictionaryIndex) {
  const words = new Map();

  for (const song of songs) {
    for (const line of song.lines || []) {
      for (const token of tokenizeBengali(line.bengali || '')) {
        const observed = normalizeToken(token);
        const dictionary = dictionaryIndex.get(observed);
        const pending = !dictionary;
        const current = words.get(observed) || {
          id: `ramprasadi-${unicodeKey(observed)}`,
          category: pending ? 'Ramprasadi vocabulary · pending' : 'Ramprasadi vocabulary',
          bengali: observed,
          lemma: dictionary?.bengali || observed,
          roman: dictionary?.roman || '',
          devanagari: dictionary?.devanagari || '',
          tamil: dictionary?.tamilPronunciation || '',
          englishMeaning: dictionary?.englishMeaning || `Word meaning pending review. Line context: ${line.englishMeaning || 'not available'}`,
          tamilMeaning: dictionary?.tamilMeaning || `சொல் பொருள் பரிசீலனையில் உள்ளது. வரி பொருள்: ${line.tamilMeaning || 'கிடைக்கவில்லை'}`,
          meaning: dictionary?.englishMeaning || 'Word meaning pending review',
          reviewStatus: pending ? 'pending' : 'reviewed',
          frequency: 0,
          songIds: [],
          sourceTitles: [],
          sourceTitle: song.title,
          sourceLine: line.bengali || '',
          sourceLineRoman: line.roman || '',
          sourceLineEnglishMeaning: line.englishMeaning || '',
          sourceLineTamilMeaning: line.tamilMeaning || ''
        };
        current.frequency += 1;
        if (!current.songIds.includes(song.id)) current.songIds.push(song.id);
        if (!current.sourceTitles.includes(song.title)) current.sourceTitles.push(song.title);
        if (!current.sourceLineEnglishMeaning && line.englishMeaning) {
          current.sourceTitle = song.title;
          current.sourceLine = line.bengali || '';
          current.sourceLineRoman = line.roman || '';
          current.sourceLineEnglishMeaning = line.englishMeaning || '';
          current.sourceLineTamilMeaning = line.tamilMeaning || '';
        }
        words.set(observed, current);
      }
    }
  }

  const allWords = [...words.values()].sort((a, b) => b.frequency - a.frequency || a.bengali.localeCompare(b.bengali, 'bn'));
  return {
    allWords,
    reviewedWords: allWords.filter(word => word.reviewStatus === 'reviewed'),
    pendingWords: allWords.filter(word => word.reviewStatus === 'pending')
  };
}

const DETAILED_SCRIPT_ADDITIONS = [
  ['Rare Sanskrit vowels', 'ঌ', 'li', 'ऌ', 'லி', 'ঌ', 'li', 'rare Sanskrit vocalic l'],
  ['Rare Sanskrit vowels', 'ৠ', 'rī', 'ॠ', 'ரீ', 'ৠ', 'rī', 'rare Sanskrit long vocalic r'],
  ['Rare Sanskrit vowels', 'ৡ', 'lī', 'ॡ', 'லீ', 'ৡ', 'lī', 'rare Sanskrit long vocalic l'],
  ['Additional letters and signs', 'ড়', 'ṛa', 'ड़', 'ற', 'বড়', 'bôṛo', 'big'],
  ['Additional letters and signs', 'ঢ়', 'ṛha', 'ढ़', 'ற்ஹ', 'গাঢ়', 'gāṛho', 'deep or dense'],
  ['Additional letters and signs', 'য়', 'ẏa', 'य', 'ய', 'সময়', 'sômôẏ', 'time'],
  ['Additional letters and signs', 'ৎ', 't', 'त्', 'த்', 'সৎ', 'sôt', 'honest'],
  ['Additional letters and signs', 'ং', 'ṃ or ṅ', 'ं', 'ம்/ங்', 'বাংলা', 'bāṅlā', 'anusvara or nasal sound'],
  ['Additional letters and signs', 'ঃ', 'ḥ', 'ः', 'ஃ', 'দুঃখ', 'duḥkho', 'visarga or breath sound'],
  ['Additional letters and signs', 'ঁ', 'nasal', 'ँ', 'ஂ', 'চাঁদ', 'cā̃d', 'chandrabindu or nasalisation'],
  ['Vowel signs', 'ৃ', 'ri', 'ृ', 'ிரு', 'কৃষ্ণ', 'kriṣṇo', 'vocalic r sign'],
  ['Rare vowel signs', 'ৄ', 'rī', 'ॄ', '', 'ৄ', 'rī', 'rare long vocalic r sign'],
  ['Rare vowel signs', 'ৢ', 'li', 'ॢ', '', 'ৢ', 'li', 'rare vocalic l sign'],
  ['Rare vowel signs', 'ৣ', 'lī', 'ॣ', '', 'ৣ', 'lī', 'rare long vocalic l sign'],
  ['Orthographic signs', '্', 'hasanta', '्', '்', 'ক্', 'k', 'suppresses the inherent vowel'],
  ['Orthographic signs', '়', 'nukta', '़', '', 'ড়', 'ṛa', 'forms modified letters']
];

const NUMERALS = [
  ['০', '0', '०', '௦', 'শূন্য', 'śūnyo', 'zero'], ['১', '1', '१', '௧', 'এক', 'ek', 'one'],
  ['২', '2', '२', '௨', 'দুই', 'dui', 'two'], ['৩', '3', '३', '௩', 'তিন', 'tin', 'three'],
  ['৪', '4', '४', '௪', 'চার', 'cār', 'four'], ['৫', '5', '५', '௫', 'পাঁচ', 'pā̃c', 'five'],
  ['৬', '6', '६', '௬', 'ছয়', 'chôẏ', 'six'], ['৭', '7', '७', '௭', 'সাত', 'sāt', 'seven'],
  ['৮', '8', '८', '௮', 'আট', 'āṭ', 'eight'], ['৯', '9', '९', '௯', 'নয়', 'nôẏ', 'nine']
];

const COMMON_CONJUNCTS = `ক্ক ক্ট ক্ত ক্ব ক্ম ক্র ক্ল ক্ষ গ্ধ গ্ন গ্র গ্ল ঙ্ক ঙ্খ ঙ্গ ঙ্ঘ চ্চ চ্ছ চ্য জ্জ জ্ঞ জ্ব ঞ্চ ঞ্ছ ঞ্জ ট্ট ট্ঠ ট্র ড্ড ড্র ণ্ট ণ্ঠ ণ্ড ণ্ণ ত্ত ত্থ ত্ন ত্ম ত্র ত্ব দ্গ দ্ঘ দ্দ দ্ধ দ্ব দ্র ন্ত ন্থ ন্দ ন্ধ ন্ন ন্ম ন্ত্র প্ট প্ত প্ন প্প প্র প্ল ফ্র ব্জ ব্দ ব্ধ ব্র ব্ল ভ্র ম্ন ম্প ম্ফ ম্ব ম্ভ ম্ম ম্র ম্ল ল্ক ল্গ ল্ট ল্ড ল্প ল্ব ল্ম ল্ল শ্চ শ্ন শ্ম শ্র শ্ল ষ্ক ষ্ট ষ্ঠ ষ্ণ ষ্প ষ্ফ ষ্ম স্ক স্খ স্ট স্ত স্থ স্ন স্প স্ফ স্ম স্র স্ব হ্ণ হ্ন হ্ম হ্র হ্ল ক্য খ্য গ্য ঘ্য চ্য জ্য ত্য থ্য দ্য ধ্য ন্য প্য ব্য ভ্য ম্য ল্য শ্য ষ্য স্য হ্য র্ক র্গ র্চ র্জ র্ণ র্ত র্দ র্ধ র্ম র্য র্শ র্ষ র্স`.split(/\s+/u);

const ROMAN = { ক:'k', খ:'kh', গ:'g', ঘ:'gh', ঙ:'ṅ', চ:'c', ছ:'ch', জ:'j', ঝ:'jh', ঞ:'ñ', ট:'ṭ', ঠ:'ṭh', ড:'ḍ', ঢ:'ḍh', ণ:'ṇ', ত:'t', থ:'th', দ:'d', ধ:'dh', ন:'n', প:'p', ফ:'ph', ব:'b', ভ:'bh', ম:'m', য:'y', র:'r', ল:'l', শ:'ś', ষ:'ṣ', স:'s', হ:'h', '্':'' };
const DEVANAGARI = { ক:'क', খ:'ख', গ:'ग', ঘ:'घ', ঙ:'ङ', চ:'च', ছ:'छ', জ:'ज', ঝ:'झ', ঞ:'ञ', ট:'ट', ঠ:'ठ', ড:'ड', ঢ:'ढ', ণ:'ण', ত:'त', থ:'थ', দ:'द', ধ:'ध', ন:'न', প:'प', ফ:'फ', ব:'ब', ভ:'भ', ম:'म', য:'य', র:'र', ল:'ल', শ:'श', ষ:'ष', স:'स', হ:'ह', '্':'्' };

export function buildScriptAdditions() {
  const detailed = DETAILED_SCRIPT_ADDITIONS.map(([group, bengali, roman, devanagari, tamil, example, exampleRoman, meaning]) => ({ group, bengali, roman, devanagari, tamil, example, exampleRoman, meaning }));
  const numerals = NUMERALS.map(([bengali, roman, devanagari, tamil, example, exampleRoman, meaning]) => ({ group: 'Bengali numerals', bengali, roman, devanagari, tamil, example, exampleRoman, meaning }));
  const conjuncts = COMMON_CONJUNCTS.map(bengali => ({
    group: 'Common conjuncts', bengali,
    roman: [...bengali].map(character => ROMAN[character] ?? '').join(''),
    devanagari: [...bengali].map(character => DEVANAGARI[character] ?? '').join(''),
    tamil: '', example: bengali, exampleRoman: '', meaning: 'conjunct consonant form'
  }));
  return [...detailed, ...numerals, ...conjuncts];
}

function attachReviewedWordsToSongs(songs, reviewedWords) {
  return songs.map(song => {
    const words = reviewedWords
      .filter(word => word.songIds.includes(song.id))
      .sort((a, b) => {
        const aFeatured = song.featuredLine?.bengali?.includes(a.bengali) ? 0 : 1;
        const bFeatured = song.featuredLine?.bengali?.includes(b.bengali) ? 0 : 1;
        return aFeatured - bFeatured || b.frequency - a.frequency;
      });
    return {
      ...song,
      vocabularyCount: words.length,
      words: words.slice(0, 24).map(word => ({
        bengali: word.bengali, roman: word.roman,
        englishMeaning: word.englishMeaning, tamilMeaning: word.tamilMeaning
      }))
    };
  });
}

function writeJson(file, value) {
  writeFileSync(join(GENERATED, file), `${JSON.stringify(value, null, 2)}\n`);
}

export function completeSync({ sourceDir = '' } = {}) {
  const base = syncRamprasad({ sourceDir });
  const dictionary = loadDictionary();
  const { allWords, reviewedWords, pendingWords } = buildCompleteVocabulary(base.songs, dictionary);
  const songs = attachReviewedWordsToSongs(base.songs, reviewedWords);
  const scriptAdditions = buildScriptAdditions();
  const meta = {
    ...base.meta,
    songCount: songs.length,
    vocabularyCount: allWords.length,
    reviewedVocabularyCount: reviewedWords.length,
    pendingVocabularyCount: pendingWords.length,
    scriptAdditionCount: scriptAdditions.length
  };

  writeJson('ramprasad-songs.json', songs);
  writeJson('ramprasad-words.json', allWords);
  writeJson('ramprasad-reviewed-words.json', reviewedWords);
  writeJson('ramprasad-unmapped-words.json', pendingWords);
  writeJson('ramprasad-meta.json', meta);

  const browserPayload = { meta, songs, words: reviewedWords };
  writeFileSync(join(GENERATED, 'ramprasad-content.js'), `(() => {\n` +
    `  const additions = ${JSON.stringify(scriptAdditions, null, 2)};\n` +
    `  const pendingWords = ${JSON.stringify(pendingWords, null, 2)};\n` +
    `  const base = window.BENGALI_BASE_CONTENT || { script: [], words: [], sentences: [] };\n` +
    `  const scriptSeen = new Set((base.script || []).map(item => item.bengali));\n` +
    `  base.script = [...(base.script || []), ...additions.filter(item => !scriptSeen.has(item.bengali))];\n` +
    `  const wordSeen = new Set((base.words || []).map(item => item.bengali));\n` +
    `  base.words = [...(base.words || []), ...pendingWords.filter(item => !wordSeen.has(item.bengali))];\n` +
    `  window.BENGALI_BASE_CONTENT = base;\n` +
    `  window.RAMPRASAD_CONTENT = ${JSON.stringify(browserPayload, null, 2)};\n` +
    `})();\n`);

  const report = `# Ramprasad content sync report\n\n` +
    `- Parsed songs: ${songs.length}\n` +
    `- Total distinct lyric word forms: ${allWords.length}\n` +
    `- Reviewed English/Tamil word meanings: ${reviewedWords.length}\n` +
    `- Pending word-level reviews: ${pendingWords.length}\n` +
    `- Script additions: ${scriptAdditions.length}\n\n` +
    `Every pending word remains available in the vocabulary library with its translated source-line context.\n`;
  writeFileSync(join(GENERATED, 'ramprasad-report.md'), report);

  console.log(`Complete import: ${songs.length} songs; ${allWords.length} lyric forms; ${reviewedWords.length} reviewed; ${pendingWords.length} pending.`);
  return { ...base, meta, songs, allWords, reviewedWords, pendingWords, scriptAdditions };
}

function parseArguments(argv) {
  const index = argv.indexOf('--source');
  return { sourceDir: index >= 0 ? argv[index + 1] || '' : '' };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) completeSync(parseArguments(process.argv.slice(2)));
