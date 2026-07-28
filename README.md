# বাংলা সাধনা · Bengali Sadhana

An installable, offline-first Bengali learning PWA for short daily study, practical speech and devotional immersion through Ramprasad Sen songs.

## What changed in v1.2

This repository now contains a build-time content importer.

- `osg1991/RamprasadSen` remains the canonical song archive.
- The importer parses song Markdown and the README MP3 index.
- Song verses and translations are normalized into generated JSON.
- Reviewed Bengali lyric words receive English and Tamil meanings.
- Every daily lesson contains three practical words and two words from the day’s song whenever possible.
- Unknown lyric forms are written to a curation report instead of receiving guessed meanings.

The committed generated snapshot contains five starter songs and 115 reviewed lyric words. Running the importer against the complete source repository refreshes the snapshot from every parseable numbered song file.

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
│       ├── ramprasad-songs.json
│       ├── ramprasad-unmapped-words.json
│       └── ramprasad-words.json
├── docs/content-pipeline.md
├── scripts/
│   ├── sync-ramprasad.mjs
│   └── validate-app.mjs
├── tests/sync-ramprasad.test.mjs
├── app.js
├── index.html
├── styles.css
├── sw.js
├── manifest.webmanifest
├── package.json
└── package-lock.json
```

The browser application remains framework-free. Node.js is used only for content synchronization, tests and validation.

## First setup

```bash
git clone https://github.com/osg1991/bengali-sadhana.git
cd bengali-sadhana
npm ci
npm test
npm run validate
```

## Synchronize from RamprasadSen

### Method A: adjacent local checkout

```bash
cd ~/Work/Github
git clone https://github.com/osg1991/RamprasadSen.git
git clone https://github.com/osg1991/bengali-sadhana.git
cd bengali-sadhana
npm ci
npm run sync:ramprasad -- --source ../RamprasadSen
npm test
npm run validate
```

### Method B: let the script clone the source

```bash
npm ci
npm run build
```

When no source path is supplied, the script clones the public archive into `.cache/RamprasadSen`.

### Method C: environment variable

```bash
RAMPRASAD_REPO_DIR=/absolute/path/to/RamprasadSen npm run sync:ramprasad
```

## Vocabulary review workflow

Song files generally contain line-level meanings, not trustworthy word-by-word meanings. The importer therefore publishes only words present in the reviewed dictionary:

```text
content/ramprasad-vocabulary.json
```

After a sync, inspect:

```text
content/generated/ramprasad-report.md
```

Add reviewed English and Tamil meanings for useful unmapped forms, rerun the importer and commit the generated changes. See [`docs/content-pipeline.md`](docs/content-pipeline.md) for the data model and curation procedure.

## Automatic synchronization

The included GitHub Actions workflow runs weekly and can also be started manually from the **Actions** tab. It checks out both repositories, imports the current songs, runs tests, and commits `content/generated/` only when it changed.

## Run the PWA locally

A service worker requires HTTP rather than opening `index.html` directly.

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Deploy with GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select `main` and `/(root)`.
5. Open `https://osg1991.github.io/bengali-sadhana/`.

The generated content is committed, so GitHub Pages does not need to run Node.js or a separate build process.

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

The tests cover labelled, grouped and alternating song Markdown formats, token normalization, and README audio-link extraction.

## License

No open-source license has been selected yet. Add a `LICENSE` file before accepting external redistribution or contributions.
