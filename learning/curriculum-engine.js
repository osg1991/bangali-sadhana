(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BENGALI_CURRICULUM_ENGINE = api;
  if (root.BENGALI_SRS_ENGINE) api.install(root.BENGALI_SRS_ENGINE);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function unique(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function interleave(groups) {
    const result = [];
    const max = Math.max(0, ...groups.map(group => group.length));
    for (let index = 0; index < max; index += 1) {
      for (const group of groups) if (group[index]) result.push(group[index]);
    }
    return result;
  }

  function common(unit, item, section, order) {
    return {
      curriculum: true,
      unitId: unit.id,
      unitLevel: unit.level,
      unitWeek: unit.week,
      unitTopic: unit.topic,
      section,
      curriculumOrder: order,
      trackStage: 'words',
      sourceKind: 'curriculum',
      group: `${unit.level} · Week ${unit.week} · ${unit.topic}`,
      source: item
    };
  }

  function vocabularyCards(unit) {
    return unit.vocabulary.flatMap((item, index) => {
      const base = {
        ...common(unit, item, 'Vocabulary', 1000 + index),
        conceptId: `topic:${unit.id}:vocabulary:${item.id}`,
        kind: 'curriculum',
        bengali: item.bengali,
        roman: item.roman,
        meaning: item.english,
        tamilMeaning: item.tamil,
        oppositeId: item.oppositeId
      };
      return [
        { ...base, id: `${base.conceptId}:bn-en`, direction: 'topic-bn-en', answer: item.english },
        { ...base, id: `${base.conceptId}:en-bn`, direction: 'topic-en-bn', answer: item.bengali }
      ];
    });
  }

  function functionalCards(unit) {
    return unit.functionalLanguage.flatMap((item, index) => {
      const base = {
        ...common(unit, item, `Functional · ${item.function}`, 2000 + index),
        conceptId: `topic:${unit.id}:functional:${item.id}`,
        kind: 'curriculum',
        bengali: item.bengali,
        roman: item.roman,
        meaning: item.english,
        tamilMeaning: item.tamil,
        register: item.register,
        function: item.function
      };
      return [
        { ...base, id: `${base.conceptId}:bn-en`, direction: 'topic-bn-en', answer: item.english },
        { ...base, id: `${base.conceptId}:en-bn`, direction: 'topic-en-bn', answer: item.bengali }
      ];
    });
  }

  function numberCards(unit) {
    return unit.numbers.flatMap((item, index) => {
      const base = {
        ...common(unit, item, 'Numbers', 3000 + index),
        conceptId: `topic:${unit.id}:number:${item.id}`,
        kind: 'curriculum',
        bengali: item.bengali,
        roman: item.roman,
        meaning: item.english,
        tamilMeaning: item.tamil,
        numericValue: item.numericValue
      };
      return [
        { ...base, id: `${base.conceptId}:bn-value`, direction: 'topic-number-bn-value', answer: item.english },
        { ...base, id: `${base.conceptId}:value-bn`, direction: 'topic-number-value-bn', answer: item.bengali }
      ];
    });
  }

  function patternCards(unit) {
    return unit.situationPatterns.flatMap((item, index) => {
      const base = {
        ...common(unit, item, 'Situation patterns', 4000 + index),
        conceptId: `topic:${unit.id}:pattern:${item.id}`,
        kind: 'curriculum',
        bengali: item.bengali,
        roman: item.roman,
        meaning: item.english,
        tamilMeaning: item.tamil,
        register: item.register
      };
      return [
        { ...base, id: `${base.conceptId}:bn-en`, direction: 'topic-pattern-bn-en', answer: item.english },
        { ...base, id: `${base.conceptId}:en-bn`, direction: 'topic-pattern-en-bn', answer: item.bengali }
      ];
    });
  }

  function dialogueCards(unit) {
    const cards = [];
    unit.dialogues.forEach((dialogue, dialogueIndex) => {
      dialogue.turns.forEach((turn, turnIndex) => {
        const base = {
          ...common(unit, turn, `Mini-dialogue · ${dialogue.title}`, 5000 + dialogueIndex * 100 + turnIndex),
          conceptId: `topic:${unit.id}:dialogue:${dialogue.id}:turn-${turn.turn}`,
          kind: 'curriculum',
          bengali: turn.bengali,
          roman: turn.roman,
          meaning: turn.english,
          tamilMeaning: turn.tamil,
          register: turn.register,
          speaker: turn.speaker,
          dialogueTitle: dialogue.title
        };
        cards.push({ ...base, id: `${base.conceptId}:bn-en`, direction: 'topic-dialogue-bn-en', answer: turn.english });
        if (turnIndex > 0) {
          const previous = dialogue.turns[turnIndex - 1];
          cards.push({
            ...base,
            id: `${base.conceptId}:next`,
            direction: 'topic-dialogue-next',
            promptBengali: previous.bengali,
            answer: turn.bengali
          });
        }
      });
    });
    return cards;
  }

  function unitConcepts(unit) {
    const vocab = vocabularyCards(unit);
    const functional = functionalCards(unit);
    const numbers = numberCards(unit);
    const patterns = patternCards(unit);
    const dialogues = dialogueCards(unit);
    return interleave([
      vocab.filter(card => card.direction === 'topic-bn-en'),
      vocab.filter(card => card.direction === 'topic-en-bn'),
      functional,
      numbers,
      patterns,
      dialogues
    ]);
  }

  function buildCurriculumConcepts(curriculum = root.BENGALI_CURRICULUM || {}) {
    return (curriculum.units || [])
      .slice()
      .sort((left, right) => Number(left.sequence) - Number(right.sequence))
      .flatMap(unitConcepts);
  }

  function promptFor(card) {
    const prompts = {
      'topic-bn-en': `What does ${card.bengali} mean?`,
      'topic-en-bn': `Which Bengali expression means “${card.meaning}”?`,
      'topic-number-bn-value': `What number does ${card.bengali} represent?`,
      'topic-number-value-bn': `Which Bengali expression means “${card.meaning}”?`,
      'topic-pattern-bn-en': `What does this sentence mean: ${card.bengali}`,
      'topic-pattern-en-bn': `Choose the Bengali sentence for “${card.meaning}”.`,
      'topic-dialogue-bn-en': `What does this dialogue line mean: ${card.bengali}`,
      'topic-dialogue-next': `Choose the next reply after: ${card.promptBengali}`
    };
    return prompts[card.direction] || 'Choose the correct answer.';
  }

  function curriculumQuestion(card, concepts, engine) {
    const candidates = concepts
      .filter(candidate => candidate.curriculum && candidate.id !== card.id && candidate.direction === card.direction)
      .filter(candidate => candidate.answer && candidate.answer !== card.answer);
    const sameUnit = candidates.filter(candidate => candidate.unitId === card.unitId);
    const distractors = unique([...sameUnit, ...candidates].map(candidate => candidate.answer)).slice(0, 3);
    const options = unique([...distractors, card.answer])
      .sort((left, right) => engine.stableHash(`${card.id}:${left}`) - engine.stableHash(`${card.id}:${right}`));
    const detail = [
      card.roman ? `Roman: ${card.roman}` : '',
      card.tamilMeaning ? `Tamil: ${card.tamilMeaning}` : '',
      card.register ? `Register: ${card.register}` : ''
    ].filter(Boolean).join('; ');
    return {
      cardId: card.id,
      conceptId: card.conceptId,
      kind: card.kind,
      direction: card.direction,
      prompt: promptFor(card),
      promptClass: ['topic-bn-en', 'topic-number-bn-value', 'topic-pattern-bn-en', 'topic-dialogue-bn-en', 'topic-dialogue-next'].includes(card.direction) ? 'bengali' : '',
      answer: card.answer,
      options,
      explanation: `${card.bengali} — ${card.meaning}${detail ? `; ${detail}` : ''}.`
    };
  }

  function install(engine) {
    if (!engine || engine.__curriculumInstalled) return engine;
    const originalBuildConcepts = engine.buildConcepts.bind(engine);
    const originalCreateQuestion = engine.createQuestion.bind(engine);

    engine.buildConcepts = function buildConceptsWithCurriculum(baseContent, ramprasadContent) {
      const curriculum = buildCurriculumConcepts(root.BENGALI_CURRICULUM || {});
      return [...curriculum, ...originalBuildConcepts(baseContent, ramprasadContent)];
    };

    engine.createQuestion = function createCurriculumQuestion(card, concepts) {
      return card?.curriculum ? curriculumQuestion(card, concepts, engine) : originalCreateQuestion(card, concepts);
    };

    engine.buildCurriculumConcepts = buildCurriculumConcepts;
    engine.__curriculumInstalled = true;
    return engine;
  }

  return {
    interleave,
    vocabularyCards,
    functionalCards,
    numberCards,
    patternCards,
    dialogueCards,
    unitConcepts,
    buildCurriculumConcepts,
    curriculumQuestion,
    install
  };
});
