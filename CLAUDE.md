# Ei-AI

## Work

**Questions before work, contradictions first.** A package opens with `docs/plan/notes/<WP>.md`: the open questions it raises, and every contradiction found between the design, the plan and what already exists. The answers come before the first edit, not during it. [Phase 1 · Detail §1](docs/plan/ei-ai-phase-1-detail.md) is the argument for this rule — ten defects and a CI contradiction found after the documents were written, then carried in as corrections.

**A plan is approved once, then it runs.** The plan for a package is a hard stop: nothing is written until it is approved. After that the package runs task by task without asking again, and the next stop is its proving command. Approving a plan is not approving a commit — that is separate, and it is in `## Git`.

**Stop climbing after three.** A failing check is fixed in place at most twice. Then name the cause and what it touches — the task, the package, or the design. A cause that reopens the task may loop back at most three times; after that, stop and ask. Grinding past that point is an escalation refused, not persistence.

**Tests travel with the task that needs them.** The "Done when" in [Tasks](docs/plan/ei-ai-phase-1-tasks.md) is the acceptance test, and [Detail §11](docs/plan/ei-ai-phase-1-detail.md) sets what each type covers. Code written without its test is a task still in progress.

**Keep a diary, under four headings and no others.** In that same `docs/plan/notes/<WP>.md`, one dated line per entry. **Interpretations** — an ambiguity closed by choosing. **Deviations** — a deliberate departure from the plan. **Tradeoffs** — the alternative considered and dropped. **Open questions** — what nobody has answered yet. The diary carries what a diff cannot: why this and not that.

**Promote at the gate, never mid-package.** When a package closes, confirmed interpretations, deviations and tradeoffs become rules in this file; open questions become rows in [Progress §3](docs/plan/ei-ai-progress.md). Nothing else moves. A rule added at a gate applies from the next package — the package that produced it is judged by the rules it started under.

## Git

**Never commit, stage or push on your own initiative.** After adding or editing files, stop and report what changed; the user decides when it gets committed. This covers `git add`, `git commit`, `git push`, `--amend` and rebase — each needs an explicit request, and approval for one commit does not carry to the next.

**Commit messages are short.** One line, `type: what changed`, at most ~72 characters, **no body**. The existing history is the model:

```
docs: dev environment setup runbook with per-step verification
docs: rewrite design as agentic assistant; add operating modes
docs: execute dev environment runbook, log verified results
```

Types in use: `docs`, `feat`, `fix`, `chore`, `refactor`, `test`.

A body is the exception. Add one only when a decision needs a "why" the diff cannot carry, and keep it to two or three lines. Findings, summaries, rationale and lists belong in the documents themselves — a commit message is not a place to re-explain work that is already written down.

**No attribution trailer.** A commit carries no `Co-Authored-By` line and no co-author of any kind — the author is whoever ran the commit. `.claude/settings.json` sets `attribution.commit` to an empty string so the trailer is not generated; never add one by hand.

## Code

**Comments in English, and few of them.** A comment sits above a declaration and says *why*; it never restates what the line already says. One or two lines each.

**Avoid comments inside a function body.** A block that needs explaining wants a name, not a note — extract it into a small named function instead. The exception is a genuinely surprising constraint (a workaround, an ordering requirement, a spec quirk), and then one line is enough.

**Names carry the explanation.** Function and class names are short and say what the thing does, so most comments become unnecessary. `resolveWorkspaceRole` needs no comment; `handle` with a paragraph above it is the wrong trade.

**Look before you write.** Before adding a helper, search for one that already does the job — shared code lives in `packages/*`, `apps/api/src/common/`, `ports/` and `adapters/`. Two functions doing the same thing in different words is worse than one imperfect name.

**Prefer reuse over a new variant**, and prefer extending over rewriting.

**Changing a shared function is the last resort.** If the change would force edits at existing call sites, do not change it: add an optional parameter with a default that keeps current behaviour, or add a sibling function. When a shared function genuinely must change, read every call site first and say in your report which ones were checked.
