# Ramprasad content pipeline

## Goal

`osg1991/RamprasadSen` remains the canonical archive for song Markdown and MP3 references. Bengali Sadhana imports a normalized snapshot at build time and uses reviewed lyric vocabulary in daily lessons.

```text
RamprasadSen Markdown + README audio index
                  │
                  ▼
       scripts/sync-ramprasad.mjs
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
normalized songs       Bengali word forms
        │                    │
        │          reviewed vocabulary map
        │                    │
        └─────────┬──────────┘
                  ▼
 content/generated/ramprasad-content.js
                  │
                  ▼
 Bengali Sadhana daily lessons and song library
```

## Why a reviewed vocabulary map is required

The source songs normally provide line-level translations. A line translation does not reliably establish the meaning of every individual Bengali word. The importer therefore does not guess word meanings.

`content/ramprasad-vocabulary.json` is the reviewed bilingual dictionary. During synchronization, the importer:

1. Tokenizes every Bengali lyric line.
2. Matches tokens and aliases against the reviewed dictionary.
3. Publishes matched words with English and Tamil meanings.
4. Records their frequency, songs and example line.
5. Writes unmatched forms to `ramprasad-unmapped-words.json` and the Markdown report.

This makes vocabulary expansion reviewable and deterministic.

## Generated files

- `ramprasad-songs.json`: normalized song metadata, verses and aligned line meanings.
- `ramprasad-words.json`: reviewed Bengali words found in the current song source.
- `ramprasad-unmapped-words.json`: forms that still need review.
- `ramprasad-meta.json`: source commit and counts.
- `ramprasad-content.js`: browser-ready bundle loaded by the PWA.
- `ramprasad-report.md`: human-readable curation report.

Do not edit generated files manually.

## Daily lesson selection

Every daily lesson selects:

- three practical words from the base vocabulary;
- two reviewed lyric words associated with that day’s Ramprasad song whenever possible.

If a song has fewer than two reviewed words, the app falls back to the complete lyric-vocabulary pool.

## Add new word meanings

1. Open `content/generated/ramprasad-report.md`.
2. Review a word under **Highest-frequency unmapped forms** in its lyric context.
3. Add a dictionary entry to `content/ramprasad-vocabulary.json`:

```json
{
  "bengali": "ভক্তি",
  "roman": "bhôkti",
  "englishMeaning": "devotion",
  "tamilMeaning": "பக்தி",
  "aliases": []
}
```

4. Run the importer again.
5. Review the generated diff and run tests.

## Parser behaviour

The source collection contains more than one Markdown layout. The parser supports:

- labelled `Bengali`, `iTrans`, `Tamil Meaning`, and `English Meaning` blocks;
- grouped unlabelled Bengali, roman, Tamil and English lines;
- alternating Bengali → roman → English lines;
- Unicode normalization and common apostrophe/spaced-letter variants.

Files without a detectable Bengali lyric line are listed under **Parse failures** in the report.
