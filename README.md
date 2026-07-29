# বাংলা সাধনা · Bengali Sadhana

An installable, offline-first Bengali learning PWA for short daily study, practical speech, spaced-repetition review and devotional immersion through Ramprasad Sen songs.

## v1.4 spaced-repetition review

- Dedicated **Review** screen and Today-screen due-card summary.
- Tests generated automatically from the canonical script and vocabulary content.
- Bengali script → Roman pronunciation recognition.
- Bengali word → English meaning recognition.
- English meaning → Bengali word recall.
- Reviewed Ramprasad lyric vocabulary participates in both directions.
- Pending lyric words remain in the reading library but are excluded from exact-meaning tests.
- Maximum 20 cards per session and 5 new cards per day.
- `Again`, `Hard`, `Good` and `Easy` ratings update future review intervals.
- Scheduling, accuracy and recent session history are saved locally on the phone.
- The complete review engine works offline.

See [`docs/srs-review.md`](docs/srs-review.md) for the scheduling and storage model.

## v1.3 content expansion

- Complete foundational Bengali script inventory: standard and rare vowels, all consonants and additional letters, vowel signs, nasal and orthographic signs, Bengali numerals and a broad set of common conjunct forms.
- Every parseable numbered song file in `osg1991/RamprasadSen` is imported at build time.
- Every distinct Bengali lyric word form from those songs is added to the vocabulary library.
- Reviewed forms show exact English and Tamil word meanings.
- Forms awaiting word-level review remain visible with their song, source line and line-level English/Tamil context.

Bengali supports many productive conjunct combinations. The app includes the high-frequency foundational set rather than claiming that a finite list represents every theoretically possible conjunct.

## Source-of-truth model

```text
osg1991/RamprasadSen
        │ canonical lyrics and MP3 index
        ▼
scripts/sync-ramprasad-v13.mjs
        │ parse, normalise, tokenize and classify
        ▼
content/generated/
        │ songs + every lyric word form
        ▼
learning/srs-engine.js
        │ generate eligible test cards
        ▼
Daily lessons, libraries and spaced review
```

Unknown words are never assigned guessed word meanings. They are marked as pending until reviewed in:

```text
content/ramprasad-vocabulary.json
```

## Repository structure

```text
.
├── .github/workflows/sync-ramprasad.yml
├── content/
│   ├── base-content.js
│   ├── complete-script.js
│   ├── ramprasad-vocabulary.json
│   └── generated/
├── learning/
│   ├── srs-engine.js
│   ├── srs-app.js
│   └── srs.css
├── docs/
│   ├── content-pipeline.md
│   └── srs-review.md
├── scripts/
│   ├── sync-ramprasad-v13.mjs
│   └── validate-app.mjs
├── tests/
│   ├── complete-content.test.mjs
│   ├── srs-engine.test.mjs
│   └── sync-ramprasad.test.mjs
├── app.js
├── index.html
├── styles.css
├── sw.js
├── manifest.webmanifest
├── package.json
└── package-lock.json
```

The browser application remains framework-free. Node.js is used only for content synchronisation, tests and validation.

## First setup

```bash
git clone https://github.com/osg1991/bangali-sadhana.git
cd bangali-sadhana
npm ci
npm test
npm run validate
```

## Synchronise from RamprasadSen

With adjacent checkouts:

```bash
cd ~/Work/Github
git clone https://github.com/osg1991/RamprasadSen.git
git clone https://github.com/osg1991/bangali-sadhana.git
cd bangali-sadhana
npm ci
npm run sync:ramprasad -- --source ../RamprasadSen
npm test
npm run validate
```

Without a source path, `npm run build` clones the public archive into `.cache/RamprasadSen`.

After each sync, inspect:

```text
content/generated/ramprasad-report.md
content/generated/ramprasad-unmapped-words.json
```

Add verified English and Tamil meanings to `content/ramprasad-vocabulary.json`, rerun the importer and commit the generated changes.

## Automatic synchronisation

The GitHub Actions workflow runs weekly, can be started manually, imports all currently available numbered song files, runs tests and validation, and commits generated content only when it changed.

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy free with Cloudflare Pages

The repository can remain private.

```text
Production branch: main
Framework preset: None
Build command: leave blank
Build output directory: /
Root directory: /
```

## Install on Android

1. Open the deployed site in Chrome or Samsung Internet.
2. Select **Install app** or **Add to Home screen**.
3. Open the installed app once while online.

The application shell, lessons and SRS review work offline. MP3 recordings are fetched from the source archive and cached after first playback.

## Validation

```bash
npm test
npm run validate
```

## Licence

No open-source licence has been selected yet. Add a `LICENSE` file before accepting external redistribution or contributions.
