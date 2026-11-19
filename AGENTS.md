# components: agent instructions

Root `AGENTS.md` is the repository rulebook; `.claude/CLAUDE.md` links here.
[README.md](README.md) describes the tooling for the plug-ins that use it.

## What this repository is

The tooling the Scenario plug-ins share, so each plug-in repository keeps
only its docs and a small configuration:

- the handbook builder: a plug-in's Markdown docs to one searchable page, a
  single-file HTML handbook and an A4 PDF (`components handbook`);
- `action.yml`: the composite action a plug-in's Pages workflow runs to build
  its site from its newest release and add the checked release package.
- `mcp-check`: the checks of a plug-in's local MCP server, scenario-mcp's
  rules applied to a committed snapshot of its tools (`components mcp-check`,
  `mcp-check/action.yml`).

Plug-ins pin a release of this repository (a tag or its commit SHA). It is
TypeScript, run by tsx on Node 24 with no build step: a plug-in runs it with
`npx github:scenario-labs/components#<ref>` or through the action. The
builder was ported from photoshop-plugin's `tools/handbook`, the cards are
scenario-com-landing-page's `BrandFrame` and its helpers, copied.

## Code map

- `bin/components.mjs`: the command's entry, the repository's only
  JavaScript: it registers tsx and runs `src/cli.ts` (Node will not strip
  types under `node_modules`, where npx installs the package, nor compile JSX).
- `src/cli.ts`: the commands: `handbook` (build), `paths` (the repository
  paths a handbook is built from, for the action), `og` (a card) and
  `mcp-check`.
- `src/handbook/`:
  - `config.ts`: reads and checks `handbook.config.json`, fills the defaults,
    lists the doc paths; the `Config` type.
  - `markdown.ts`: the Markdown subset the docs use, and the layout HTML
    READMEs add (`<p align>`, `<a>`, `<sub>`, `<h1>`) read as Markdown; the
    `Block` type.
  - `build.ts`: chapters from doc sections, links and pictures resolved,
    the web page, the single file and the PDF, and the public-content checks.
  - `handbook.css`: what the handbook adds to components-lib's look
    (pictures, screenshot rows, check labels, lightbox, the A4 print sheet).
    `scenario-logo.svg`.
- `src/components-lib/`: the plug-in sites' look and components, taken from
  photoshop.scenario.com: `look.css`, `components.ts` (HTML builders),
  `client.ts` (behaviour, stripped of types by esbuild when inlined).
  README.md, "components-lib".
- `src/og/`: link-preview cards: scenario-com-landing-page's TypeScript,
  copied (`components/`, `lib/truchet/`, `lib/og/`, `lib/share-tags.ts`;
  each file's header names its source and changes), `lib/og/fetch-buffer.ts`
  (local files instead of Vercel Blob), `index.ts` (render and the `og`
  command), `fonts/` (OFL).
- `action.yml`: release lookup, docs restored from the release's commit,
  handbook build, release package with its checksum and attestation.
- `src/mcp/check.ts`: the MCP rules, with their limits taken from
  scenario-mcp; `mcp-check/action.yml` runs them in a plug-in's CI.
- `tools/lint.ts`: repository checks (below).
- `test/`: `node:test` suites against `test/fixtures/sample-plugin/`, a small
  plug-in whose docs cover what the real ones use; `browser.test.ts` drives
  the built page and prints the PDF in Playwright's Chromium; `test/action/gh`
  stands in for the GitHub CLI when CI runs `action.yml`.

## Commands

```sh
pnpm install --frozen-lockfile              # tsx, the card renderers, TypeScript, commitlint, Playwright (Node from .nvmrc)
pnpm browsers                               # Playwright's Chromium, for test/browser.test.ts
pnpm test                                   # node --import tsx --test test/*.test.ts; the browser and PDF ones skip without Playwright or pdftotext
pnpm typecheck                              # tsc --noEmit, strict
pnpm lint                                   # em dashes, machine paths, addresses, JSON, TypeScript only, action pins
node bin/components.mjs handbook --config <plug-in>/handbook.config.json --no-pdf --out build/handbook
```

The PDF needs Google Chrome (`CHROME_PATH`) and, for its contents' page
numbers, Poppler's `pdftotext`; the tests build without it.

## CI

| Workflow | When | What |
| --- | --- | --- |
| `ci.yml` | pull requests, `main` | `lint` (with `tsc`), `test` (Linux, macOS, Windows), `browser` (the page in Chromium, the PDF), `action` (`action.yml` before and after a release, stand-in `gh`), `mcp-check` (its action on the fixtures), `agents` (shared skills valid and linked); `ci-ok` requires them all |
| `pr-name.yml`, `commitlint.yml` | pull requests | `pr-title` and `commits` against `commitlint.config.ts` |
| `links.yml` | pull requests changing Markdown, weekly | links in the docs |
| `scorecard.yml` | weekly, `main` | OpenSSF Scorecard |
| `project.yml` | non-draft PRs, when opened, reopened or marked ready | adds them to the Plugins project (31) |
| `release-please.yml` | push to `main` | the release PR; merging it creates the release and its tag `vX.Y.Z` |

## Rules

- Every plug-in's site runs this code: a change to the configuration keys,
  the CLI or the actions' inputs is a breaking change for them. A stricter
  MCP rule fails every plug-in that pins the new release until it complies:
  say so in the PR. Add a key with
  a default rather than renaming one, and say in the PR which plug-ins must
  bump their pin or change their configuration.
- The builder keeps the plug-ins' public-content rules on every page it
  writes: no em dash, no machine path, no address but support@scenario.com,
  every link and picture resolved. Keep those checks failing loudly.
- The handbook is for the people who use a plug-in. Nothing the builder adds
  to it speaks to contributors (build commands, code diagrams, tests); those
  stay in the plug-in's repository.
- TypeScript, strict (`pnpm typecheck`), never JavaScript where TypeScript
  works; `tools/lint.ts` refuses any JavaScript file but `bin/components.mjs`.
  Runtime dependencies: tsx (runs the TypeScript), and satori, resvg, sharp
  and React for the link-preview cards; all pinned in `pnpm-lock.yaml`.
- `src/og/` copies scenario-com-landing-page's files: change them there
  first, then copy them again here, keeping the changes their headers list.
- `.agents/skills/` holds skills shared by every Scenario repository
  (`skills-lock.json`); change them upstream. `.claude/skills/` links to them.
- No em dashes, in code, docs, commit messages and PR titles.
- This repository is public: no credentials, session IDs, personal paths,
  account or project records, or spend anecdotes in code, docs, commits or PRs.
- Keep doc edits in a feature PR to the prose the change makes wrong, in the
  fewest words that state current behavior. Test runs, platforms and review
  notes belong in the PR body, not in docs.

## Commits and pull requests

- Branch from `main`; PRs are squash-merged, so the PR title becomes the commit
  header and the changelog line. Titles follow Conventional Commits with a scope
  from `commitlint.config.mjs`; the `pr-title` check enforces it. Pick the type
  from the final diff: `feat` and `fix` for what plug-ins see (the pages, the
  configuration, the action); a correction to this repository's own tooling or
  CI is `chore` (or `ci`, `build`, `docs`), and its issue is a Task.
- Fill `.github/pull_request_template.md`; tick only what you ran.
- Write PR descriptions, commit bodies and review replies briefly: what changed
  and why, the checks you ran (one line each), and any action needed after
  merge or known gap. Pass multiline bodies from a file (`--body-file`, `-F`).
- `Closes #n` only for complete issue scope, `Refs #n` otherwise, saying what
  remains.
- Screenshots of a visible change go in the PR description, never in a commit.
  GitHub has no command-line upload, so an agent saves them, numbered, in
  `.agent_out/pr-screenshots/<branch>/`, leaves a `[drop <file>]` placeholder
  per image in the description, and gives the person the folder's absolute
  path.
- After investigating a review comment, human or bot, reply in its thread with
  the pushed fix and evidence, or why no change is needed (`/pr-handle-comments`).
- Give every new issue the type its title implies: Bug for `fix`, Feature for
  `feat`, otherwise Task (`gh issue create --type <Type>`, gh 2.94 or later).
- Name the contributing agent in the PR and keep its co-author trailer on
  commits and in the squash message. Codex writes
  `Co-authored-by: Codex <model> <effort> <tier> <noreply@openai.com>` with the
  session's actual settings, leaving out unknown fields. A human reviews the
  complete diff before merge.
- `project.yml` adds each pull request, once ready for review, to the shared
  Plugins project (organization project 31) as "👀 In review".

## Releases

release-please keeps a release PR open on `main` (`release-please-config.json`).
Merging it creates the GitHub release and its tag `vX.Y.Z`. Never edit the
version in `package.json` or `CHANGELOG.md` by hand. Plug-ins move to a new
release through their own pull request (Dependabot proposes the action's bump).
