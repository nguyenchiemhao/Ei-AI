# Ei-AI — Thiết kế cấu trúc mã nguồn

> Tài liệu con của [Kế hoạch triển khai 4 phần](./ei-ai-implementation-plan.md). Thiết kế cấu trúc thư mục và ranh giới module trước khi viết dòng code đầu tiên.

**Trạng thái:** bản nháp chờ review · 2026-09-09

---

## 1. Năm nguyên tắc chi phối cấu trúc

Mỗi nguyên tắc dưới đây tạo ra một quyết định cụ thể về thư mục, không phải khẩu hiệu.

| # | Nguyên tắc | Hệ quả lên cấu trúc |
| --- | --- | --- |
| **1** | **Dựng hết bộ khung ngay Phần 1** | Tất cả 12 module có thư mục và `*.module.ts` từ đầu, kể cả module của Phần 3. Module chưa làm chỉ có một controller trả `501`. Không ai phải tái cấu trúc ở tuần 14 |
| **2** | **Ranh giới module là thật, không phải quy ước** | Module giao tiếp qua interface trong `ports/`, không import trực tiếp service của nhau. Có test kiến trúc chạy trong CI để chặn vi phạm |
| **3** | **Câu SQL retrieval phải đọc được bằng mắt** | Truy vấn hybrid nằm trong **một file riêng**, viết SQL thuần, không sinh ra bởi ORM. Permission predicate phải nhìn thấy được khi review |
| **4** | **`governance` là đường duy nhất ra ngoài** | `connectors.invoke()` nhận `approvalId` bắt buộc. Test kiến trúc cấm mọi module khác import `connectors` |
| **5** | **Types dùng chung end-to-end** | `packages/shared-types` là nguồn sự thật duy nhất cho DTO, mã lỗi và feature flag. Web và API cùng import; parser Python đối chiếu bằng schema pydantic |

---

## 2. Cây thư mục gốc

```
ei-ai/
├─ apps/
│  ├─ api/                    # NestJS 11 — modular monolith (API + worker cùng image)
│  ├─ web/                    # React 19 + Vite 6
│  └─ parser/                 # Python 3.12 — Docling + Tesseract (dùng từ Phần 2)
│
├─ packages/
│  ├─ shared-types/           # DTO, mã lỗi, feature flag — dùng chung web ↔ api
│  ├─ eslint-config/          # cấu hình lint dùng chung
│  └─ tsconfig/               # tsconfig base dùng chung
│
├─ infra/
│  ├─ compose/                # docker-compose.yml + profile gpu, monitoring
│  ├─ postgres/               # script init: CREATE EXTENSION vector, unaccent
│  ├─ squid/                  # cấu hình egress proxy (Phần 3)
│  └─ scripts/                # seed, backup, restore, bundle offline
│
├─ eval/
│  ├─ golden-set/             # 150 câu hỏi chuẩn — tài sản dài hạn, nằm trong git
│  └─ runner/                 # harness chạy eval (Phần 2)
│
├─ docs/
│  ├─ design/                 # thiết kế hệ thống
│  ├─ plan/                   # kế hoạch triển khai
│  └─ ops/                    # tài liệu vận hành (Phần 4)
│
├─ .devcontainer/             # devcontainer.json
├─ .github/workflows/         # CI 9 stage
├─ package.json               # scripts cấp gốc
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ .gitignore
```

**Vì sao `eval/` nằm ở gốc chứ không trong `apps/api`:** bộ golden set là tài sản của khách hàng và của dự án, không phải của một service. Nó sống lâu hơn mọi lựa chọn kỹ thuật — đổi model, đổi framework thì nó vẫn còn. Đặt ở gốc để không ai coi nó là phụ kiện của backend.

---

## 3. `apps/api` — Backend

### 3.1 Toàn cảnh

```
apps/api/
├─ Dockerfile                 # multi-stage: target `dev` và `prod`
├─ package.json
├─ tsconfig.json
├─ nest-cli.json
└─ src/
   ├─ main.ts                 # bootstrap HTTP server
   ├─ worker.main.ts          # bootstrap BullMQ consumer — CÙNG image, khác entrypoint
   ├─ app.module.ts           # gom module, cấu hình global
   │
   ├─ common/                 # hạ tầng HTTP dùng chung — "API gateway module" của thiết kế
   ├─ config/                 # đọc và validate biến môi trường
   ├─ database/               # kết nối, migration, kiểu dữ liệu
   ├─ ports/                  # interface cho những thứ có thể thay thế
   ├─ adapters/               # cài đặt cụ thể của các port
   └─ modules/                # 12 module nghiệp vụ
```

### 3.2 `common/` — hạ tầng HTTP

```
common/
├─ guards/
│  ├─ jwt-auth.guard.ts           # xác thực access token
│  ├─ roles.guard.ts              # 5 system role — FR-49
│  └─ workspace-role.guard.ts     # 3 workspace role — FR-50
├─ decorators/
│  ├─ current-user.decorator.ts   # @CurrentUser() trong controller
│  ├─ roles.decorator.ts          # @Roles('Administrator')
│  └─ workspace-role.decorator.ts # @WorkspaceRole('Editor')
├─ filters/
│  └─ problem-json.filter.ts      # mọi lỗi ra RFC 7807 — thống nhất toàn hệ thống
├─ interceptors/
│  ├─ correlation-id.interceptor.ts    # một id xuyên suốt request — NFR-15
│  └─ audit-transaction.interceptor.ts # mở transaction để audit ghi cùng hành động
├─ pipes/
│  └─ zod-validation.pipe.ts      # validate body/query bằng schema từ shared-types
└─ errors/
   ├─ error-codes.ts              # DOC_CONTENT_MISMATCH, AUTH_ACCOUNT_LOCKED…
   └─ app-exception.ts            # lớp lỗi mang mã + HTTP status
```

**`audit-transaction.interceptor.ts` là chỗ đáng chú ý.** Thiết kế yêu cầu bản ghi audit và hành động nó mô tả phải nằm trong **cùng một transaction** — không thể có chuyện hành động thành công mà audit thất bại. Interceptor này mở transaction trước controller và commit sau, để service chỉ việc gọi `auditService.record()` mà không phải tự quản lý transaction.

### 3.3 `database/` — tầng dữ liệu

```
database/
├─ database.module.ts
├─ db.ts                      # khởi tạo kết nối, export instance
├─ types.ts                   # kiểu bảng, sinh từ schema
├─ transaction.ts             # helper chạy trong transaction
└─ migrations/
   ├─ 001_extensions.sql      # CREATE EXTENSION vector, unaccent; các ENUM
   ├─ 002_identity.sql        # users, sessions, refresh_tokens, group_mappings
   ├─ 003_workspaces.sql      # workspaces, workspace_members, documents,
   │                          #   document_grants, document_versions, pages, chunks
   ├─ 004_answering.sql       # turns, answers, claims, citations,
   │                          #   plan_steps, approval_requests, approval_decisions
   ├─ 005_audit.sql           # audit_events, egress_records, mcp_servers, mcp_tools
   └─ 006_indexes.sql         # HNSW trên chunks.embedding, GIN trên text_search, FK index
```

**Migration là SQL thuần, đánh số, forward-only.** Khách hàng tự host và một IT generalist phải đọc hiểu được khi debug lúc 2 giờ sáng. Migration sinh ra bởi ORM không đáp ứng được điều đó.

**Toàn bộ bảng tạo ngay ở Phần 1**, kể cả bảng của Phần 3. Bảng rỗng tốn 0 byte; đổi schema ở tuần 14 tốn nhiều ngày.

### 3.4 `ports/` và `adapters/` — chỗ có thể thay thế

```
ports/
├─ model-provider.port.ts     # sinh văn bản — vLLM | Anthropic | llama.cpp
├─ vector-store.port.ts       # tìm kiếm vector — pgvector | Qdrant
└─ storage.port.ts            # lưu file — local FS | S3/MinIO

adapters/
├─ model-provider/
│  ├─ anthropic.adapter.ts    # dev-hybrid — mặc định Phần 1–2
│  ├─ llamacpp.adapter.ts     # dev-local
│  └─ vllm.adapter.ts         # prod
├─ vector-store/
│  └─ pgvector.adapter.ts
├─ storage/
│  └─ local-fs.adapter.ts
└─ embedding/
   └─ infinity.client.ts      # BGE-M3 + BGE-reranker qua HTTP
```

**Chỉ ba thứ được có seam.** Thiết kế nói rõ: model provider và vector store là hai thứ khả năng đổi trong 12 tháng; storage là thứ khách hàng hay có sẵn hạ tầng riêng. Mọi thứ khác **không** được trừu tượng hoá — abstraction đầu cơ là chi phí trả ngay cho lợi ích thường không bao giờ tới.

`embedding/infinity.client.ts` cố tình **không** có port. Embedding không đổi được nếu không re-embed toàn bộ corpus (~6 giờ GPU), nên nó không phải một lựa chọn có thể hoán đổi — nó là một quyết định.

### 3.5 `modules/` — 12 module nghiệp vụ

Mỗi module theo cùng một khuôn, để ai mở module lạ cũng biết tìm gì ở đâu:

```
modules/<tên>/
├─ <tên>.module.ts            # khai báo NestJS
├─ <tên>.controller.ts        # bề mặt HTTP — chỉ điều phối, không nghiệp vụ
├─ <tên>.service.ts           # nghiệp vụ
├─ <tên>.repository.ts        # truy vấn database
├─ dto/                       # kiểu request/response, schema zod
└─ *.spec.ts                  # test đơn vị nằm cạnh file nó test
```

| Module | Phần | Trách nhiệm | FR |
| --- | --- | --- | --- |
| `identity` | **1** | Đăng nhập local + OIDC, vòng đời token, phân giải quyền | FR-46 – FR-54 |
| `workspaces` | **1** | Workspace CRUD, thành viên, vai trò trong workspace | FR-01, FR-50, FR-51 |
| `ingestion` | **1** | Upload, validate, lưu file, chunk, embed, trạng thái, retry | FR-02, FR-04 – FR-09 |
| `retrieval` | **1** | Tìm kiếm hybrid **có permission predicate**, rerank | FR-11 – FR-13 |
| `audit` | **1** | Ghi event append-only, hash chain, tìm kiếm, export | FR-55 – FR-57 |
| `admin` | **1** | Health, cảnh báo, backup/restore, licence, quản trị người dùng | FR-58 – FR-63 |
| `answering` | 2 | Draft, verifier, lọc claim, citation, refusal, streaming | FR-14 – FR-22 |
| `evaluation` | 2 | Chạy golden set, tính chỉ số, so sánh giữa các lần chạy | FR-60 |
| `governance` | 3 | Plan, cổng phê duyệt — **đường duy nhất ra ngoài tập tài liệu** | FR-23 – FR-31 |
| `connectors` | 3 | Registry MCP, discovery, phân loại read/write, gọi tool | FR-32 – FR-38 |
| `egress` | 3 | Allowlist, sinh cấu hình Squid, ghi và đối soát egress | FR-39, FR-40, FR-45 |
| `model-provider` | 3 | Quản trị provider, xác nhận, banner, chọn theo workspace | FR-41 – FR-44 |

Module của Phần 2–3 ở Phần 1 chỉ có `*.module.ts` và một controller trả `501` kèm `feature` và `plannedPhase` — đủ để viết test hợp đồng API ngay từ bây giờ.

### 3.6 Hai module phá khuôn, có lý do

**`retrieval` — vì một lỗi ở đây làm rò tài liệu qua citation (threat T-02):**

```
modules/retrieval/
├─ retrieval.module.ts
├─ retrieval.service.ts
├─ hybrid-search.repository.ts     # ★ CÂU SQL DUY NHẤT ĐƯỢC PHÉP ĐỌC chunks
├─ rank-fusion.ts                  # RRF — hàm thuần, dễ test
├─ dto/
└─ __tests__/
   ├─ permission-predicate.spec.ts # khẳng định SQL sinh ra CÓ CHỨA predicate
   ├─ leakage.spec.ts              # user A không thấy chunk của B ở bất kỳ đâu
   └─ rank-fusion.spec.ts
```

`hybrid-search.repository.ts` là file duy nhất trong toàn bộ codebase được phép viết truy vấn lên bảng `chunks`. Test kiến trúc chặn mọi file khác. Lý do: permission predicate phải nằm **trong** câu truy vấn, và cách duy nhất đảm bảo điều đó là chỉ có một chỗ viết truy vấn.

**`governance` — vì một lỗi ở đây cho phép chỉ dẫn nhúng trong tài liệu chạm tới mạng (threat T-01):**

```
modules/governance/
├─ governance.module.ts
├─ plan.service.ts                 # dựng và cập nhật plan
├─ approval.service.ts             # tạo, quyết định, hết hạn
├─ execution.gateway.ts            # ★ ĐƯỜNG DUY NHẤT gọi connectors.invoke()
├─ pre-authorisation.service.ts
├─ dto/
└─ __tests__/
   ├─ no-bypass.spec.ts            # test kiến trúc: không module nào khác import connectors
   ├─ approval-immutability.spec.ts # DB từ chối UPDATE/DELETE
   └─ expiry.spec.ts
```

---

## 4. `apps/web` — Frontend

```
apps/web/
├─ Dockerfile
├─ index.html
├─ vite.config.ts
├─ tailwind.config.ts
└─ src/
   ├─ main.tsx
   ├─ app/
   │  ├─ router.tsx              # khai báo toàn bộ 19 route, kể cả route "Sắp có"
   │  ├─ providers.tsx           # TanStack Query, auth, theme
   │  └─ layout/
   │     ├─ AppShell.tsx
   │     ├─ Sidebar.tsx          # menu, hiện badge "Sắp có" theo FEATURE_STATUS
   │     └─ ProviderBanner.tsx   # banner provider ngoài — FR-43
   │
   ├─ features/
   │  ├─ auth/                   # P1 · sign in, oidc callback
   │  ├─ workspaces/             # P1 · list, detail, members
   │  ├─ documents/              # P1 · list, upload, detail
   │  ├─ search/                 # P1 · "Tìm trong tài liệu"
   │  ├─ answer/                 # P2 · streaming answer, citation chip
   │  ├─ sources/                # P2 · source viewer, highlight
   │  ├─ audit/                  # P2 · audit log
   │  ├─ plan/                   # P3 · plan panel
   │  ├─ approvals/              # P3 · inbox, detail
   │  └─ admin/                  # health (P1), users (P1), connectors/egress (P3),
   │                             #   eval (P2), restore (P4)
   │
   ├─ components/
   │  ├─ ui/                     # shadcn primitives — không sửa tay
   │  └─ common/
   │     ├─ ComingSoon.tsx       # khung "Sắp có" — mô tả + phần dự kiến + wireframe
   │     └─ Wireframe.tsx        # khung xám tĩnh mô phỏng bố cục màn hình
   │
   ├─ lib/
   │  ├─ apiClient.ts            # fetch wrapper, parse problem+json, refresh token
   │  ├─ sseClient.ts            # Server-Sent Events (P2)
   │  ├─ authStore.ts            # Zustand — user, roles, workspace memberships
   │  ├─ queryClient.ts
   │  └─ features.ts             # đọc FEATURE_STATUS từ GET /me
   └─ styles/
```

Mỗi feature theo cùng khuôn:

```
features/<tên>/
├─ api.ts                        # hook TanStack Query gọi API
├─ types.ts                      # kiểu riêng của feature (kiểu chung nằm ở shared-types)
├─ routes/                       # component cấp trang
├─ components/                   # component riêng của feature
└─ hooks/
```

**Nguyên tắc: web không tự quyết định bảo mật.** Sidebar ẩn mục admin cho Member là để giao diện gọn, không phải để bảo vệ. Mọi kiểm tra quyền thật nằm ở API. Một Member gõ thẳng URL `/admin/users` phải nhận `403` từ server, không phải một màn hình trắng từ router.

---

## 5. `apps/parser` — Worker Python

```
apps/parser/
├─ Dockerfile
├─ pyproject.toml
└─ src/
   ├─ worker.py         # consumer đọc job từ Redis
   ├─ extract.py        # Docling: text, trang, bảng, thứ tự đọc
   ├─ ocr.py            # Tesseract tiếng Việt + tiếng Anh cho trang không có text layer
   ├─ schema.py         # pydantic — đối chiếu với shared-types
   └─ tests/
```

**Service này cố tình không biết gì về nghiệp vụ.** Vào là bytes, ra là text có cấu trúc. Không đọc database, không biết workspace hay quyền là gì. Nếu nó chết, tài liệu xếp hàng chờ nhưng trợ lý vẫn trả lời được bằng những gì đã index.

Ở Phần 1 service này chỉ có khung và được dùng **ngoài luồng** cho spike đo độ chính xác OCR.

---

## 6. `packages/shared-types`

```
packages/shared-types/src/
├─ index.ts
├─ features.ts        # FEATURE_STATUS — nguồn sự thật về tính năng nào đã sẵn sàng
├─ errors.ts          # mã lỗi, khớp với common/errors/error-codes.ts của API
├─ problem.ts         # hình dạng RFC 7807
├─ auth.ts            # LoginRequest, TokenPair, CurrentUser, Role
├─ workspace.ts       # Workspace, WorkspaceMember, WorkspaceRole
├─ document.ts        # Document, DocumentVersion, IngestionStatus
└─ search.ts          # SearchRequest, RetrievedSpan
```

Mỗi kiểu đi kèm một schema zod, dùng cho **cả hai đầu**: API validate request bằng nó, web validate response bằng nó. Một định nghĩa, không có bản sao nào lệch pha.

---

## 7. Quy ước code

Theo hướng dẫn phong cách hiện có của bạn:

| | |
| --- | --- |
| Biến, hàm | `camelCase` |
| Class | `PascalCase` |
| Hằng | `UPPER_SNAKE_CASE` |
| Hàm TypeScript | **arrow function** |
| Khai báo biến | Ở **đầu scope**, nhóm các biến liên quan |
| Comment | Mỗi hàm có một khối comment ngắn: làm gì, input, output. Trong thân hàm chỉ comment khi logic không hiển nhiên |
| Format | Prettier mặc định: 2 space, nháy đơn, có dấu chấm phẩy, trailing comma `es5`, rộng 80 |
| Tên file | `kebab-case.ts` cho API (quy ước NestJS), `PascalCase.tsx` cho component React |

Ví dụ một service theo đúng khuôn:

```ts
// Lấy các đoạn văn được phép đọc, đã xếp hạng, cho một câu hỏi.
// Input: question (string), userId (string), workspaceIds (string[])
// Output: Promise<RetrievedSpan[]> — sắp theo điểm, đã lọc theo ngưỡng
const retrieveSpans = async (
  question: string,
  userId: string,
  workspaceIds: string[]
): Promise<RetrievedSpan[]> => {
  const candidateLimit = 60;
  const keepTop = 8;
  const relevanceFloor = 0.35;

  const embedding = await embeddingClient.embedQuery(question);
  const fused = await hybridSearchRepository.search({
    userId,
    workspaceIds,
    embedding,
    terms: question,
    limit: candidateLimit,
  });

  if (fused.length === 0) return [];

  const reranked = await rerankClient.score(question, fused);
  return reranked.filter((s) => s.score >= relevanceFloor).slice(0, keepTop);
};
```

---

## 8. Test kiến trúc — ranh giới được cưỡng chế, không phải nhắc nhở

Chạy trong CI, fail build khi vi phạm. Dùng `dependency-cruiser`.

| Luật | Vì sao |
| --- | --- |
| Chỉ `modules/retrieval/hybrid-search.repository.ts` được truy vấn bảng `chunks` | Permission predicate chỉ đúng nếu có đúng một chỗ viết truy vấn — T-02 |
| Chỉ `modules/governance/execution.gateway.ts` được import `modules/connectors` | Cổng phê duyệt không thể bị đi vòng — T-01 |
| Module không import service của module khác; chỉ qua `ports/` | Ranh giới monolith là thật |
| `apps/web` không import từ `apps/api`; chỉ qua `packages/shared-types` | Không rò rỉ chi tiết backend ra frontend |
| Không file nào ngoài `adapters/model-provider/` import SDK của provider | `ModelProviderPort` không rò rỉ chi tiết nhà cung cấp |

---

## 9. Năm quyết định cần bạn duyệt

### Q1 · Tầng truy cập database

| | Ưu | Nhược |
| --- | --- | --- |
| **Kysely** *(đề xuất)* | SQL type-safe, sinh ra câu lệnh đọc được; pgvector dùng tự nhiên; không lệch pha với migration SQL thuần | Đội chưa quen; không có decorator/repository sẵn như NestJS quen dùng |
| TypeORM | Quen thuộc, mặc định của NestJS | Entity và migration SQL viết tay là **hai nguồn sự thật**, dễ trôi lệch. Truy vấn hybrid vẫn phải viết raw |
| Prisma | DX tốt nhất | pgvector phải dùng `$queryRaw`; schema Prisma lại là nguồn sự thật thứ ba |

**Đề xuất Kysely.** Nguyên tắc 3 nói câu SQL retrieval phải đọc được bằng mắt — một ORM che đi chính thứ cần nhìn thấy nhất. Và migration đã là SQL thuần, nên thêm ORM là thêm một mô hình dữ liệu song song.

### Q2 · Thư viện validate

**Đề xuất zod**, không dùng `class-validator` mặc định của NestJS. Lý do: schema zod dùng chung được với frontend qua `shared-types`; `class-validator` chỉ chạy phía server nên sẽ phải viết đôi.

### Q3 · Có nên tách `workspaces` thành module riêng

Thiết kế liệt kê 8 module và không có `workspaces` — FR-01/FR-50/FR-51 không có nhà rõ ràng. **Đề xuất tách riêng** thay vì nhét vào `identity` (vốn đã lớn) hay `ingestion` (khác trách nhiệm). Đây là sai lệch có chủ ý so với thiết kế, ghi lại ở đây để không ai tưởng là nhầm.

### Q4 · Vị trí file test

**Đề xuất:** test đơn vị đặt cạnh file nó test (`foo.service.spec.ts`), test tích hợp và test kiến trúc đặt trong `__tests__/` của module. Lý do: test đơn vị đi cùng code khi refactor; test tích hợp thuộc về module chứ không thuộc một file.

### Q5 · `answering` và `governance` — gộp hay tách

Cả hai cùng xử lý một lượt hỏi đáp, và ranh giới giữa chúng sẽ bị chạm liên tục ở Phần 2–3. **Đề xuất giữ tách**, vì `governance` mang bất biến bảo mật T-01 và cần một ranh giới cưỡng chế được bằng test kiến trúc. Gộp lại thì luật "chỉ `execution.gateway.ts` gọi connectors" mất chỗ đứng.

---

## 10. Cái gì thực sự được tạo ở Phần 1

Để tránh hiểu nhầm rằng phải code hết cây thư mục trên:

| Trạng thái | Nội dung |
| --- | --- |
| **Code đầy đủ** | `common/`, `config/`, `database/`, `ports/`, `adapters/{storage,embedding}`, `modules/{identity,workspaces,ingestion,retrieval,audit}`, `apps/web` phần P1, `packages/shared-types` |
| **Chỉ có khung** | `modules/{answering,governance,connectors,egress,evaluation,model-provider}` — mỗi cái một `*.module.ts` và controller trả `501`; `adapters/model-provider/*`; `apps/parser` |
| **Chỉ có thư mục và README** | `infra/squid/`, `eval/runner/`, `docs/ops/` |
