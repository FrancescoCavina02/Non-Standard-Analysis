import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [sourceArg = '_notes-source', destinationArg = 'notes/source'] = process.argv.slice(2);
const root = process.cwd();
const source = path.resolve(root, sourceArg);
const destination = path.resolve(root, destinationArg);

const ignoredNames = new Set([
  '.git',
  '.github',
  '.DS_Store',
  'node_modules',
  'dist',
]);

const ignoredExtensions = new Set([
  '.aux',
  '.bbl',
  '.blg',
  '.fdb_latexmk',
  '.fls',
  '.log',
  '.out',
  '.synctex.gz',
]);

function shouldCopy(sourcePath) {
  const name = path.basename(sourcePath);
  if (ignoredNames.has(name)) return false;
  return ![...ignoredExtensions].some((extension) => name.endsWith(extension));
}

async function assertLatexProject(directory) {
  const files = await readdir(directory, { recursive: true });
  const texFiles = files.filter((file) => file.endsWith('.tex'));
  if (texFiles.length === 0) {
    throw new Error(`No .tex files found in ${directory}. Refusing to replace notes/source.`);
  }

  const mainCandidates = texFiles.filter((file) => path.basename(file) === 'main.tex');
  if (mainCandidates.length === 0) {
    throw new Error(`No main.tex found in ${directory}. Refusing to replace notes/source.`);
  }

  const main = await readFile(path.join(directory, mainCandidates[0]), 'utf8');
  if (!main.includes('\\documentclass')) {
    throw new Error('main.tex does not contain a LaTeX document class.');
  }
}

await assertLatexProject(source);
await rm(destination, { recursive: true, force: true });
await mkdir(path.dirname(destination), { recursive: true });
await cp(source, destination, {
  recursive: true,
  filter: shouldCopy,
});

const metadata = {
  sourceRepository: process.env.SOURCE_REPOSITORY || 'eulac-com/6a4c8b2d31fcaba2ea9800',
  sourceCommit: process.env.SOURCE_COMMIT || 'local',
  syncedAt: process.env.SYNCED_AT || new Date().toISOString(),
};

await writeFile(
  path.join(root, 'notes/source.json'),
  `${JSON.stringify(metadata, null, 2)}\n`,
);

console.log(`Synchronized LaTeX sources from ${sourceArg} to ${destinationArg}.`);
