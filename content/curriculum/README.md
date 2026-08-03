# Topic curriculum authoring

Each weekly lesson is stored as one readable Markdown file under `content/curriculum/<level>/`.

## File naming

```text
week-20-common-adjectives.md
week-21-<topic-slug>.md
```

## Required front matter

```yaml
---
id: a1-week-20-common-adjectives
level: A1
week: 20
sequence: 20
topic: Common Adjectives
status: reviewed
source: User-supplied learning email
prerequisite: foundation-mixed-alphabets
---
```

## Supported sections

Use these headings and table columns exactly. Empty Tamil cells are allowed during initial capture, but reviewed lessons should fill them before release.

### Functional Language

Group expressions by communicative purpose with a level-three heading.

```markdown
## Functional Language
### Congratulating
| ID | Register | Bengali | Romanization | Literal gloss | English | Tamil |
```

### Vocabulary

```markdown
## Vocabulary
| ID | Bengali | Romanization | English | Tamil | Part of speech | Opposite ID |
```

### Numbers

```markdown
## Numbers
| ID | Bengali | Romanization | Numeric value | English | Tamil |
```

### Situation Patterns

```markdown
## Situation Patterns
| ID | Register | Bengali | Romanization | Literal gloss | English | Tamil |
```

### Mini-Dialogues

Each dialogue gets its own level-three heading.

```markdown
## Mini-Dialogues
### Dialogue 1 — Topic
| Turn | Speaker | Register | Bengali | Romanization | Literal gloss | English | Tamil |
```

## Stable IDs

IDs are the SRS identity. Once released, do not rename an ID merely to improve wording. Correct the Bengali, romanization or translation while preserving the ID so learner progress survives content updates.

## Adding another week

1. Copy the nearest existing weekly Markdown file.
2. Change the front-matter ID, week, sequence and topic.
3. Replace the section rows while keeping stable, descriptive IDs.
4. Run the curriculum generator, tests and validation.
5. Review `content/generated/curriculum-report.md` before committing.

## Build

```bash
npm run sync:curriculum
npm test
npm run validate
```

The importer generates:

- `content/generated/curriculum-content.json`
- `content/generated/curriculum-content.js`
- `content/generated/curriculum-report.md`
