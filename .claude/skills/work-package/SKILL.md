---
name: work-package
description: Run one Ei-AI work package end to end - open it with its questions and contradictions, get one plan approved, execute its tasks against their "Done when", prove it with its proving command, then close it at a review gate and promote what was learned. Use when asked to start, continue, prove or close a work package or a task id (WP-1.1, T-2.3-02, "lam work package", "chay WP-2.3").
---

# Work package

One package, five steps, two stops. The stops are the plan and the gate. Between them the package runs without waiting on anyone.

## Authorities — read before deciding anything

| Question | Answered by |
| --- | --- |
| What is this package, and what proves it? | [Detail](../../../docs/plan/ei-ai-phase-1-detail.md) — 20 packages, one proving command each |
| What are the tasks, and when is each done? | [Tasks](../../../docs/plan/ei-ai-phase-1-tasks.md) — 149 tasks, each with a "Done when" |
| Where does it stand? | [Progress](../../../docs/plan/ei-ai-progress.md) — **the only place status is recorded** |
| Why does the requirement exist? | [Design](../../../docs/design/ei-ai-agentic-knowledge-assistant.md) — FR/NFR/ADR ids |
| How do we work here? | [CLAUDE.md](../../../CLAUDE.md) — `## Work`, `## Git`, `## Code` |

A conflict between these documents is a finding, not a nuisance. Report it; never edit a plan document to match what was built.

## 1. Open

Read the package in Detail and every task under it in Tasks. Then write `docs/plan/notes/<WP>.md` before touching anything else:

- **Open questions** — what the plan does not settle, each one answerable by a decision rather than by research.
- **Contradictions** — between design, plan, and what exists on disk. [Detail §1](../../../docs/plan/ei-ai-phase-1-detail.md) shows the cost of finding these late: ten defects and a CI contradiction, carried in as corrections after the fact.

Stop here if anything on either list would change the order of work or the shape of an interface. Everything else is an assumption to record, not a reason to wait.

## 2. Plan — the hard stop

Present, in one message: task order, files each task touches, the assumptions taken, the proving command that will close the package, and which "Done when" you expect to need hands or to be deferred (step 4). Then stop. Nothing is written until the plan is approved.

Once approved, the plan does not reopen per task. A task that turns out to be two is split in Tasks first, with `a`/`b` suffixes, then in Progress — never silently absorbed.

## 3. Execute

The unit is one task: its code, its tests, and its Progress row, together. Prepare the commit and stop — the commit itself needs an explicit request, and its message starts with the task id (`T-2.3-02: permitted CTE in hybrid search`).

When a check fails, climb the ladder and no further: fix in place at most twice → name the cause and whether it touches the task, the package or the design → loop back at most three times → stop and ask.

Record diary entries in `docs/plan/notes/<WP>.md` as they happen, one dated line each, under **Interpretations**, **Deviations**, **Tradeoffs**, **Open questions** and no other heading.

## 4. Prove

Run the package's proving command from Detail verbatim and paste its output. Every task ticked is not a closed package; the proving command is.

Then hand over the **verification list** — three parts, no others:

| Part | What goes in it |
| --- | --- |
| **Proved here** | Each "Done when" a command demonstrated, with the command and the output that showed it |
| **Needs your hands** | What no command reaches: a GUI, an external service, a genuinely clean machine, or a judgement about whether something *reads* right. One row each — the steps to run, and what a pass looks like |
| **Skipped on purpose** | What was not checked, why, the risk that leaves open, and **the task or gate that will cover it** |

Three rules for the list:

- A "Done when" in the second part keeps its row at 🔎 until a person has run it. The package's own proof does not close it.
- Nothing enters the third part because it was awkward. It enters only when a later task or gate re-runs it, and that task is named.
- A check that could pass for the wrong reason belongs in the first part only once you have confirmed it can still fail — see `## Proving` in [CLAUDE.md](../../../CLAUDE.md).

Say in the **plan** (step 2) which "Done when" you already expect to land in the second and third parts, so nobody discovers at the gate that the package needs an afternoon of clicking.

## 5. Close — the gate

Move the rows to 🔎, never to ✅ — work is not closed by the hand that did it. The review closes them or sends them back to ↩ with a reason.

Then promote the diary, and only then: confirmed interpretations, deviations and tradeoffs become rules in [CLAUDE.md](../../../CLAUDE.md); open questions become `D-`/`Q-` rows in [Progress §3](../../../docs/plan/ei-ai-progress.md). A rule promoted here applies from the next package — this one is judged by the rules it started under.
