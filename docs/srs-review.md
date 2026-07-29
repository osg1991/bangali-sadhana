# Spaced-repetition review

Version 1.4 adds a lightweight, offline SRS review system for Bengali script and vocabulary.

## Coverage

The review engine generates cards from the canonical content already loaded by the PWA:

- Bengali script item → Roman pronunciation
- Bengali word → English meaning
- English meaning → Bengali word
- reviewed Ramprasad lyric word → English meaning and reverse recall

Ramprasad words marked `pending` or lacking an exact reviewed word meaning are not used in exact-meaning tests. They remain visible in the song and vocabulary libraries with source-line context.

## Daily limits

- Maximum 20 cards per review session
- Maximum 5 new cards per day
- Overdue cards are presented before new cards
- `Again` cards return later in the same session when space permits

## Ratings

| Rating | Initial behaviour |
|---|---|
| Again | Due again today; ease reduced |
| Hard | Due in about one day |
| Good | One day, then three days, then ease-based growth |
| Easy | Starts with a four-day interval and grows faster |

Cards with intervals of at least 21 days are counted as mature.

## Storage

SRS progress is stored only on the device in browser `localStorage` under:

```text
bengali-sadhana-srs-v1
```

The data includes card scheduling, answer counts and the latest 30 session summaries. It is independent of the existing daily-completion state.

## Architecture

```text
learning/srs-engine.js
    pure scheduling, concept generation and question generation

learning/srs-app.js
    review dashboard, sessions, local persistence and Today-screen summary

learning/srs.css
    mobile-first review UI

tests/srs-engine.test.mjs
    scheduler, queue, filtering and question tests
```

The engine remains framework-free and is cached by the service worker for offline use.
