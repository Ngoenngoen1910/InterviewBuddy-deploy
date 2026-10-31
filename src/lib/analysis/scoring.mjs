import { AnalysisError, invalidAiResponse } from './errors.mjs';
import { LIMITS } from './contracts.mjs';

export const SCORING_VERSION = 'weighted-skills-v1';
export const WEIGHTS = Object.freeze({ required: 2, preferred: 1 });

const aliases = new Map([
  ['js', 'javascript'], ['ts', 'typescript'],
  ['nodejs', 'node.js'], ['node js', 'node.js'],
  ['reactjs', 'react'], ['react.js', 'react'],
  ['postgres', 'postgresql'], ['powerbi', 'power bi'],
]);

function normalize(value) {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('en-US');
}

function canonicalSkill(value) {
  const normalized = normalize(value);
  return aliases.get(normalized) ?? normalized;
}

function isText(value, max, allowEmpty = false) {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0);
}

function exactEvidence(source, quotation) {
  return normalize(source).includes(normalize(quotation));
}

function validateCoachingItems(items, allowedSkills, required, adviceMax = 500) {
  if (!Array.isArray(items) || items.length > 3 || (required && items.length === 0)) {
    throw invalidAiResponse();
  }
  const seen = new Set();
  return items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)
        || Object.keys(item).some((key) => !['skill', 'advice'].includes(key))
        || !isText(item.skill, 160) || !isText(item.advice, adviceMax)) {
      throw invalidAiResponse();
    }
    const key = canonicalSkill(item.skill);
    const requirement = allowedSkills.get(key);
    if (!requirement || seen.has(key)) throw invalidAiResponse();
    seen.add(key);
    return { skill: requirement.skill, advice: item.advice.trim() };
  });
}

export function scoreAnalysis(raw, input) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || !Array.isArray(raw.requirements) || raw.requirements.length > LIMITS.maxRequirements
      || !isText(raw.summary, 2000)
      || !raw.coaching || typeof raw.coaching !== 'object' || Array.isArray(raw.coaching)
      || Object.keys(raw).some((key) => !['requirements', 'summary', 'coaching'].includes(key))
      || Object.keys(raw.coaching).some((key) => !['beforeInterview', 'improvements', 'strengths'].includes(key))) {
    throw invalidAiResponse();
  }
  if (raw.requirements.length === 0) {
    throw new AnalysisError('NO_JOB_REQUIREMENTS', 'No assessable job skills were found. Please provide a more detailed JD.', 422);
  }

  const distinct = new Map();
  const fields = new Set(['skill', 'importance', 'matched', 'jdEvidence', 'cvEvidence', 'reason']);
  for (const item of raw.requirements) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
        || Object.keys(item).some((key) => !fields.has(key))
        || !isText(item.skill, 160) || !Object.hasOwn(WEIGHTS, item.importance)
        || typeof item.matched !== 'boolean' || !isText(item.jdEvidence, 1500)
        || !isText(item.cvEvidence, 1500, true) || !isText(item.reason, 1200)
        || !exactEvidence(input.jdText, item.jdEvidence)
        || (item.matched && (!item.cvEvidence.trim() || !exactEvidence(input.cvText, item.cvEvidence)))
        || (!item.matched && item.cvEvidence.trim())) {
      throw invalidAiResponse();
    }
    const requirement = {
      skill: item.skill.trim(),
      importance: item.importance,
      matched: item.matched,
      jdEvidence: item.jdEvidence.trim(),
      cvEvidence: item.cvEvidence.trim(),
      reason: item.reason.trim(),
    };
    const key = canonicalSkill(requirement.skill);
    const previous = distinct.get(key);
    if (!previous) {
      distinct.set(key, requirement);
    } else {
      // A repeated alias cannot double the score. Preserve the strongest JD
      // priority and any match backed by an exact quotation from the CV.
      const chosen = previous.matched ? previous : requirement;
      const importance = previous.importance === 'required' || requirement.importance === 'required'
        ? 'required' : 'preferred';
      distinct.set(key, { ...chosen, importance });
    }
  }

  const requirements = [...distinct.values()];
  const allSkills = new Map([...distinct.entries()]);
  const missingSkills = new Map([...distinct].filter(([, item]) => !item.matched));
  const matchedSkills = new Map([...distinct].filter(([, item]) => item.matched));
  const preparationSkills = missingSkills.size > 0 ? missingSkills : matchedSkills;
  // A complete match has no gap to improve. Gemini may legitimately leave the
  // gap-focused sections empty, while strengths still need supported advice.
  const needsGapAdvice = missingSkills.size > 0;
  const coaching = {
    beforeInterview: validateCoachingItems(raw.coaching.beforeInterview, preparationSkills, needsGapAdvice, 900),
    improvements: validateCoachingItems(raw.coaching.improvements, allSkills, needsGapAdvice),
    strengths: validateCoachingItems(raw.coaching.strengths, matchedSkills, matchedSkills.size > 0, 900),
  };
  const scoreBreakdown = {
    matchedWeight: 0, totalWeight: 0,
    required: { matched: 0, total: 0, weight: WEIGHTS.required },
    preferred: { matched: 0, total: 0, weight: WEIGHTS.preferred },
  };
  for (const requirement of requirements) {
    const weight = WEIGHTS[requirement.importance];
    const category = scoreBreakdown[requirement.importance];
    category.total += 1;
    scoreBreakdown.totalWeight += weight;
    if (requirement.matched) {
      category.matched += 1;
      scoreBreakdown.matchedWeight += weight;
    }
  }
  return {
    fitScore: Math.round(10000 * scoreBreakdown.matchedWeight / scoreBreakdown.totalWeight) / 100,
    matchedSkills: requirements.filter((item) => item.matched).map((item) => item.skill),
    missingSkills: requirements.filter((item) => !item.matched).map((item) => item.skill),
    summary: raw.summary.trim(),
    coaching,
    requirements,
    scoreBreakdown,
  };
}
