import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompleteVocabulary, buildScriptAdditions } from '../scripts/sync-ramprasad-v13.mjs';

test('complete vocabulary keeps reviewed and pending lyric forms', () => {
  const songs = [{ id: '01-test', title: 'Test song', lines: [{
    bengali: 'মা অজানা মা', roman: 'mā ajānā mā',
    englishMeaning: 'Mother, the unknown, Mother',
    tamilMeaning: 'அன்னையே, அறியாதது, அன்னையே'
  }] }];
  const dictionary = new Map([['মা', {
    bengali: 'মা', roman: 'mā', englishMeaning: 'Mother', tamilMeaning: 'அன்னை'
  }]]);
  const result = buildCompleteVocabulary(songs, dictionary);
  assert.equal(result.allWords.length, 2);
  assert.equal(result.reviewedWords.length, 1);
  assert.equal(result.pendingWords.length, 1);
  assert.equal(result.reviewedWords[0].frequency, 2);
  assert.match(result.pendingWords[0].englishMeaning, /Line context/u);
  assert.equal(result.pendingWords[0].sourceLineTamilMeaning, 'அன்னையே, அறியாதது, அன்னையே');
});

test('script additions cover missing letters, signs, numerals and conjuncts', () => {
  const additions = buildScriptAdditions();
  assert.ok(additions.length >= 140);
  for (const required of ['ঌ', 'ৠ', 'ৡ', 'ড়', 'ঢ়', 'য়', 'ৎ', 'ং', 'ঃ', 'ঁ', 'ৃ', '্', '়', '০', '৯', 'ক্ষ', 'জ্ঞ', 'ত্র', 'শ্র']) {
    assert.ok(additions.some(item => item.bengali === required), `missing ${required}`);
  }
});
