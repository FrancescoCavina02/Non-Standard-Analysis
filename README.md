# Non-Standard Analysis

An interactive concept explainer generated from evolving LaTeX notes. The repository keeps the formal source, deterministic concept extraction, optional AI explanation drafts, review branches, live previews, and the published website in one auditable workflow.

## Publishing Flow

```text
notes/source on main
        |
        | manual GitHub Action
        v
notes/source + generated concept drafts
        |
        | generated/notes-review
        v
Draft pull request + live website preview
        |
        | visual and mathematical review
        v
Merge to main -> production website
```

Nothing is synchronized on a timer. Nothing generated is published directly.

## One-Time Setup

Configure this optional repository setting at `Settings -> Secrets and variables -> Actions`:

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Optional only if **Draft intuition and reasoning with AI** is enabled. |

The LaTeX project is stored in `notes/source/` in this repository. No source-access token is needed.

Configure Actions at `Settings -> Actions -> General`:

1. Select **Read and write permissions** under Workflow permissions.
2. Enable **Allow GitHub Actions to create and approve pull requests**.

Configure Pages at `Settings -> Pages`:

1. Set Source to **Deploy from a branch**.
2. Select the `gh-pages` branch and `/ (root)` after the first deployment creates it.

The production URL will be:

`https://francescocavina02.github.io/Non-Standard-Analysis/`

## Manual Synchronization

After committing an important change to `notes/source/` on `main`:

1. Open the repository's **Actions** tab.
2. Select **Sync notes and draft explanations**.
3. Select **Run workflow**, enable AI drafting only after adding `OPENAI_API_KEY`, and confirm.
4. Open the draft PR named **Review synchronized notes and generated explanations**.
5. Follow the preview link posted on the PR and inspect desktop and mobile output.
6. Correct the generated branch directly if needed.
7. Mark the PR ready and merge it only when the explanation is publishable.

Repeated runs update the same `generated/notes-review` branch and draft PR. Complete or close the current review before starting a logically separate publishing batch.

Pushing only files inside `notes/source/` does not deploy the public site. The generated review PR is the publication gate.

## Local Development

```sh
npm install
npm run dev
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run generate` | Rebuild the deterministic concept catalog from `notes/source`. |
| `npm run check` | Generate content and type-check the Astro site. |
| `npm run build` | Generate and create the production static build. |
| `npm run generate:ai` | Refresh changed explanation drafts; requires `OPENAI_API_KEY`. |

## Repository Structure

| Path | Role |
| --- | --- |
| `notes/source/` | Versioned LaTeX project source. |
| `notes/source.json` | Revision metadata recorded when a review draft is generated. |
| `scripts/generate-content.mjs` | Deterministic LaTeX structure parser. |
| `scripts/generate-ai-drafts.mjs` | Optional review-draft generator. |
| `src/data/generated/` | Versioned concept catalog and explanation drafts. |
| `src/pages/` | Astro website routes. |
| `.github/workflows/sync-notes.yml` | Manual synchronization and PR creation. |
| `.github/workflows/preview.yml` | Review-branch preview updates and cleanup. |
| `.github/workflows/publish.yml` | Production publication after merge. |

## Editorial Safety

The parser flags source blocks containing red annotations, doubts, unresolved questions, or failed arguments as `review`. AI drafting skips those blocks by default. The rule is intentionally conservative: generated prose is a draft, while the LaTeX notes remain the source of truth.
