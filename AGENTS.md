# AGENTS.md

## Loop
- Read `memory.md` FIRST every task. Update it LAST: summarize, don't dump. Keep it short.
- Build spec: `playbook/quorum.md` Part II (local only, git-ignored). Read only the section the task needs (§2.5 code skeletons, §2.6 fallbacks). Never commit it, copy it into tracked files, or quote it.
- Edit only relevant files; don't scan the whole repo.
- After each working increment, commit with Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
- Keep README run steps current. Secrets only in `.env` (git-ignored).
- Ask before large refactors or heavy new dependencies.
- For any web UI (plan page `/p/:id`, `/try`), use the `frontend-design` skill: one page, readable on a phone, a status timeline, no framework.

## Quorum rules
- Never edit `src/temporal/workflows.ts` after git tag `real-run-start` (Temporal determinism). Use `wf.patched()` or a new workflow type instead.
- Workflow code gets absolute timestamps only; time math lives in the bot (client).
- Use `agent.generate` with Gemma, never streaming.
- Every external call in an activity or tool has an explicit `AbortSignal.timeout`.
- Never invent place names: options may only use names returned by the places tool.
- Store only members who `/join`ed; `/forget` deletes them. No real group data in the repo, fixtures or screenshots without consent.
- No human co-authors in commits.
