# বাংলা সাধনা · Bengali Sadhana

An installable, offline-first Bengali learning PWA for short daily study, practical speech and devotional immersion through Ramprasad Sen songs.

## v1.3 content expansion

- Complete foundational Bengali script inventory: standard and rare vowels, all consonants and additional letters, vowel signs, nasal and orthographic signs, Bengali numerals and a broad set of common conjunct forms.
- Every parseable numbered song file in `osg1991/RamprasadSen` is imported at build time.
- Every distinct Bengali lyric word form from those songs is added to the vocabulary library.
- Reviewed forms show exact English and Tamil word meanings.
- Forms awaiting word-level review remain visible with their song, source line and line-level English/Tamil context.
- Daily lessons continue to use reviewed Ramprasad vocabulary; pending forms become eligible after their meanings are reviewed.

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
Bengali Sadhana daily lessons and libraries
```

Unknown words are never assigned guessed word meanings. They are marked as pending and retain translated source-line context until reviewed in:

```text
content/ramprasad-vocabulary.json
```

## Repository structure

```text
.
├── .github/workflows/sync-ramprasad.yml
├── content/
│   ├── base-content.js
│   ├── ramprasad-vocabulary.json
│   └── generated/
│       ├── ramprasad-content.js
│       ├── ramprasad-meta.json
│       ├── ramprasad-report.md
│       ├── ramprasad-reviewed-words.json
│       ├── ramprasad-songs.json
│       ├── ramprasad-unmapped-words.json
│       └── ramprasad-words.json
├── docs/content-pipeline.md
├── scripts/
│   ├── sync-ramprasad.mjs
│   ├── sync-ramprasad-v13.mjs
│   └── validate-app.mjs
├── tests/
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

### Adjacent local checkout

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

### Let the script clone the source

```bash
npm ci
npm run build
```

When no source path is supplied, the script clones the public archive into `.cache/RamprasadSen`.

## Vocabulary review workflow

After each sync, inspect:

```text
content/generated/ramprasad-report.md
content/generated/ramprasad-unmapped-words.json
```

Add verified English and Tamil meanings to `content/ramprasad-vocabulary.json`, rerun the importer and commit the generated changes. See [`docs/content-pipeline.md`](docs/content-pipeline.md) for the data model.

## Automatic synchronisation

The GitHub Actions workflow:

- runs whenever the v1.3 importer or reviewed dictionary changes on `main`;
- runs weekly;
- can be started manually from the **Actions** tab;
- checks out both repositories;
- imports all currently available numbered song files;
- runs tests and validates the PWA;
- commits `content/generated/` only when the generated content changed.

## Run locally

A service worker requires HTTP rather than opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy free with Cloudflare Pages

The repository can remain private.

1. Open **Cloudflare Dashboard → Workers & Pages**.
2. Select **Create application → Pages → Connect to Git**.
3. Authorise and select `osg1991/bangali-sadhana`.
4. Use:

```text
Production branch: main
Framework preset: None
Build command: leave blank
Build output directory: /
Root directory: /
```

Cloudflare redeploys whenever GitHub receives generated content updates.

## Install on Android

1. Open the deployed site in Chrome or Samsung Internet.
2. Select **Install app** or **Add to Home screen**.
3. Open the installed app once while online.

The app shell and generated learning content then work offline. MP3 recordings are fetched from the source archive and cached after first playback.

## Validation

```bash
npm test
npm run validate
```

## Licence

No open-source licence has been selected yet. Add a `LICENSE` file before accepting external redistribution or contributions.
