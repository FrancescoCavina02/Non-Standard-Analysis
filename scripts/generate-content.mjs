import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceDirectory = path.join(root, 'notes/source');
const outputDirectory = path.join(root, 'src/data/generated');
const theoremCommands = new Set(['defn', 'prop', 'thm', 'lem', 'cor', 'eg', 'example', 'rem', 'axm']);
const typeLabels = {
  defn: 'Definition',
  prop: 'Proposition',
  thm: 'Theorem',
  lem: 'Lemma',
  cor: 'Corollary',
  eg: 'Example',
  example: 'Example',
  rem: 'Remark',
  axm: 'Axiom',
};

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'untitled';
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function readBalanced(text, openingBrace) {
  let depth = 0;
  let math = false;
  for (let index = openingBrace; index < text.length; index += 1) {
    const character = text[index];
    const escaped = index > 0 && text[index - 1] === '\\';
    if (character === '$' && !escaped) math = !math;
    if (math) continue;
    if (character === '{' && !escaped) depth += 1;
    if (character === '}' && !escaped) {
      depth -= 1;
      if (depth === 0) {
        return { body: text.slice(openingBrace + 1, index), end: index + 1 };
      }
    }
  }
  return null;
}

function stripSimpleCommands(value) {
  let result = value;
  const wrappers = ['textit', 'textbf', 'emph', 'underline'];
  for (let pass = 0; pass < 4; pass += 1) {
    for (const wrapper of wrappers) {
      result = result.replace(new RegExp(`\\\\${wrapper}\\{([^{}]*)\\}`, 'g'), ' $1 ');
    }
  }
  return result;
}

function cleanLatex(value) {
  return stripSimpleCommands(value)
    .replace(/\\label\{[^}]*\}/g, '')
    .replace(/\\(?:ref|eqref|autoref)\{([^}]*)\}/g, '$1')
    .replace(/\\cite\{([^}]*)\}/g, '[$1]')
    .replace(/\\textcolor\{[^}]+\}\{/g, '')
    .replace(/\\begin\{proof\}/g, 'Proof. ')
    .replace(/\\end\{proof\}/g, '')
    .replace(/\\begin\{equation\*?\}/g, '$$')
    .replace(/\\end\{equation\*?\}/g, '$$')
    .replace(/\\begin\{(?:enumerate|itemize|center)\}|\\end\{(?:enumerate|itemize|center)\}/g, '')
    .replace(/\\item\s*/g, ' • ')
    .replace(/\\newline/g, '\n')
    .replace(/\\noindent/g, '')
    .replace(/\\coloneqq/g, ':=')
    .replace(/\\iff/g, 'if and only if')
    .replace(/\\fa\b/g, '\\forall')
    .replace(/\\Ns\b/g, '\\mathbb{N}')
    .replace(/\\Rs\b/g, '\\mathbb{R}')
    .replace(/\\call\{([^}]*)\}/g, '\\mathcal{$1}')
    .replace(/\\abs\{([^{}]*)\}/g, '|$1|')
    .replace(/\\seq\{([^{}]*)\}/g, '{$1_n}')
    .replace(/\\([#$%&_])/g, '$1')
    .replace(/(^|[^\\])%.*$/gm, '$1')
    .replace(/\}\s*[.,]?\s*$/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function plainTitle(value) {
  return cleanLatex(value)
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
    .replace(/\\suc\{([^}]*)\}/g, '$1++')
    .replace(/\\str\{([^}]*)\}/g, '*$1')
    .replace(/\\leftindex\^\*\s*/g, '*')
    .replace(/\\varepsilon/g, 'ε')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\equiv/g, '≡')
    .replace(/\\subseteq/g, '⊆')
    .replace(/\\notin/g, '∉')
    .replace(/\\in\b/g, '∈')
    .replace(/\\neq/g, '≠')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\mathbb\{([A-Za-z])\}/g, '$1')
    .replace(/\\mathcal\{([A-Za-z])\}/g, '$1')
    .replace(/\\mathcal([A-Za-z])/g, '$1')
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromBody(body, fallback) {
  const parenthetical = body.match(/^\s*\(([^)]+)\)[.)]?/);
  if (parenthetical) return plainTitle(parenthetical[1]);
  const sentence = plainTitle(body).split(/(?<=[.!?])\s+/)[0];
  if (sentence) {
    const title = sentence.replace(/[.]$/, '');
    return title.length <= 100 ? title : `${title.slice(0, 97).trim()}...`;
  }
  return fallback;
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function animationFor(title, sectionTitle) {
  const value = `${title} ${sectionTitle}`.toLowerCase();
  if (/infinitesimal|unlimited|cauchy|sequence/.test(value)) return 'sequence';
  if (/ultrafilter|cofinite|principal|large set|largeness/.test(value)) return 'partition';
  if (/zorn|chain|maximal|extension/.test(value)) return 'chain';
  if (/equivalence|quotient|ultrapower|congruence/.test(value)) return 'quotient';
  return 'reasoning';
}

function statusFor(raw) {
  return /\\textcolor\{red\}|doubtful|is this proof correct|struggl|failure|i don.t know|need your help|conceptual obstacle/i.test(raw)
    ? 'review'
    : 'publishable';
}

function parseUnits(text, sourceFile, section) {
  const units = [];
  const environmentPattern = /\\begin\{(defn|prop|thm|lem|cor|eg|example|rem|axm)\}(?:\[([^\]]*)\])?/g;
  let match;
  while ((match = environmentPattern.exec(text)) !== null) {
    const type = match[1];
    const closing = `\\end{${type}}`;
    const closeIndex = text.indexOf(closing, environmentPattern.lastIndex);
    if (closeIndex === -1) continue;
    const statementRaw = text.slice(environmentPattern.lastIndex, closeIndex);
    const afterEnvironment = closeIndex + closing.length;
    const remaining = text.slice(afterEnvironment);
    const nextUnit = remaining.search(/\\(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\s*\{|\\begin\{(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\}/);
    const contextEnd = nextUnit === -1 ? text.length : afterEnvironment + nextUnit;
    const raw = `${statementRaw}\n${text.slice(afterEnvironment, contextEnd)}`;
    units.push({
      type,
      raw,
      statementRaw,
      title: match[2] ? plainTitle(match[2]) : titleFromBody(statementRaw, typeLabels[type]),
      index: match.index,
      sourceFile,
      section,
    });
    environmentPattern.lastIndex = closeIndex + closing.length;
  }

  const commandPattern = /\\(defn|prop|thm|lem|cor|eg|example|rem|axm)\s*\{/g;
  while ((match = commandPattern.exec(text)) !== null) {
    const type = match[1];
    if (!theoremCommands.has(type)) continue;
    const openingBrace = commandPattern.lastIndex - 1;
    const balanced = readBalanced(text, openingBrace);
    if (!balanced) continue;
    const remaining = text.slice(balanced.end);
    const nextUnit = remaining.search(/\\(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\s*\{|\\begin\{(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\}/);
    const trailingEnd = nextUnit === -1 ? text.length : balanced.end + nextUnit;
    const raw = `${balanced.body}\n${text.slice(balanced.end, trailingEnd)}`;
    units.push({
      type,
      raw,
      statementRaw: balanced.body,
      title: titleFromBody(balanced.body, typeLabels[type]),
      index: match.index,
      sourceFile,
      section,
    });
    commandPattern.lastIndex = balanced.end;
  }

  return units.sort((left, right) => left.index - right.index);
}

function parseFile(text, sourceFile, orderStart) {
  const headingPattern = /^\\(section|subsection|subsubsection)\{([^}]+)\}[^\n]*$/gm;
  const headings = [];
  let match;
  while ((match = headingPattern.exec(text)) !== null) {
    headings.push({
      level: { section: 1, subsection: 2, subsubsection: 3 }[match[1]],
      title: plainTitle(match[2]),
      index: match.index,
      bodyStart: headingPattern.lastIndex,
    });
  }

  const sections = [];
  const concepts = [];
  let order = orderStart;
  const usedSlugs = new Map();

  headings.forEach((heading, headingIndex) => {
    const end = headings[headingIndex + 1]?.index ?? text.length;
    const body = text.slice(heading.bodyStart, end);
    const baseSlug = slugify(heading.title);
    const duplicate = usedSlugs.get(baseSlug) || 0;
    usedSlugs.set(baseSlug, duplicate + 1);
    const slug = duplicate === 0 ? baseSlug : `${baseSlug}-${duplicate + 1}`;
    const firstUnit = body.search(/\\(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\s*\{|\\begin\{(?:defn|prop|thm|lem|cor|eg|example|rem|axm)\}/);
    const overview = firstUnit === -1 ? body : body.slice(0, firstUnit);
    const section = {
      slug,
      title: heading.title,
      level: heading.level,
      order,
      sourceFile,
      sourceLine: lineAt(text, heading.index),
      summary: cleanLatex(overview).slice(0, 320),
    };
    sections.push(section);
    order += 1;

    for (const unit of parseUnits(body, sourceFile, section)) {
      const unitBase = slugify(`${section.slug}-${unit.title}`);
      const count = usedSlugs.get(unitBase) || 0;
      usedSlugs.set(unitBase, count + 1);
      const unitSlug = count === 0 ? unitBase : `${unitBase}-${count + 1}`;
      const statement = cleanLatex(unit.statementRaw);
      const sourceContext = cleanLatex(unit.raw);
      concepts.push({
        slug: unitSlug,
        title: unit.title,
        type: typeLabels[unit.type],
        sectionSlug: section.slug,
        sectionTitle: section.title,
        order,
        sourceFile,
        sourceLine: lineAt(text, heading.bodyStart + unit.index),
        status: statusFor(unit.raw),
        animation: animationFor(unit.title, section.title),
        statement,
        sourceContext,
        sourceHash: hash(`${statement}\n${sourceContext}`),
      });
      order += 1;
    }
  });

  return { sections, concepts, nextOrder: order };
}

async function getSourceFiles() {
  const main = await readFile(path.join(sourceDirectory, 'main.tex'), 'utf8');
  const files = ['main.tex'];
  for (const match of main.matchAll(/\\input\{([^}]+)\}/g)) {
    const file = match[1].endsWith('.tex') ? match[1] : `${match[1]}.tex`;
    if (!files.includes(file)) files.push(file);
  }
  return files;
}

const sourceFiles = await getSourceFiles();
const sections = [];
const concepts = [];
let order = 0;

for (const sourceFile of sourceFiles) {
  if (sourceFile === 'main.tex') continue;
  const text = await readFile(path.join(sourceDirectory, sourceFile), 'utf8');
  const parsed = parseFile(text, sourceFile, order);
  sections.push(...parsed.sections);
  concepts.push(...parsed.concepts);
  order = parsed.nextOrder;
}

let source = {};
try {
  source = JSON.parse(await readFile(path.join(root, 'notes/source.json'), 'utf8'));
} catch {
  source = { sourceRepository: 'unknown', sourceCommit: 'unknown', syncedAt: null };
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, 'concepts.json'),
  `${JSON.stringify({ schemaVersion: 1, source, sections, concepts }, null, 2)}\n`,
);

console.log(`Generated ${sections.length} sections and ${concepts.length} concepts from ${sourceFiles.length - 1} files.`);
