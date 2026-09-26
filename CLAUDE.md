# CLAUDE.md

@AGENTS.md

The shared rules above apply in full. This file adds only what is specific to
working here with Claude Code.

## Context

- Bangkok is under active flood conditions. Prefer shipping a correct, small
  slice over a complete, late one.
- The owner is a senior front-end lead (React / Next.js / TypeScript / Vue).
  Skip the basics; explain trade-offs briefly and move on.
- Detailed product requirements live in `docs/internal/SPEC.md`, which is not
  published. Read the section you need rather than the whole file.

## How to work

1. **Plan first** for anything touching more than two files, the database
   schema, or a source adapter. Write the plan, list the files, and wait for
   approval when the change is schema-level or alters user-visible copy.
2. **Source adapters:** investigate the upstream before writing code — fetch a
   real sample, infer the schema, note units and terms. Record the contract in
   `docs/internal/sources/<id>.md` with fixtures, *then* write the adapter and
   its tests. Never guess what a field means.
3. **UI work:** build at 360 px first. Check both `/th` and `/en`. Test with
   long Thai strings, and with no data, stale data and error states.
4. **Verify before claiming done:**
   `pnpm typecheck && pnpm lint && pnpm test && pnpm i18n:check`.
   Report what you ran and what it returned.
5. Keep diffs focused. Don't refactor unrelated code in the same change.

## Guardrails

- Don't run `pnpm db:migrate` against anything but a local or branch database
  unless the owner explicitly asks.
- Never print, log or echo an environment value. Don't read `.env*` files unless
  asked, and never commit one — `pnpm check:secrets` will catch it, but don't
  rely on that.
- Don't commit, push, open pull requests or deploy. Leave changes in the working
  tree for the owner.
- Don't hit upstream sources in loops while developing; use the fixtures.
  One-off sample fetches are fine.
- If Thai wording is uncertain, write your best version and flag it as
  `th-review` in the summary. Don't silently ship awkward Thai.
- If a request conflicts with a hard rule in AGENTS.md, say so and propose the
  compliant alternative.
