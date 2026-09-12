# Working notes

One file per work package, `WP-1.1.md` and so on. It opens the package and runs alongside it: what was unclear before the first edit, and what was decided while the work happened.

This is not a status file — [Progress](../ei-ai-progress.md) is. It is not a plan either. It records what a diff cannot: why this and not that.

At the package gate the entries are promoted — interpretations, deviations and tradeoffs become rules in [CLAUDE.md](../../../CLAUDE.md), open questions become `D-`/`Q-` rows in [Progress §3](../ei-ai-progress.md). Nothing else moves, and nothing is promoted mid-package.

## Template

```markdown
# WP-1.1 · Repo, toolchain, Compose stack, Dev Container

## Contradictions found on opening
- 2026-09-12 — …, against …

## Interpretations
- 2026-09-12 — an ambiguity closed by choosing: …

## Deviations
- 2026-09-12 — departed from the plan deliberately: …, because …

## Tradeoffs
- 2026-09-12 — chose …, dropped …, because …

## Open questions
- 2026-09-12 — unanswered: … · needed by …
```

Four headings and no others, plus the contradictions list from step 1. An entry is one dated line; if it needs a paragraph, it is a decision that belongs in the design document.
