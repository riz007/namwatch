# CLAUDE.md

@AGENTS.md

The shared rules above apply in full. This file only adds Claude Code specifics.
Read **SPEC.md** sections on demand (don't load the whole file for small tasks). Section map: §5 sources · §6 reporting · §7 architecture · §8 UX · §9 language · §10 design · §11 data model · §12 API · §16 roadmap.

## Context
- The owner is a senior front-end lead (React/Next.js/TypeScript/Vue). Skip basics; explain trade-offs briefly and move on.
- Bangkok is in an **active flood emergency**. Prefer shipping a correct, small slice over a complete, late one. Phase 0 in SPEC §16 is the current priority.

## Skills
- **Hallmark** (design). Install once:
  ```bash
  npx skills add nutlope/hallmark
  # or copy SKILL.md + references/ from github.com/Nutlope/hallmark into .claude/skills/hallmark/
  ```
  - If `DESIGN.md` does **not** exist: run the Hallmark default build for the first screen using `docs/design-brief.md`, and include the SPEC §10 non-negotiables in the brief. After the owner approves, run "lock the system" to write `DESIGN.md`.
  - If `DESIGN.md` exists: Hallmark must follow it (system-managed project). Never rotate themes.
  - Before finishing any UI task: `hallmark audit <changed files>` and fix findings that don't conflict with SPEC non-negotiables.
- For any Anthropic API or Claude product facts, verify rather than recall.

## How to work
1. **Plan first** for anything touching more than two files, the DB schema, or a source adapter. Write the plan, list the files, and wait for approval when the change is schema-level or user-visible copy.
2. **Source adapters:** use a subagent to investigate the upstream (fetch a sample, infer the schema, note units and terms). Write `docs/sources/<id>.md` and fixtures, *then* write the adapter and tests. Never guess field meanings.
3. **UI work:** build at a 360 px viewport first. Check both `/th` and `/en`. Test with long Thai strings and with no data / stale data / error states.
4. **Verify before claiming done:** run `pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check`. For UI, run the relevant Playwright spec. Report what you ran and the result.
5. Keep diffs focused. Don't refactor unrelated code in the same change.

## Guardrails for Claude specifically
- Don't run `pnpm db:migrate` against anything but local/branch databases unless the owner explicitly says "migrate production".
- Never print, log, or echo env values. Don't read `.env*` files unless asked.
- Don't `git push`, open PRs, or deploy unless asked.
- Don't hit upstream sources in loops while developing; use fixtures. One-off sample fetches are fine.
- If Thai wording is uncertain, write your best version and flag it as `th-review` in your summary. Don't silently ship awkward Thai.
- If a request conflicts with a Hard rule in AGENTS.md (e.g. "just call Supabase from the client"), say so and propose the compliant alternative.

## Suggested custom commands (`.claude/commands/`)
- `/add-source <id>`: investigate → docs → fixtures → adapter → tests → register in ingest.
- `/add-copy <key>`: add a key to both locales and check it against the glossary.
- `/ui-check <route>`: Playwright screenshots at 360 px in TH + EN, light + dark, then `hallmark audit`.
- `/release-check`: DoD checklist from AGENTS.md + hotline numbers review + source health.

## First session checklist (if the repo is empty)
1. Scaffold Next.js + TS strict + Tailwind v4 + next-intl (`th` default) + Vitest + Playwright + pnpm.
2. Add `src/config/{hotlines,depth-bands,regions,app.config}.ts` from SPEC §6.1 / §8.2.
3. Add Drizzle schema from SPEC §11 and generate the first migration (PostGIS extension enabled).
4. Write `docs/design-brief.md` from SPEC §8 + §10 → run Hallmark → owner approval → lock `DESIGN.md`.
5. Add the `thaiwater` and `traffy` adapters via `/add-source`.
6. Build the Map/List and Report screens; wire the API; set up `ingest.yml` in GitHub Actions.
7. Configure `vercel.json` (`regions: ["sin1"]`, security headers) and deploy.
