---
name: idea-to-design
description: Turn a raw product idea into a complete software analysis and design document delivered as a single Markdown file, opening with a plain-language executive summary anyone can read. Runs the full path - idea clarification, scope, requirements (functional + non-functional), an agreed technology stack discussed with the user, domain model, system architecture, data design, API design, UI/UX flows, security, deployment, risks and delivery roadmap. Use when the user describes an idea, feature, product or system and asks to analyse it, design it, spec it, architect it, choose a stack for it, write an SRS/SDD/technical design doc, or "phan tich thiet ke he thong".
---

# Idea to Design

Take an idea in any state - one sentence, a rambling voice note, a competitor link, a half-built repo - and produce a single, self-contained Markdown design document that a development team could build from without asking follow-up questions, and that a non-technical stakeholder can understand from its first page alone.

## Core rules

1. **One document, summary first.** The deliverable is exactly one `.md` file. It opens with **Section 0 - Executive Summary**: a plain-language digest of both the analysis and the design, readable in about 3 minutes by someone with no technical background. Write it so it can be lifted out and sent on its own without losing meaning. Everything after Section 0 is the detailed version for the build team. Produce a separate standalone summary file only if the user explicitly asks for one.
2. **Two rounds of questions, both before writing.** Round one clarifies the idea (Phase 1, max 4 questions). Round two agrees the technology stack (Phase 3, max 4 questions). Nothing else earns a round trip: pick the sensible default, record it under **Assumptions**, and keep going.
3. **Every question must be answerable by a non-expert.** No jargon, no acronyms, no question that only an engineer could answer. If a question needs technical knowledge to answer, it is not a question - it is your decision to make and record as an Assumption. Technology *names* may appear in the stack round, but only alongside a plain-language explanation of what choosing them means.
4. **Decide, do not survey.** Every section states a decision and the reason for it. Alternatives appear only in the ADR table with a one-line "why not". The single exception is the tech stack: there you present a complete proposal and invite the user to change it - and even then you arrive with a recommendation, never a blank menu.
5. **Concrete over abstract.** Real entity names, real field names, real endpoint paths, real error codes, real numbers for capacity and latency. "Some kind of caching layer" is a failure; "Redis, 5-minute TTL on the product-list key, invalidated on write" is the bar.
6. **Traceable.** Every requirement gets a stable ID (`FR-01`, `NFR-03`, `UC-04`). The architecture, data and API sections reference those IDs, so nothing is designed without a reason and no requirement is left unbuilt.
7. **Match the input language.** Write the document in the language the user used to describe the idea (Vietnamese in, Vietnamese out). Keep technical terms, identifiers, code and diagram labels in English regardless.
8. **Right-size the depth.** A CRUD internal tool does not need an event-sourcing chapter. Scale each section to the actual complexity - cut sections that would be empty ceremony, and state in the doc that they were cut and why.

## Asking questions

The person answering may be a business owner, a shop manager or a founder with no software background. Write every question so that person can answer it confidently, from what they know about their own business.

**Rules**

- **Ask about the business, not the technology.** The user knows their customers, their volumes, their money and their deadlines. They do not know your storage engine. Translate the technical fork into the business fact that decides it, then decide the technology yourself.
- **No jargon.** No "multi-tenant", "offline-first", "eventual consistency", "SSO", "idempotency". If a term is genuinely unavoidable, follow it immediately with a plain-language gloss in brackets.
- **Give 2-4 concrete options**, never an open blank. Each option is one short sentence describing what it means *in practice for the user* - what they can do, what it costs, how long it takes.
- **Mark one option as recommended** and say in a few words why it fits their situation. A non-expert should be able to answer by picking the recommendation and moving on.
- **One question, one decision.** Never bundle two decisions into one question.
- **Say why you are asking** when it is not obvious - one clause on what changes depending on the answer.
- **Maximum 4 questions per round.** If a fifth matters, it goes into Open Questions in the document, phrased to the same standard.
- Use the `AskUserQuestion` tool when it is available - it renders the options as pickable choices, which is exactly the shape these questions should have.

**The test:** could someone who has never written a line of code answer this without looking anything up? If no, rewrite it or answer it yourself.

**Rewrite examples**

| Do not ask | Ask instead |
| --- | --- |
| "Single-tenant or multi-tenant?" | "Will each customer company see only their own data, completely separated from other companies - or is this for one organisation only?" |
| "Do you need offline support?" | "Will staff use this somewhere with unreliable internet, like a warehouse or out on the road? If yes, the app has to keep working when the connection drops, which adds roughly 2-3 weeks." |
| "What are your consistency requirements?" | "If two staff members edit the same order at the same moment, what should happen: last one wins, or the second person gets a warning?" |
| "Expected RPS and p95 latency target?" | "Roughly how many people will use this at the busiest hour - about 10, about 100, or over 1,000?" |
| "Which auth provider?" | "Should people log in with an email and password you manage, or with their existing Google/company account?" |
| "REST or GraphQL?" | Do not ask - internal shape, no business consequence. Decide it and record it in the ADR section. |

## Discussing the tech stack

The stack is the one place the user gets a real say, because they live with the consequences: who can maintain it, what it costs every month, what they already own, what a client contract mandates. Run this as its own round in Phase 3 - never fold it into the Phase 1 questions.

**How to run it**

- **Arrive with a full proposal, not a blank page.** Every layer filled in with a specific technology and a pinned version before you open the discussion. The user must be able to reply "fine, go ahead" and lose nothing by doing so.
- **Default to what they already use.** Check `CLAUDE.md`, the existing repo, `package.json` / `composer.json` / `*.csproj`, and anything they mentioned in passing. A stack the team already knows beats a technically superior one they do not - and say that out loud when it is the reason.
- **Present it as one table**, then the questions. Keep the table to one screen:

  | Layer | Proposal | Why this, in plain terms | We would switch if |
  | --- | --- | --- | --- |

- **Justify every layer by cost of ownership, not novelty.** Who patches it, what it costs per month, how hard it is to hire for, what happens if the vendor disappears or changes pricing. A technology that is merely interesting loses to a boring one that the team can run.
- **Match the user's technical level.** If they used technical vocabulary describing the idea, discuss the trade-off directly. If they did not, lead with the consequence - money, time, hiring, lock-in - and put the technology name in brackets after it.
- **Flag lock-in explicitly** wherever a choice is expensive to reverse later: managed database, proprietary auth, a cloud-specific service, a paid third party in the critical path.
- **Say what it costs when the user overrides you.** One sentence, no argument, then design with their choice. It is their system and their bill. Record the override in section 5.2 and the reasoning in an ADR.
- **Freeze the stack before Phase 4.** Do not quietly swap a component while designing. If the design proves the stack wrong, stop, say so plainly, and re-open the discussion once.
- **If nobody answers** (non-interactive run, or the user says "just decide"), proceed with the proposal, mark the whole stack as an Assumption, and move the unanswered questions into Open Questions.

**The four questions worth asking** - pick the ones that apply, never more than 4:

1. **Team and maintenance** - "Who will look after this after launch - your own developers, an agency, or nobody yet? And what do they already build with?" *(The single strongest input to the stack.)*
2. **Hosting and budget** - "Where should this run: your own server, a cloud provider you already pay for, or whatever is cheapest? And roughly what monthly running cost is acceptable - under $50, a few hundred, or not a concern?"
3. **Delivery surface** - "Do people need an app they install from the App Store / Play Store, or is a website that works well on a phone enough? Installing an app roughly doubles the front-end work."
4. **Build versus buy** - "For login, payments, email and file storage we would normally use paid services - faster to build, roughly $X a month, and someone else handles the security. Is that acceptable, or does everything have to run on your own infrastructure?"

Plus one to ask whenever it might exist: **"Is there any technology you must use or must avoid - something a client requires, a licence you already pay for, or a bad experience you would rather not repeat?"**

**Never ask** which state manager, ORM, CSS framework, test runner, package manager, API style or folder structure to use. Those are yours to decide; the interesting ones go in the ADR section.

Per-layer option tables with plain-language trade-offs are in `references/techstack-options.md`.

## Workflow

### Phase 1 - Understand the idea

- Restate the idea in 3-5 sentences until it is unambiguous. This becomes the doc's "Problem and Vision".
- Extract: who has the problem, what it costs them today, what "solved" looks like, how success is measured.
- If the user pointed at an existing codebase or files, **read them first** (`Glob` / `Grep` / `Read`) and design against reality - existing stack, existing schema, existing conventions. Reusing what is there beats greenfield invention.
- Only now run the clarifying round, following **Asking questions** above, and only if it is actually needed.

### Phase 2 - Analyse

Work through `references/analysis-checklist.md`. Produce:

- Stakeholders and actors (human and system).
- Scope: an in-scope list and an explicit **out-of-scope** list. The out-of-scope list prevents more rework than any other section.
- Functional requirements, ID'd, each one testable, written as "The system shall ...".
- Non-functional requirements with **numbers**: p95 latency, concurrent users, data volume and growth, uptime target, RPO/RTO, retention, compliance regime.
- Use cases and user stories with Given-When-Then acceptance criteria.
- Business rules and constraints: budget, deadline, team size and skills, mandated stack, legacy systems that must be integrated.

### Phase 3 - Agree the tech stack

The analysis is done, so the requirements that constrain the stack are now known. Do this before any detailed design.

- Assemble a complete proposal from `references/techstack-options.md`: every layer, a specific technology, a pinned version. Bias hard toward what the team already runs.
- Weight the decision in this order: **team skills → running cost → fit for the stated NFRs → hiring pool → everything else.** Novelty carries no weight.
- For each layer, know the answer to "what does this cost per month, who patches it, and what breaks if it goes away?" before proposing it.
- Present the proposal table and run the stack round per **Discussing the tech stack** above.
- Fold the answers in. Where the user overrode a recommendation, note the consequence in one sentence and proceed.
- Write down the frozen stack, the rejected alternatives, and the cost of ownership. This becomes section 5.2 plus the relevant ADRs.

### Phase 4 - Design

- **Domain model** - entities, attributes, relationships, invariants, and a state machine for anything that has a lifecycle.
- **Architecture** - chosen style (modular monolith / microservices / serverless / event-driven) with justification, context diagram, container and component breakdown, the responsibility of each component, sync vs async boundaries.
- **Data design** - schema with types and constraints, indexes each paired with the query it serves, migration and seeding approach, caching strategy, archival.
- **API design** - endpoint table (method, path, auth, request, response, error codes), pagination/filtering/sorting conventions, versioning, idempotency for anything that moves money or mutates state, webhooks and events with payload shapes.
- **UI/UX** - screen inventory, navigation map, the 2-3 critical flows step by step, empty/loading/error states, responsive and accessibility baseline.
- **Cross-cutting** - authentication and authorisation with a role-permission matrix, validation layers, error taxonomy and handling, logging/metrics/tracing, config and secrets, i18n, feature flags.
- **Security** - threat list (STRIDE-lite), a mitigation per threat, data classification, PII handling.
- **Deployment** - environments, CI/CD pipeline stages, infrastructure sketch, scaling plan, backup and disaster recovery, cost estimate. Must match the hosting agreed in Phase 3.
- **Testing** - what is unit- vs integration- vs e2e-tested, coverage targets, load-test plan, UAT scope.
- **Delivery** - the MVP cut line, a phased roadmap with milestones, effort estimate per phase, dependencies, team shape.
- **Risks** - table of risk / probability / impact / mitigation / owner. Include the boring killers: unclear ownership, third-party API limits, data migration.
- **ADRs** - the 5-10 decisions that were genuinely contested, each with context, decision, consequences, and rejected alternatives. Every stack choice that was debated in Phase 3 belongs here.
- **Open questions** - everything still unresolved, with who must answer it and by when, each phrased to the **Asking questions** standard.

Design only against the frozen stack. Nothing may appear here that was not agreed in Phase 3.

### Phase 5 - Write the document

- Follow `references/document-template.md` for structure and section order.
- Open with a `# Title`, a metadata block (version, date, author, status), a table of contents, then **Section 0 - Executive Summary**.
- **Write Section 0 last**, once the detail exists, but place it first. It must cover, in plain language: what is being built and for whom, the problem it removes, how it works in a few sentences, what ships in version 1 and what does not, the handful of decisions that shape everything else and why, timeline and effort, rough cost including monthly running cost, the top 3 risks, and what the reader must decide next. No jargon, no IDs, no diagrams beyond one simple flow if it genuinely helps. Ban the words the rest of the document is full of - if a sentence needs "idempotent" or "denormalised", it belongs in the detail sections, not here.
- Diagrams as **Mermaid** fences: `flowchart` for architecture and flows, `erDiagram` for data, `sequenceDiagram` for critical interactions, `stateDiagram-v2` for lifecycles. Give every diagram a caption sentence saying what to notice in it.
- Tables for anything enumerable: requirements, endpoints, roles, risks, milestones, environment variables.
- Code fences with a language tag for schema DDL, type definitions and payload examples. Any code sample follows the user's style guide in `CLAUDE.md`: arrow functions and header comments for JS/TS, PSR-12 for PHP, Allman braces for C#, variables declared at the top of their scope.
- Write the file to `docs/design/<kebab-case-idea-name>.md` under the project root, creating the folder if needed. If the project already has an obvious docs folder, put it there instead.

### Phase 6 - Self-review before handing over

Check and fix, then report:

- [ ] Section 0 stands on its own: someone who reads only that page knows what is being built, what it costs to build and to run, when it lands and what they must decide.
- [ ] Section 0 contains no unexplained technical term and no requirement IDs.
- [ ] Section 0 does not contradict any detail section - re-read both after any late change.
- [ ] Every question that was asked, and every entry in Open Questions, passes the non-expert test.
- [ ] Section 5.2 lists every layer with a pinned version, a plain-language reason, and a marker on anything the user chose against the recommendation.
- [ ] No technology appears anywhere in the design that was not in the stack agreed in Phase 3.
- [ ] Every stack choice that was contested has an ADR, and every ADR names what it makes harder.
- [ ] Every `FR-xx` is covered by at least one component, endpoint or screen.
- [ ] Every entity in the ER diagram appears in the schema section, and the reverse.
- [ ] Every NFR carries a number, not an adjective.
- [ ] No "TBD" outside the Open Questions section.
- [ ] Every Mermaid block is syntactically valid - balanced brackets, and labels containing spaces or punctuation are quoted.
- [ ] The MVP cut line is explicit: a reader can tell exactly what ships first.
- [ ] Assumptions lists every default that was picked instead of asked about.

Then tell the user: the file path, the MVP scope in one line, the agreed stack in one line, the monthly running cost, the top 3 risks, and any open question that genuinely blocks development - all in the same plain language as Section 0.

## Anti-patterns

- A generic template with the idea's nouns swapped in. The design must only make sense for *this* idea.
- An executive summary that is just the section headings restated, or that is longer than a page.
- A question the user cannot answer without asking their developer first.
- Opening the stack discussion with an empty table and asking the user to fill it in.
- Choosing a technology because it is new, or because you like it. Cost of ownership decides.
- Quietly swapping a stack component during design after it was agreed.
- Arguing with the user after they override a stack recommendation. State the cost once, then build what they chose.
- Microservices, Kubernetes or event sourcing for a system with under 10k users and no team to operate it.
- Requirements that cannot be tested: "the system should be fast", "the UI should be intuitive".
- Silently skipping sections. Cut them deliberately and say so.
- A third round of questions, or any round after writing has started.
