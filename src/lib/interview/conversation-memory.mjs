// Pure server-side projection of validated, persisted history. The full history
// remains authoritative for limits, topic selection and output deduplication.
export const CONVERSATION_MEMORY_VERSION = 'last-four-extractive-v1';
export const RECENT_TURN_LIMIT = 4;
export const SUMMARY_CHARACTER_LIMIT = 6000;
const MAX_EXCERPTS = 6;

function excerpt(text, limit) {
  const characters = Array.from(text);
  return characters.length <= limit ? text : characters.slice(0, limit - 1).join('') + '…';
}

/** Pass validated InterviewerInput.history; never accept a client-supplied summary. */
export function buildConversationMemory(history) {
  const earlier = history.slice(0, Math.max(0, history.length - RECENT_TURN_LIMIT));
  const completedTurns = history.slice(-RECENT_TURN_LIMIT).map((turn) => ({ ...turn }));
  if (!earlier.length) return { completedTurns, conversationSummary: null };

  const coverage = new Map();
  for (const turn of earlier) {
    const item = coverage.get(turn.topic) ?? { topic: turn.topic, mainQuestions: 0, followUps: 0 };
    item[turn.kind === 'main' ? 'mainQuestions' : 'followUps']++;
    coverage.set(turn.topic, item);
  }
  const summary = {
    version: CONVERSATION_MEMORY_VERSION,
    source: 'server-extractive',
    earlierTurnCount: earlier.length,
    coverage: [...coverage.values()],
    coverageClipped: false,
    excerpts: [],
    omittedExcerptCount: earlier.length,
  };
  // Validated history has at most 12 main topics. Pathological escaped labels
  // can still exceed a short JSON budget; make that loss explicit, not silent.
  if (JSON.stringify(summary).length > SUMMARY_CHARACTER_LIMIT) {
    summary.coverage = summary.coverage.map((item) => ({ ...item, topic: excerpt(item.topic, 64) }));
    summary.coverageClipped = true;
  }
  for (let index = earlier.length - 1; index >= 0 && summary.excerpts.length < MAX_EXCERPTS; index--) {
    const turn = earlier[index];
    const question = excerpt(turn.question, 160);
    const answer = excerpt(turn.answer, 240);
    const note = { turn: index + 1, question, answer,
      clipped: question !== turn.question || answer !== turn.answer };
    const candidate = { ...summary, excerpts: [note, ...summary.excerpts],
      omittedExcerptCount: earlier.length - summary.excerpts.length - 1 };
    if (JSON.stringify(candidate).length <= SUMMARY_CHARACTER_LIMIT) Object.assign(summary, candidate);
  }
  return { completedTurns, conversationSummary: summary };
}
