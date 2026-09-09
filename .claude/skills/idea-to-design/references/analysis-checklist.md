# Analysis Checklist

These are **your own** working prompts, not a questionnaire for the user - never paste them at anyone as they are written here. Anything you genuinely have to ask gets rewritten first to the plain-language standard in `SKILL.md`.

Use them to interrogate the idea before writing. Answer them in your own head (or from the codebase); put only the answers that matter into the document. An answer of "not applicable" is fine and worth recording once - "unknown" is not, unless it goes into Open Questions with an owner.

## 1. Problem framing

- Who exactly feels this pain? Name the segment, not "users".
- How do they solve it today - spreadsheet, manual process, a competitor, not at all?
- What does the current solution cost them per week in time, money, or errors?
- Why now? What changed that makes this buildable or urgent?
- What happens if this is never built? If the answer is "nothing much", say so.
- How will anyone know it worked? Pick metrics that move within one quarter.

## 2. Actors and stakeholders

- Every human role that touches the system, including the ones who only read reports.
- Every external system that calls in or gets called: payment, email/SMS, auth provider, ERP, analytics.
- Who owns the budget, who signs off on launch, who operates it after launch.
- Which actor is the *primary* one - the design optimises for them when priorities conflict.

## 3. Scope discipline

- What is the single capability that, if missing, makes the whole thing pointless?
- What is being explicitly excluded, and could someone reasonably have assumed it was included?
- Is there an existing system this must coexist with, replace, or migrate data from?
- Are there features that sound in-scope but belong to a later phase? Push them to the roadmap now.

## 4. Functional requirements

For each capability:

- What triggers it, what does it do, what changes as a result?
- Who is allowed to do it, and who must not be?
- What are the input rules - required fields, formats, ranges, uniqueness?
- What is the failure behaviour - validation error, retry, partial success, rollback?
- Is it testable as written? If it cannot be verified by an automated test or a scripted UAT step, rewrite it.
- Priority: Must / Should / Could - and be honest, not everything is Must.

## 5. Non-functional requirements (all need numbers)

- **Load**: concurrent users at peak, requests per second, largest expected payload.
- **Latency**: p95 and p99 targets for the critical endpoints, not an average.
- **Data**: rows per table year 1, growth rate, largest single record, total storage.
- **Availability**: uptime target, maintenance window, RTO and RPO.
- **Durability & retention**: how long data is kept, legal hold, deletion requests.
- **Security & compliance**: GDPR / PCI-DSS / HIPAA / local data-residency law - which apply?
- **Usability**: clicks to complete the core task, supported browsers and devices, accessibility level.
- **Operability**: who is on call, what they need to see at 3am, log retention.
- **Portability & vendor lock-in**: is a cloud migration plausible later?

## 6. Data

- What are the nouns of this business? Those are the entities.
- What must always be true (invariants)? "An order total always equals the sum of its items."
- Which relationships are one-to-many vs many-to-many, and where does ownership sit?
- What has a lifecycle with states, and which transitions are irreversible?
- What are the top 5 queries by frequency? Each one earns an index.
- What data comes from outside, how often does it sync, and what is the source of truth on conflict?
- Is soft delete needed? Audit history? Point-in-time reconstruction?

## 7. Integrations

- For each third party: rate limits, sandbox availability, auth mechanism, SLA, cost per call.
- What happens when it is down - queue, degrade, hard fail?
- Is the integration synchronous in the user's request path? If so, why?
- Who owns the credentials, and how do they rotate?

## 8. Architecture and tech stack forces

- Team size and skill set - the architecture must be operable by the people who exist.
- Deadline and budget - these constrain more than any technical concern.
- Is any part of the stack mandated by the client or by existing infrastructure?
- Does load actually vary enough to need autoscaling, or is a fixed instance cheaper and simpler?
- What is most likely to change in 12 months? Put a seam there, and nowhere else.
- Is there a monolith-first path? Default to it unless there is a concrete reason not to.

Feeding the Phase 3 stack round:

- What does the team already build with? Strongest single input to the stack - check `CLAUDE.md`, the repo and the package manifests before proposing anything.
- What monthly running cost is acceptable, and who pays it?
- Which pieces should be bought rather than built - payments, login, email delivery, search, file conversion?
- Is anything mandated or banned: a client requirement, a licence already paid for, a past bad experience?
- Which choices would be expensive to reverse in a year? Those are the ones to raise with the user explicitly rather than decide quietly.

Assemble the proposal from `techstack-options.md`, then run the round per **Discussing the tech stack** in `SKILL.md`.

## 9. Security

Walk STRIDE quickly against each trust boundary:

- **Spoofing** - how is identity proven, and can a session be stolen or replayed?
- **Tampering** - can a client alter price, quantity, role, or another tenant's ID?
- **Repudiation** - is there an audit trail for money and permission changes?
- **Information disclosure** - what leaks in errors, logs, list endpoints, or IDOR?
- **Denial of service** - unbounded queries, missing pagination, expensive exports, no rate limit?
- **Elevation of privilege** - is authorisation checked at the data layer or only in the UI?

Also: where does PII live, is it encrypted at rest, who can export it, and how is it deleted on request?

## 10. Delivery

- What is the smallest slice that delivers real value to the primary actor? That is the MVP.
- What must be built first because everything else depends on it?
- What can be faked in v1 - manual back-office step, hard-coded config, CSV import?
- Which risk is most likely to sink the timeline, and can it be de-risked in week 1 with a spike?
- What must be arranged early because it has lead time - accounts, contracts, API access, hardware?

## 11. Sanity checks before writing

- Could a competent developer build this without asking a question that is not in Open Questions?
- Is there any requirement with no component that satisfies it?
- Is there any component that satisfies no requirement? Delete it.
- Would this design still be reasonable at 10x the stated load? At 1/10th?
- Is any technology in the stack there for a reason other than "it fits this problem"?

## 12. Turning a gap into a question - or an assumption

For every unknown left after reading the idea and the codebase, run it through this gate in order:

1. **Can I answer it from the code, the domain, or common practice?** Then answer it. Record it as an Assumption (`A-xx`) with the reason in half a sentence. Most gaps end here.
2. **Does the answer change the architecture, the cost, or the timeline in a way the user would care about?** If not, answer it yourself as above. A question that only refines a detail is not worth a round trip.
3. **Can a person with no technical background answer it from what they know about their own business?** If not, it is not their question - it is yours. Decide it, and put the reasoning in an ADR.
4. Only what survives all three becomes a real question. Maximum 4 of them, asked in one round, each with 2-4 concrete options and a recommendation. Tech stack questions do not come from this gate - they have their own round in Phase 3.
5. Anything that survives but is not blocking goes into **Open Questions** in the document instead, with an owner and a deadline - still phrased in plain language.

### Getting technical numbers from non-technical answers

Never ask for the metric; ask for the business fact behind it and convert.

| What you need | What you actually ask |
| --- | --- |
| Concurrent users, RPS | "At the busiest time of day, roughly how many people are using this at once - about 10, about 100, or over 1,000?" |
| Data volume and growth | "How many orders/customers/records do you handle in a typical month today, and where do you expect that to be in a year?" |
| Uptime target, RTO/RPO | "If the system were down for an hour in the middle of a working day, what would that cost you - a minor annoyance, lost sales, or a serious problem?" |
| Retention and compliance | "How far back do you need to look up old records, and is there any rule or contract that says you must keep or delete them?" |
| Latency target | "Is this something people use all day where every second counts, or a few times a day where a couple of seconds is fine?" |
| Peak load pattern | "Is the workload steady through the month, or does it spike - month-end, payday, a sale, a season?" |
| Integration constraints | "Which other systems does this have to talk to, and who controls them - you, or an outside company?" |
