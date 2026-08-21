# Non-Standard Analysis

An interactive concept explainer generated from evolving LaTeX notes. The repository keeps the formal source, deterministic concept extraction, optional AI explanation drafts, review branches, live previews, and the published website in one auditable workflow.

## Publishing Flow

```text
Private notes repository
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

Configure these repository settings at `Settings -> Secrets and variables -> Actions`:

| Secret | Purpose |
| --- | --- |
| `SOURCE_REPOSITORY_TOKEN` | GitHub token with read access to the private `eulac-com/6a4c8b2d31fcaba2ea9800` source repository. |
| `OPENAI_API_KEY` | Optional only if **Draft intuition and reasoning with AI** is enabled. |

The source token should have only `Contents: read` access. If its organization uses SSO, authorize the token for that organization.

Configure Actions at `Settings -> Actions -> General`:

1. Select **Read and write permissions** under Workflow permissions.
2. Enable **Allow GitHub Actions to create and approve pull requests**.

Configure Pages at `Settings -> Pages`:

1. Set Source to **Deploy from a branch**.
2. Select the `gh-pages` branch and `/ (root)` after the first deployment creates it.

The production URL will be:

`https://francescocavina02.github.io/Non-Standard-Analysis/`

## Manual Synchronization

After completing an important chunk in the notes:

1. Open the repository's **Actions** tab.
2. Select **Sync notes and draft explanations**.
3. Select **Run workflow**, leave AI drafting enabled if desired, and confirm.
4. Open the draft PR named **Review synchronized notes and generated explanations**.
5. Follow the preview link posted on the PR and inspect desktop and mobile output.
6. Correct the generated branch directly if needed.
7. Mark the PR ready and merge it only when the explanation is publishable.

Repeated runs update the same `generated/notes-review` branch and draft PR. Complete or close the current review before starting a logically separate publishing batch.

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
| `notes/source/` | Exact synchronized LaTeX project snapshot. |
| `notes/source.json` | Source repository, commit, and synchronization metadata. |
| `scripts/generate-content.mjs` | Deterministic LaTeX structure parser. |
| `scripts/generate-ai-drafts.mjs` | Optional review-draft generator. |
| `src/data/generated/` | Versioned concept catalog and explanation drafts. |
| `src/pages/` | Astro website routes. |
| `.github/workflows/sync-notes.yml` | Manual synchronization and PR creation. |
| `.github/workflows/preview.yml` | Review-branch preview updates and cleanup. |
| `.github/workflows/publish.yml` | Production publication after merge. |

## Editorial Safety

The parser flags source blocks containing red annotations, doubts, unresolved questions, or failed arguments as `review`. AI drafting skips those blocks by default. The rule is intentionally conservative: generated prose is a draft, while the LaTeX notes remain the source of truth.
