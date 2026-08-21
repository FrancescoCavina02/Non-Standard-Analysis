import { defineConfig } from 'astro/config';

const configuredBase = process.env.BASE_PATH || '/Non-Standard-Analysis';
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;

export default defineConfig({
  site: 'https://francescocavina02.github.io',
  base,
  output: 'static',
});
