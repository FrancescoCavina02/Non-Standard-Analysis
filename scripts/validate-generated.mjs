import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const catalog = JSON.parse(await readFile(path.join(root, 'src/data/generated/concepts.json'), 'utf8'));
const explanations = JSON.parse(await readFile(path.join(root, 'src/data/generated/explanations.json'), 'utf8'));
const animationKinds = new Set(['sequence', 'partition', 'chain', 'quotient', 'reasoning']);

if (catalog.schemaVersion !== 1 || explanations.schemaVersion !== 1) {
  throw new Error('Unsupported generated content schema version.');
}

const conceptSlugs = new Set();
for (const concept of catalog.concepts) {
  if (!concept.slug || conceptSlugs.has(concept.slug)) {
    throw new Error(`Duplicate or missing concept slug: ${concept.slug}`);
  }
  conceptSlugs.add(concept.slug);
  if (!concept.title || !concept.statement || !concept.sourceHash) {
    throw new Error(`Concept ${concept.slug} is missing required source fields.`);
  }
  if (!['publishable', 'review'].includes(concept.status)) {
    throw new Error(`Concept ${concept.slug} has invalid status ${concept.status}.`);
  }
  if (!animationKinds.has(concept.animation)) {
    throw new Error(`Concept ${concept.slug} has invalid animation ${concept.animation}.`);
  }
}

const explanationSlugs = new Set();
for (const explanation of explanations.explanations) {
  if (!conceptSlugs.has(explanation.slug)) {
    throw new Error(`Explanation ${explanation.slug} has no source concept.`);
  }
  if (explanationSlugs.has(explanation.slug)) {
    throw new Error(`Duplicate explanation for ${explanation.slug}.`);
  }
  explanationSlugs.add(explanation.slug);
  if (!Array.isArray(explanation.reasoningSteps) || explanation.reasoningSteps.length === 0) {
    throw new Error(`Explanation ${explanation.slug} has no reasoning steps.`);
  }
  if (!animationKinds.has(explanation.animation)) {
    throw new Error(`Explanation ${explanation.slug} has invalid animation ${explanation.animation}.`);
  }
}

console.log(`Validated ${catalog.concepts.length} concepts and ${explanations.explanations.length} explanation drafts.`);
