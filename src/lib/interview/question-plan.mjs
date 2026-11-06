// SCRUM-92: a small, deterministic context selector inspired by EZInterviewer
// and PolyInterview. Lexical overlap selects context; it does NOT prove a skill.
export const QUESTION_PLAN_VERSION = 'jd-cv-context-v3';
const stopWords = new Set(('the and with for from that this have your you are job role work experience skills ' +
  'của và với cho trong một các những được cần có bạn công việc yêu cầu kinh nghiệm').split(/\s+/u));
const shortTechnologies = new Set(['go', 'c#', 'ui', 'ux', 'qa', 'ai', 'ml', 'ci', 'cd']);
const aliases = new Map([['js', 'javascript'], ['ts', 'typescript'], ['nodejs', 'node.js'],
  ['reactjs', 'react'], ['postgres', 'postgresql'], ['.net', 'dotnet'], ['csharp', 'c#'], ['cpp', 'c++']]);
const headings = new Set(['requirements', 'required skills', 'skills', 'qualifications', 'responsibilities',
  'job description', 'preferred skills', 'yêu cầu', 'yêu cầu ứng viên', 'kỹ năng', 'trách nhiệm', 'mô tả công việc']);

function headingKey(text) {
  return text.normalize('NFKC').toLocaleLowerCase('en-US').replace(/^\s*[-*•]+\s*/u, '')
    .replace(/[:.!?]+\s*$/u, '').replace(/\s+/gu, ' ').trim();
}
function isHeading(text, position) {
  const key = headingKey(text);
  const title = key.replace(/^(?:vị trí|position|job title|target position|role)\s*:\s*/u, '');
  return headings.has(key) || title === headingKey(position);
}

function terms(text) {
  return new Set((text.normalize('NFKC').toLocaleLowerCase('en-US')
    .match(/\.net\b|[\p{L}\p{N}]+(?:\.[\p{L}\p{N}]+)*(?:\+\+|#)?/gu) || [])
    .map((word) => aliases.get(word) ?? word)
    .filter((word) => (word.length >= 3 || shortTechnologies.has(word)) && !stopWords.has(word)));
}
function overlap(a, b) { return [...a].filter((word) => b.has(word)).length; }
function passages(text) {
  // Preserve exact source passages, including negation. Full documents remain
  // in the request even when a passage is too long for this optional selector.
  return text.split(/\r?\n|;|(?<=[.!?])\s+/u).map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 1500 && terms(s).size > 0);
}

export function planQuestion(input) {
  const previousTopics = input.history.map((turn) => terms(`${turn.topic} ${turn.question}`));
  const cv = passages(input.cvText || '').map((text) => ({ text, terms: terms(text) }));
  const ranked = passages(input.jdText || '').filter((text) => !isHeading(text, input.settings.targetPosition)).map((text, index) => {
    const tokens = terms(text);
    const covered = previousTopics.reduce((max, topic) => Math.max(max, overlap(tokens, topic)), 0);
    return { text, tokens, index, covered };
  }).sort((a, b) => a.covered - b.covered || a.index - b.index);
  const focus = ranked[0];
  const related = focus ? cv.map((part, index) => ({ ...part, index, score: overlap(focus.tokens, part.terms) }))
    .filter((part) => part.score > 0).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 2) : [];
  const difficultyPolicy = {
    technical: {
      easy: 'Ask one foundational concept or a straightforward example; avoid a multi-part design problem.',
      medium: 'Ask about implementation, testing, debugging or a concrete failure case at the configured role level.',
      hard: 'Present a concrete hypothetical failure or concurrency constraint and ask for a justified design trade-off in one focused question; do not assume senior experience absent from the CV.',
    },
    behavioral: {
      easy: 'Invite one straightforward real past teamwork situation at the candidate\'s experience level.',
      medium: 'Invite a real past challenge and focus on personal contribution and an observable outcome, leaving room for STAR.',
      hard: 'Invite a real past situation involving disagreement, limited time or competing priorities; focus one question on the decision and reflection. Do not invent leadership or successful outcomes.',
    },
    hr: {
      easy: 'Ask one clear job-relevant motivation or collaboration question suitable for the candidate\'s experience level.',
      medium: 'Ask for an explanation of motivation, communication or collaboration related to the target role.',
      hard: 'Probe professional judgment when priorities or expectations conflict in the target role. Ask one focused question, without assuming management experience or demanding a technical design.',
    },
  }[input.settings.type]?.[input.settings.difficulty];
  const roundPolicy = {
    technical: 'Assess job-relevant knowledge or a hypothetical implementation. Use past-project wording only for explicitly evidenced work. Do not require STAR for factual questions.',
    behavioral: 'Ask for one real past situation, leaving room for Situation, Task, Action and Result. Do not invent the candidate\'s situation or result.',
    hr: 'Ask a job-relevant motivation, collaboration or communication question; avoid private or protected personal attributes.',
  }[input.settings.type];
  return {
    version: QUESTION_PLAN_VERSION,
    basis: focus ? 'jd' : 'role',
    jdFocus: focus?.text ?? null,
    cvContext: related.map((part) => part.text),
    difficultyPolicy, roundPolicy,
  };
}
