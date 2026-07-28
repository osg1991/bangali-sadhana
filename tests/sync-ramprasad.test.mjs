import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReadmeIndex, parseSongMarkdown, tokenizeBengali } from '../scripts/sync-ramprasad.mjs';

test('parses labelled Bengali, Roman, Tamil and English sections', () => {
  const parsed = parseSongMarkdown(`---\ntitle: Test Song\n---\n### Verse 1\n**Bengali:**\nমা আমায় ডাকো।\n**iTrans:**\nmā āmāẏ ḍāko\n**Tamil Meaning:**\nஅம்மா, என்னை அழை.\n**English Meaning:**\nMother, call me.\n`);
  assert.equal(parsed.title, 'Test Song');
  assert.equal(parsed.verses.length, 1);
  assert.deepEqual(parsed.verses[0].bengali, ['মা আমায় ডাকো।']);
  assert.deepEqual(parsed.verses[0].roman, ['mā āmāẏ ḍāko']);
  assert.deepEqual(parsed.verses[0].tamilMeaning, ['அம்மா, என்னை அழை.']);
  assert.deepEqual(parsed.verses[0].englishMeaning, ['Mother, call me.']);
});

test('parses grouped unlabelled verse layouts', () => {
  const parsed = parseSongMarkdown(`**Verse 1**\nমন রে কৃষিকাজ জানো না\nএমন মানব জমিন\nmon re kṛṣikāj jāno nā\nemon mānob jamin\nமனமே, உழவு தெரியாதா?\nஇத்தகைய மனித நிலம்\nO mind, do you not know cultivation?\nSuch a human field\n`);
  assert.equal(parsed.verses.length, 1);
  assert.deepEqual(parsed.verses[0].bengali, ['মন রে কৃষিকাজ জানো না', 'এমন মানব জমিন']);
  assert.deepEqual(parsed.verses[0].roman, ['mon re kṛṣikāj jāno nā', 'emon mānob jamin']);
  assert.equal(parsed.verses[0].tamilMeaning.length, 2);
  assert.equal(parsed.verses[0].englishMeaning.length, 2);
});

test('parses alternating Bengali, roman and English lines', () => {
  const parsed = parseSongMarkdown(`আমার মা ত্বং হি তারা\nAmar Maa Tvam hi tara\nMy Mother, Thou art Tara\nতুমি জলে তুমি স্থলে\nTumi jale Tumi sthale\nYou are in water and on land\n`);
  assert.equal(parsed.verses.length, 2);
  assert.equal(parsed.verses[0].roman[0], 'Amar Maa Tvam hi tara');
  assert.equal(parsed.verses[0].englishMeaning[0], 'My Mother, Thou art Tara');
});

test('tokenizer joins apostrophised and spaced Bengali forms', () => {
  assert.deepEqual(tokenizeBengali("ক’রে ল'য়ে পরা ৎ পরা"), ['করে', 'লয়ে', 'পরাৎপরা']);
});

test('reads song and audio paths from README table', () => {
  const index = parseReadmeIndex('| 1 | [Song](https://github.com/osg1991/RamprasadSen/blob/main/01-Song.md) | - | [MP3](https://github.com/osg1991/RamprasadSen/blob/main/assets/mp3/01%20Song.mp3) |');
  assert.deepEqual(index.get('01-Song.md'), { displayTitle: 'Song', audioPath: 'assets/mp3/01 Song.mp3' });
});
