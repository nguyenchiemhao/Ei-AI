# Tech Stack Options

Raw material for the Phase 3 proposal. Do not paste these tables at the user - pick one row per layer, then present the single proposal table described in `SKILL.md`.

**Order of weight when choosing:** team skills → running cost → fit for the stated NFRs → hiring pool → everything else. Novelty carries no weight. A boring stack the team can operate beats a better one they cannot.

**Check first, before opening any table below:**

- `CLAUDE.md` for the languages and frameworks the user works in.
- The existing repo: `package.json`, `composer.json`, `*.csproj`, `requirements.txt`, `Dockerfile`, CI config.
- Anything the user named in passing while describing the idea.

If the user's own stack covers a layer, that is the proposal. Justify it with "your team already runs this" and move on - no table needed.

---

## Starter proposals by project shape

Use these as the opening position, then adjust for the analysis. Pin real versions in the document.

| Project shape | Opening proposal |
| --- | --- |
| Internal tool, one organisation, < 100 users | Laravel + Blade/Livewire (or .NET Core + Razor), PostgreSQL, single VPS, nightly backups, no cache layer. Boring on purpose. |
| Customer-facing web app / SaaS | React + TypeScript + Vite front end, Laravel or .NET Core API, PostgreSQL, Redis for cache and queues, managed hosting, object storage for files. |
| Marketplace / multi-party | As above, plus a payments provider with escrow or split payouts, a search service once listings pass ~50k, and an audit log from day one. |
| Mobile-first product | React Native (shared TypeScript with web) or native if the app needs deep device features; same API and database as the web option. |
| Content site with a bit of app | Next.js + TypeScript, headless CMS or Markdown in the repo, PostgreSQL only if there is real user data. |
| Data / reporting heavy | Existing app stack, plus a read replica for reports and scheduled aggregation tables. Do not reach for a warehouse before the numbers demand it. |

---

## Per-layer options

### Front end (web)

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| React + TypeScript (Vite) | Interactive app, many stateful screens, the team knows React | Largest hiring pool; front end and back end deploy separately |
| Next.js | Public pages need to rank on Google, or server rendering matters | More capable, more moving parts to host and understand |
| Blade + Livewire (Laravel) / Razor (.NET) | Back-end-heavy CRUD, small team, no separate front-end developer | One codebase, one deploy, far less work - loses out on very rich interactivity |
| Vue | The team already uses Vue | Fine choice; do not introduce it alongside React in one product |

### Mobile

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Responsive web only | The app does not need the camera, push notifications, offline use, or a store listing | Cheapest by far; no app-store review, instant updates |
| React Native | A real installable app is required and the team writes TypeScript | One codebase for iOS and Android; roughly doubles front-end effort vs web-only |
| Native (Swift / Kotlin) | Heavy device use - background location, Bluetooth, camera pipelines, offline-first | Best experience, two codebases, two skill sets to hire |

### Back end

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Laravel (PHP) | CRUD-heavy business app, fast delivery, cheap hosting, PHP team | Batteries included - auth, queues, jobs, admin - very fast to ship |
| .NET Core (C#) | Enterprise or Microsoft-shop environment, strong typing valued, heavy computation | Excellent performance and tooling; Windows-shop familiarity helps |
| Node.js + TypeScript (NestJS / Express) | One language across front and back end, real-time features | Shared types front to back; needs more discipline on structure |
| Serverless functions | Very spiky or very low traffic, no server to run | Near-zero idle cost; cold starts, harder local development, vendor lock-in |

### Database

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| PostgreSQL | The default for anything relational - orders, users, money, reports | Handles JSON, full-text search and reporting well enough to delay every other choice |
| MySQL / MariaDB | The team or the host already runs it | Fine; slightly weaker on advanced queries and JSON |
| SQL Server | .NET shop with existing licences | Strong tooling; licence cost is the main consideration |
| SQLite | Single-user desktop, small internal tool, or embedded | One file, zero administration; not for concurrent multi-user writes |
| MongoDB | Genuinely schemaless documents and no cross-record reporting | Rarely the right call for business data - if the report needs a join, use Postgres |

### Cache, queues and background work

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Nothing | Under a few hundred users, no slow operations | One less thing to run and pay for. Start here |
| Redis | Sessions, caching, queues, rate limits all at once | One extra service, cheap, well understood |
| Database-backed queue (Laravel / Hangfire) | Occasional background jobs, no Redis yet | Zero new infrastructure; fine up to modest volume |
| Managed queue (SQS / Service Bus) | Jobs must survive anything and scale independently | Very reliable, cloud-specific, more setup |

### Files and media

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Object storage (S3 / R2 / Blob Storage) | Any user-uploaded file | Cheap, unlimited, survives server rebuilds. The default |
| Local disk | Single server, small volume, backups already cover it | Simplest, but blocks running more than one server later |

### Login and identity

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Framework's built-in auth | Email and password, roles, ordinary needs | No extra cost or vendor; you own the security work |
| Social / company account login (Google, Microsoft) | Staff already have company accounts, or consumers hate passwords | Fewer passwords to manage; depends on the provider being up |
| Managed identity service (Auth0, Entra ID, Cognito) | Enterprise single sign-on, or compliance demands it | Someone else handles the hard parts; a monthly bill that scales with users, and awkward to migrate away from |

### Payments

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Stripe / equivalent international | Cards, subscriptions, international customers | Fastest to build, per-transaction fee, handles compliance |
| Local gateway (e.g. VNPay, MoMo, ZaloPay) | Domestic customers who expect local methods | Necessary for local conversion; integration quality varies |
| Bank transfer + manual confirmation | Low volume, B2B invoicing, fees matter more than convenience | No fees, no integration; someone reconciles payments by hand |

### Email, SMS and notifications

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Transactional email service (Postmark, SES, SendGrid) | Any system that sends email | Cheap and deliverable; self-hosted mail lands in spam - do not attempt it |
| SMS / Zalo / WhatsApp provider | Notifications must reach people who ignore email | Per-message cost; check local provider rules early |
| Push notifications | An installed mobile app exists | Free, but requires the app and store setup |

### Search

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Database queries + indexes | Under ~50k records, exact and prefix matching is enough | Free, already there. Start here |
| PostgreSQL full-text search | Text search over moderate data, no typo tolerance needed | Still no new service to run |
| Meilisearch / Typesense / Elasticsearch | Typo tolerance, faceted filters, large catalogues | Noticeably better search; a service to run, keep in sync and pay for |

### Hosting

| Option | Pick it when | What it means in practice |
| --- | --- | --- |
| Single VPS (Hetzner, DigitalOcean, local provider) | Internal tools, early products, tight budget | A few dollars a month; you patch the server and own the uptime |
| Managed platform (Render, Fly, App Service, Elastic Beanstalk) | Small team, no one wants to be a sysadmin | Deploys and scaling handled; more per month, some lock-in |
| Kubernetes | Multiple teams, many services, someone whose job is operating it | Only justified when that person already exists |
| On-premise | Data must not leave the building, by law or contract | Full control; you own hardware, patching, backups and downtime |

### CI/CD, monitoring and backups

| Layer | Default proposal | Note |
| --- | --- | --- |
| CI/CD | GitHub Actions (or the platform already in use) | Build, test, deploy on merge. Non-negotiable, even for small projects |
| Error tracking | Sentry (free tier is usually enough) | The single highest-value operational tool |
| Uptime monitoring | Any external ping service with alerts | Catches the failures your own logs cannot report |
| Metrics / dashboards | Host's built-in metrics until they are not enough | Do not deploy Prometheus and Grafana for one server |
| Backups | Automated daily database dump to object storage, retention stated, **restore tested** | An untested backup is not a backup. Must satisfy the RPO/RTO in the NFRs |

---

## Build versus buy

Default to buying anything where a mistake is a security incident: payments, identity, email delivery. Build the part that is actually your product.

| Capability | Buy when | Build when |
| --- | --- | --- |
| Payments | Always, unless volume makes fees unbearable | Practically never |
| Login / SSO | Enterprise SSO, compliance, or many providers | Ordinary email-and-password inside a framework that already provides it |
| Email delivery | Always | Never self-host outbound mail |
| File conversion, OCR, transcription | It is a side feature | It is the core product |
| Search | Typo tolerance and facets matter | The database still handles it |
| Reporting / dashboards | Users need to build their own reports | A fixed set of reports the team defines |

---

## Cost of ownership - answer these before proposing any layer

- What does it cost per month at launch, and at 10x the launch load?
- Who patches and upgrades it, and how often is that needed?
- How hard is it to hire someone who knows it, locally?
- What happens if the vendor triples the price, is acquired, or shuts down?
- How long would migrating away take - days, weeks, or a rewrite?
- Does it hold the only copy of anything? If so, how does data get out?

Anything scoring badly on the last three is **lock-in**: name it explicitly in the proposal so the user chooses it with open eyes.
