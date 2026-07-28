(() => {
  'use strict';

  const base = window.BENGALI_BASE_CONTENT || { script: [], words: [], sentences: [] };
  const additions = [
    ['Rare Sanskrit vowels','ঌ','li','ऌ','லி','ঌ','li','rare Sanskrit vocalic l'],
    ['Rare Sanskrit vowels','ৠ','rī','ॠ','ரீ','ৠ','rī','rare Sanskrit long vocalic r'],
    ['Rare Sanskrit vowels','ৡ','lī','ॡ','லீ','ৡ','lī','rare Sanskrit long vocalic l'],
    ['Additional letters and signs','ড়','ṛa','ड़','ற','বড়','bôṛo','big'],
    ['Additional letters and signs','ঢ়','ṛha','ढ़','ற்ஹ','গাঢ়','gāṛho','deep or dense'],
    ['Additional letters and signs','য়','ẏa','य','ய','সময়','sômôẏ','time'],
    ['Additional letters and signs','ৎ','t','त्','த்','সৎ','sôt','honest'],
    ['Additional letters and signs','ং','ṃ or ṅ','ं','ம்/ங்','বাংলা','bāṅlā','anusvara or nasal sound'],
    ['Additional letters and signs','ঃ','ḥ','ः','ஃ','দুঃখ','duḥkho','visarga or breath sound'],
    ['Additional letters and signs','ঁ','nasal','ँ','ஂ','চাঁদ','cā̃d','chandrabindu or nasalisation'],
    ['Vowel signs','ৃ','ri','ृ','ிரு','কৃষ্ণ','kriṣṇo','vocalic r sign'],
    ['Rare vowel signs','ৄ','rī','ॄ','','ৄ','rī','rare long vocalic r sign'],
    ['Rare vowel signs','ৢ','li','ॢ','','ৢ','li','rare vocalic l sign'],
    ['Rare vowel signs','ৣ','lī','ॣ','','ৣ','lī','rare long vocalic l sign'],
    ['Orthographic signs','্','hasanta','्','்','ক্','k','suppresses the inherent vowel'],
    ['Orthographic signs','়','nukta','़','','ড়','ṛa','forms modified letters']
  ];

  const numerals = [
    ['০','0','०','௦','শূন্য','śūnyo','zero'], ['১','1','१','௧','এক','ek','one'],
    ['২','2','२','௨','দুই','dui','two'], ['৩','3','३','௩','তিন','tin','three'],
    ['৪','4','४','௪','চার','cār','four'], ['৫','5','५','௫','পাঁচ','pā̃c','five'],
    ['৬','6','६','௬','ছয়','chôẏ','six'], ['৭','7','७','௭','সাত','sāt','seven'],
    ['৮','8','८','௮','আট','āṭ','eight'], ['৯','9','९','௯','নয়','nôẏ','nine']
  ];

  const conjuncts = `ক্ক ক্ট ক্ত ক্ব ক্ম ক্র ক্ল ক্ষ গ্ধ গ্ন গ্র গ্ল ঙ্ক ঙ্খ ঙ্গ ঙ্ঘ চ্চ চ্ছ চ্য জ্জ জ্ঞ জ্ব ঞ্চ ঞ্ছ ঞ্জ ট্ট ট্ঠ ট্র ড্ড ড্র ণ্ট ণ্ঠ ণ্ড ণ্ণ ত্ত ত্থ ত্ন ত্ম ত্র ত্ব দ্গ দ্ঘ দ্দ দ্ধ দ্ব দ্র ন্ত ন্থ ন্দ ন্ধ ন্ন ন্ম ন্ত্র প্ট প্ত প্ন প্প প্র প্ল ফ্র ব্জ ব্দ ব্ধ ব্র ব্ল ভ্র ম্ন ম্প ম্ফ ম্ব ম্ভ ম্ম ম্র ম্ল ল্ক ল্গ ল্ট ল্ড ল্প ল্ব ল্ম ল্ল শ্চ শ্ন শ্ম শ্র শ্ল ষ্ক ষ্ট ষ্ঠ ষ্ণ ষ্প ষ্ফ ষ্ম স্ক স্খ স্ট স্ত স্থ স্ন স্প স্ফ স্ম স্র স্ব হ্ণ হ্ন হ্ম হ্র হ্ল ক্য খ্য গ্য ঘ্য চ্য জ্য ত্য থ্য দ্য ধ্য ন্য প্য ব্য ভ্য ম্য ল্য শ্য ষ্য স্য হ্য র্ক র্গ র্চ র্জ র্ণ র্ত র্দ র্ধ র্ম র্য র্শ র্ষ র্স`.split(/\s+/u);

  const roman = { ক:'k', খ:'kh', গ:'g', ঘ:'gh', ঙ:'ṅ', চ:'c', ছ:'ch', জ:'j', ঝ:'jh', ঞ:'ñ', ট:'ṭ', ঠ:'ṭh', ড:'ḍ', ঢ:'ḍh', ণ:'ṇ', ত:'t', থ:'th', দ:'d', ধ:'dh', ন:'n', প:'p', ফ:'ph', ব:'b', ভ:'bh', ম:'m', য:'y', র:'r', ল:'l', শ:'ś', ষ:'ṣ', স:'s', হ:'h', '্':'' };
  const devanagari = { ক:'क', খ:'ख', গ:'ग', ঘ:'घ', ঙ:'ङ', চ:'च', ছ:'छ', জ:'ज', ঝ:'झ', ঞ:'ञ', ট:'ट', ঠ:'ठ', ড:'ड', ঢ:'ढ', ণ:'ण', ত:'त', থ:'थ', দ:'द', ধ:'ध', ন:'न', প:'प', ফ:'फ', ব:'ब', ভ:'भ', ম:'म', য:'य', র:'र', ল:'ल', শ:'श', ষ:'ष', স:'स', হ:'ह', '্':'्' };

  const items = additions.map(([group,bengali,romanValue,devanagariValue,tamil,example,exampleRoman,meaning]) => ({
    group, bengali, roman: romanValue, devanagari: devanagariValue, tamil, example, exampleRoman, meaning
  }));

  items.push(...numerals.map(([bengali,romanValue,devanagariValue,tamil,example,exampleRoman,meaning]) => ({
    group: 'Bengali numerals', bengali, roman: romanValue, devanagari: devanagariValue, tamil, example, exampleRoman, meaning
  })));

  items.push(...conjuncts.map(bengali => ({
    group: 'Common conjuncts',
    bengali,
    roman: [...bengali].map(character => roman[character] ?? '').join(''),
    devanagari: [...bengali].map(character => devanagari[character] ?? '').join(''),
    tamil: '',
    example: bengali,
    exampleRoman: '',
    meaning: 'conjunct consonant form'
  })));

  const seen = new Set((base.script || []).map(item => item.bengali.normalize('NFC')));
  base.script = [...(base.script || []), ...items.filter(item => !seen.has(item.bengali.normalize('NFC')))];
  window.BENGALI_BASE_CONTENT = base;
})();
