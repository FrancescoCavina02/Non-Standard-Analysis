import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const generatedDirectory = path.join(root, 'src/data/generated');
const conceptsPath = path.join(generatedDirectory, 'concepts.json');
const explanationsPath = path.join(generatedDirectory, 'explanations.json');
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
const maxConcepts = Number.parseInt(process.env.MAX_CONCEPTS || '8', 10);
const allowedAnimations = new Set(['sequence', 'partition', 'chain', 'quotient', 'reasoning']);

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is required when AI drafting is enabled.');
}

const catalog = JSON.parse(await readFile(conceptsPath, 'utf8'));
let saved = { schemaVersion: 1, explanations: [] };
try {
  saved = JSON.parse(await readFile(explanationsPath, 'utf8'));
} catch {
  // Start a new draft catalog.
}

const existing = new Map(saved.explanations.map((entry) => [entry.slug, entry]));
const currentSlugs = new Set(catalog.concepts.map((concept) => concept.slug));
for (const slug of existing.keys()) {
  if (!currentSlugs.has(slug)) existing.delete(slug);
}
const changed = catalog.concepts
  .filter((concept) => concept.status === 'publishable')
  .filter((concept) => existing.get(concept.slug)?.sourceHash !== concept.sourceHash)
  .slice(0, maxConcepts);

function responseText(response) {
  if (response.output_text) return response.output_text;
  return response.output
    ?.flatMap((item) => item.content || [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('\n');
}

function validate(value, concept) {
  if (!value || typeof value !== 'object') throw new Error(`Invalid draft for ${concept.slug}.`);
  if (typeof value.summary !== 'string' || typeof value.intuition !== 'string') {
    throw new Error(`Draft for ${concept.slug} is missing summary or intuition.`);
  }
  if (!Array.isArray(value.reasoningSteps) || value.reasoningSteps.some((step) => typeof step !== 'string')) {
    throw new Error(`Draft for ${concept.slug} has invalid reasoning steps.`);
  }
  if (!allowedAnimations.has(value.animation)) value.animation = concept.animation;
  return {
    slug: concept.slug,
    sourceHash: concept.sourceHash,
    summary: value.summary,
    intuition: value.intuition,
    reasoningSteps: value.reasoningSteps.slice(0, 6),
    animation: value.animation,
    animationCaption: String(value.animationCaption || ''),
    caution: String(value.caution || ''),
    generatedBy: model,
  };
}

for (const concept of changed) {
  const prompt = `You are drafting a reviewable concept explanation for a rigorous mathematics website about non-standard analysis.

The LaTeX notes are the only source of truth. Do not silently repair, strengthen, or invent a claim. Explain the intuition separately from the formal statement. If a mathematical caveat is needed, put it in caution. Return JSON only with this shape:
{"summary":"...","intuition":"...","reasoningSteps":["..."],"animation":"sequence|partition|chain|quotient|reasoning","animationCaption":"...","caution":"..."}

Section: ${concept.sectionTitle}
Type: ${concept.type}
Title: ${concept.title}
Source statement:
${concept.statement}

Supporting context from the notes, which may include a proof or author annotation:
${concept.sourceContext}`;

  const request = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'concept_explanation',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              intuition: { type: 'string' },
              reasoningSteps: { type: 'array', items: { type: 'string' } },
              animation: {
                type: 'string',
                enum: ['sequence', 'partition', 'chain', 'quotient', 'reasoning'],
              },
              animationCaption: { type: 'string' },
              caution: { type: 'string' },
            },
            required: ['summary', 'intuition', 'reasoningSteps', 'animation', 'animationCaption', 'caution'],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!request.ok) {
    throw new Error(`OpenAI request failed for ${concept.slug}: ${request.status} ${await request.text()}`);
  }

  const response = await request.json();
  const raw = responseText(response)?.replace(/^```json\s*|\s*```$/g, '');
  const draft = validate(JSON.parse(raw), concept);
  existing.set(concept.slug, draft);
  console.log(`Drafted ${concept.slug}.`);
}

await mkdir(generatedDirectory, { recursive: true });
await writeFile(
  explanationsPath,
  `${JSON.stringify({ schemaVersion: 1, explanations: [...existing.values()] }, null, 2)}\n`,
);

console.log(changed.length === 0 ? 'No changed publishable concepts need AI drafts.' : `Generated ${changed.length} AI drafts.`);
