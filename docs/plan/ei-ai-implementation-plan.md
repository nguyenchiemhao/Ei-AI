# Ei-AI — Kế hoạch triển khai 4 phần

> Tài liệu này chuyển [thiết kế hệ thống](../design/ei-ai-self-hosted-knowledge-assistant.md) (63 FR, 7 module) thành lộ trình thi công chia 4 phần. Mỗi phần có một mốc chạy được, một danh sách FR đóng lại, và một tiêu chí nghiệm thu rõ ràng.

**Trạng thái:** v0.2 — đã cập nhật sau vòng review 1
**Tổng effort:** 100 person-weeks / 23 tuần lịch (theo mục 13.2 của thiết kế)
**Đội:** 4–5 người
**Tài liệu con:**
- [Môi trường phát triển](./ei-ai-dev-environment.md) — ADR-07 và ADR-08, kiểm kê máy demo, compose stack, 4 bước chuẩn bị tuần 1
- [Plan tích hợp MCP](./ei-ai-mcp-integration-plan.md) — chi tiết Phần 3

**Phân bổ 63 chức năng:** Phần 1 · 13 · Phần 2 · 22 · Phần 3 · 23 · Phần 4 · 5. Bốn FR (04, 05, 11, 12) đã chuyển từ Phần 2 sang Phần 1 cùng đường ống Markdown; tổng effort không đổi.

---

## Tổng quan 4 phần

| Phần | Tên | Tuần | Effort | Mốc bàn giao |
| --- | --- | --- | --- | --- |
| **1** | Nền tảng — bộ khung chạy được | 1–3 | 14 pw | `docker compose up` → đăng nhập → tạo workspace → upload `.md` → **tìm kiếm ngữ nghĩa được**. Đủ 19 màn hình, màn chưa làm hiện **"Sắp có"** |
| **2** | Core — trợ lý trả lời có kiểm chứng | 4–13 | 42 pw | Hỏi → câu trả lời có citation từng câu → bấm citation → thấy đoạn được highlight trong tài liệu gốc. **Dùng được nội bộ** |
| **3** | MCP tích hợp — plan, phê duyệt, egress | 14–19 | 26 pw | Một kết nối ERP read-only chạy end-to-end qua cổng phê duyệt của con người |
| **4** | Hoàn thiện — vận hành, bảo mật, bàn giao | 20–23 | 18 pw | Health dashboard, backup có kiểm chứng, security review, UAT, bàn giao pilot |

### Nguyên tắc cắt ranh giới

Ranh giới giữa các phần vẽ theo **rủi ro và tính chứng minh được**, không theo độ dễ:

1. **Phần 1 dựng hết bộ khung, không dựng nửa vời.** Toàn bộ schema, toàn bộ route, toàn bộ container dựng ngay từ đầu — vì đổi schema hay đổi cấu trúc thư mục ở tuần 12 đắt gấp nhiều lần làm đúng ở tuần 2.
2. **Phần 2 hoàn thành trọn vẹn lời hứa "verified-or-refused".** Không có chuyện trả lời trước, kiểm chứng sau — verifier nằm cùng Phần 2 với generator, không tách ra.
3. **Phần 3 mới mở đường ra ngoài mạng.** Không một byte nào rời mạng trước khi cổng phê duyệt + egress proxy + audit đã hoạt động.
4. **Phần 4 không thêm tính năng người dùng nào mới** ngoài các FR vận hành — nó chỉ làm hệ thống chịu được việc bàn giao cho một IT generalist.

---

## Môi trường phát triển — ràng buộc đã biết

Ba giả định của bản thiết kế đã được xác nhận lại, và cả ba đều khác so với dự kiến ban đầu. Chúng thay đổi thứ tự thi công chứ không thay đổi kiến trúc.

### Điều kiện thực tế

| Hạng mục | Thiết kế giả định | Thực tế | Hệ quả |
| --- | --- | --- | --- |
| **Tài liệu test** | 200 tài liệu thật của khách, có bản scan | **Chưa có.** Dùng tạm file `.md`, văn bản luật, bảng báo cáo, tài liệu mẫu | Bài test OCR tuần 1 không chạy được như thiết kế. R-01 **vẫn mở** |
| **ERP MCP server** | Có thể phải tự viết wrapper (+3–4 tuần) | **Đã có sẵn MCP server** | Rủi ro lớn nhất của Phần 3 biến mất. MCP tách thành một plan riêng |
| **Phần cứng** | Server có GPU 48 GB, mua ở tuần 0 | **Laptop demo: RTX 3050 Ti, 4 GB VRAM**, i7-12700H 14C/20T, 31,7 GB RAM | Không chạy được Qwen3-32B. Cần một profile model riêng cho dev |

> Chi tiết môi trường — ADR-07, ADR-08, compose stack, tiến độ chuẩn bị — nằm ở [Môi trường phát triển](./ei-ai-dev-environment.md). Mục này chỉ tóm tắt phần ảnh hưởng tới kế hoạch.

### Ràng buộc phần cứng: 4 GB VRAM chạy được gì

| Model | VRAM cần | Trên máy demo |
| --- | --- | --- |
| Qwen3-32B AWQ 4-bit (model sinh của thiết kế) | ~24–48 GB | **Không chạy được** |
| Qwen3-8B 4-bit | ~5–6 GB | Không đủ chỗ khi đã nạp embedding |
| Qwen3-4B 4-bit | ~2,5 GB | Chạy được **một mình**, không cùng embedding |
| BGE-M3 embedding (568M, fp16) | ~1,2 GB | Chạy được |
| BGE-reranker-v2-m3 (568M, fp16) | ~1,2 GB | Chạy được cùng BGE-M3, còn ~1,5 GB dư |

**Kết luận:** 4 GB VRAM đủ cho *retrieval* (embedding + rerank), không đủ cho *generation*. Mà retrieval mới là nơi chất lượng câu trả lời thực sự được quyết định — nên máy demo vẫn làm được phần khó nhất.

### Profile môi trường đề xuất

| Profile | Embedding + rerank | Generation | Dùng khi |
| --- | --- | --- | --- |
| **`dev-hybrid`** *(đã chốt — mặc định cho Phần 1–2)* | BGE-M3 + BGE-reranker trên GPU 4 GB (Infinity) | **Anthropic API** qua `ModelProviderPort`, mặc định `claude-haiku-4-5` | Xây và kiểm chứng logic answering, verifier, citation. Không bị phần cứng cản |
| **`dev-local`** | BGE-M3 + BGE-reranker trên GPU | Qwen3-4B 4-bit trên **CPU** (llama.cpp, 32 GB RAM) | Chứng minh đường local hoạt động. Chạy ở **mỗi cổng nghiệm thu**, không phải chỉ ở cuối |
| **`prod`** | BGE-M3 + BGE-reranker trên GPU 48 GB | Qwen3-32B AWQ trên vLLM | Máy thật của khách, từ Phần 4 |

**Vì sao dùng Anthropic API cho dev là chấp nhận được ở đây, dù sản phẩm là local-first:** corpus dev là văn bản luật công khai và file `.md` mẫu — không có dữ liệu khách hàng nào để rò rỉ. Đây là quyết định về *môi trường phát triển*, không phải về sản phẩm. Seam `ModelProviderPort` trong thiết kế vốn đã tồn tại chính xác cho việc này.

**Rủi ro của quyết định này, và cách khoá lại:** nếu tinh chỉnh prompt suốt 10 tuần dựa trên Claude rồi mới đổi sang Qwen3-32B ở Phần 4, chất lượng có thể tụt mà không ai biết nguyên nhân. Ba biện pháp bắt buộc:

1. **Chạy golden set trên cả hai provider ở mỗi cổng nghiệm thu**, không phải chỉ ở cuối. Chênh lệch điểm giữa hai provider là một chỉ số được theo dõi, không phải một bất ngờ ở tuần 20.
2. **Không viết prompt phụ thuộc vào tính năng riêng của một provider.** Verifier phải trả JSON theo schema tự định nghĩa, không dựa vào citation API riêng của bên nào.
3. **Chốt phần cứng thật trước tuần 14** để Phần 3 và Phần 4 chạy được trên `prod` profile.

**Chọn model dev ở tầng năng lực gần production, không phải tầng cao nhất.** Đích production là Qwen3-32B cục bộ. Nếu dev bằng model mạnh nhất, ta sẽ viết prompt dựa trên năng lực mà model production không có, và cú đổi ở Phần 4 thành một vách đá. Vì thế mặc định dev là `claude-haiku-4-5`; `claude-sonnet-5` chỉ dùng để **đo trần** — chạy golden set bằng nó khi cần biết "kém là do prompt hay do model". Nếu Sonnet cũng sai ở cùng chỗ thì lỗi nằm ở retrieval hoặc prompt, và đó là thông tin đáng giá hơn một điểm số cao.

### Ba việc phải làm trong tuần 1 (đã cập nhật)

| Việc | Vì sao ngay tuần 1 | Nếu kết quả xấu |
| --- | --- | --- |
| **Dựng corpus thay thế** — 30–50 văn bản luật PDF scan từ nguồn công khai + 10–20 bảng báo cáo có bảng biểu + bộ `.md` mẫu | Văn bản luật Việt Nam bản scan là *proxy tốt nhất có thể* cho tài liệu khách: có dấu tiếng Việt, con dấu, bảng, bố cục nhiều cột. Không có tài liệu thật thì đây là thứ gần nhất | Nếu OCR fail ngay trên proxy này thì fail chắc chắn trên tài liệu khách — biết sớm vẫn hơn |
| **Test OCR trên corpus proxy đó** (FR-03, R-01) | Đo được một con số, dù không phải con số cuối cùng | Chuyển sang OCR thương mại, hoặc thu hẹp phạm vi định dạng ở v1 |
| **Dựng profile `dev-hybrid` và benchmark trên laptop** | Cần biết BGE-M3 + reranker có thực sự vừa 4 GB không, và throughput bao nhiêu | Đẩy embedding sang CPU (chậm hơn ~8–10×, vẫn dùng được cho corpus dev nhỏ) |

> **R-01 vẫn là rủi ro mở.** Test trên corpus proxy **không đóng** được rủi ro này — nó chỉ hạ mức từ "hoàn toàn mù" xuống "có một ước lượng". Rủi ro chỉ đóng khi có tài liệu thật của khách. Cần một mốc cụ thể: **tài liệu thật phải có trước tuần 8**, nếu không thì Phần 2 kết thúc mà chưa ai biết OCR có đạt hay không.

### Cái gì bắt đầu được ngay, cái gì đang chờ

Điều quan trọng nhất về lịch: **toàn bộ Phần 1 không cần Anthropic API key.**

Phần 1 làm workspace, phân quyền, upload, chunk, embed và hybrid search. Embedding chạy bằng BGE-M3 trên GPU cục bộ. **Phần 1 không sinh một dòng văn bản nào** — đó là kỷ luật đã chốt ở mục 1.1, không phải giới hạn kỹ thuật. Nên không có chỗ nào cần tới model generation.

Điều đó kéo dài hơn Phần 1: mốc 2A (parser + OCR) và 2B (reranker) cũng chạy hoàn toàn cục bộ.

| Giai đoạn | Tuần | Cần API key? | Trạng thái |
| --- | --- | --- | --- |
| Toàn bộ Phần 1 | 1–3 | Không | **Bắt đầu được ngay** |
| Mốc 2A — parser, OCR, version, purge | 4–6 | Không | **Bắt đầu được ngay** |
| Mốc 2B — reranker, hạn chế cấp tài liệu | 7–9 | Không | **Bắt đầu được ngay** |
| Mốc 2C — verified answering | 9–12 | **Có** | Chờ API key, hoặc chạy `dev-local` |
| Mốc 2D — eval harness | 10–13 | **Có** | Chờ API key |
| Phần 3 | 14–19 | Không, nhưng cần tool catalogue ERP | Chờ tới tuần 12 |
| Phần 4 | 20–23 | Không, nhưng cần phần cứng pilot | Chờ tới tuần 14 |

**Tức là khoảng 9 tuần công việc đầu tiên không bị chặn bởi bất kỳ thứ gì đang chờ.** API key chỉ thành đường găng từ tuần 9. Nếu tới lúc đó vẫn chưa có, `dev-local` (Qwen3-4B trên CPU) vẫn cho phép đi tiếp — chậm và chất lượng thấp hơn, nhưng không dừng.

**Việc chạy song song, không cần môi trường dev:** dựng corpus proxy (văn bản luật bản scan, bảng báo cáo, bộ `.md` mẫu) và bắt đầu soạn cấu trúc bộ golden set cùng khách hàng pilot.

---

# PHẦN 1 — NỀN TẢNG

**Tuần 1–3 · 14 person-weeks · Mục tiêu: một hệ thống chạy được, tìm được, chưa trả lời**

## 1.1 Mục tiêu

Kết thúc Phần 1, một người lạ clone repo, chạy một lệnh, và có ứng dụng thật để bấm: đăng nhập được, tạo workspace được, upload tài liệu `.md` / `.txt`, và **tìm kiếm ngữ nghĩa được trên chính những tài liệu đó**. Mọi màn hình khác đã có trong menu và bấm vào được, nhưng hiện khung **"Sắp có"** mô tả tính năng đó sẽ làm gì.

Lý do làm theo cách này: **hình hài sản phẩm phải nhìn thấy được từ tuần 3**, để khách hàng pilot và đội nội bộ góp ý về luồng và cấu trúc thông tin khi việc sửa còn rẻ — thay vì góp ý ở tuần 13 khi mọi thứ đã cứng.

### Thay đổi so với bản nháp đầu: đường ống "một đường thẳng" cho Markdown

Bản nháp trước để toàn bộ parse / chunk / embed sang Phần 2, và upload dừng ở trạng thái `uploaded`. Vì corpus khởi đầu bây giờ là file `.md`, quyết định đó không còn hợp lý: **Markdown không cần parser, không cần OCR, không cần trích bảng.** Chi phí để chạy hết đường ống cho `.md` / `.txt` chỉ còn là chunk + embed + index — khoảng **1 tuần công**, không phải 1,5 tuần như ước tính khi còn phải lo PDF.

Đổi lại, Phần 1 có một demo thật thay vì một cái vỏ:

- Upload một thư mục `.md` → thấy trạng thái chạy tới `indexed`
- Gõ một câu hỏi → **thấy đúng những đoạn văn liên quan nhất, kèm tên file và vị trí**
- Chưa có câu trả lời sinh ra, chưa có citation, chưa có verifier

**Phần 1 tuyệt đối không sinh văn bản.** Chỉ hiển thị đoạn tìm được. Đây không phải giới hạn kỹ thuật mà là kỷ luật: nguyên tắc "không bao giờ hiện một câu chưa qua verifier" áp dụng từ dòng code đầu tiên. Một demo hỏi-đáp thô ở tuần 3 sẽ tạo ra kỳ vọng sai và một thói quen xấu rất khó bỏ.

Màn hình Ask ở Phần 1 vì thế có tiêu đề **"Tìm trong tài liệu"**, không phải "Hỏi đáp", và chuyển thành hỏi-đáp thật ở mốc 2C.

## 1.2 Cấu trúc codebase

Monorepo pnpm workspaces. Một image cho API và worker (khác entrypoint), một image cho web, một image cho parser Python.

```
ei-ai/
├─ apps/
│  ├─ web/                          # React 19 · Vite 6 · Tailwind 4 · shadcn/ui
│  │  └─ src/
│  │     ├─ app/                    # router, layout, providers (TanStack Query, auth)
│  │     ├─ features/
│  │     │  ├─ auth/                # sign-in, oidc callback
│  │     │  ├─ ask/                 # màn hình landing
│  │     │  ├─ answer/              # streaming answer + citation chip
│  │     │  ├─ sources/             # source viewer + highlight
│  │     │  ├─ workspaces/
│  │     │  ├─ documents/           # list, upload, detail
│  │     │  ├─ plan/                # plan panel
│  │     │  ├─ approvals/           # inbox + detail
│  │     │  ├─ audit/
│  │     │  └─ admin/               # connectors, egress, users, health, eval, restore
│  │     ├─ components/
│  │     │  ├─ ui/                  # shadcn primitives
│  │     │  └─ common/ComingSoon.tsx
│  │     ├─ lib/
│  │     │  ├─ apiClient.ts         # fetch wrapper + problem+json
│  │     │  ├─ sseClient.ts         # Server-Sent Events cho câu trả lời
│  │     │  ├─ authStore.ts         # Zustand
│  │     │  └─ features.ts          # feature flag registry
│  │     └─ styles/
│  │
│  ├─ api/                          # NestJS 11 · Node 22 LTS — modular monolith
│  │  └─ src/
│  │     ├─ main.ts                 # entrypoint API
│  │     ├─ worker.main.ts          # entrypoint ingest-worker (cùng image)
│  │     ├─ app.module.ts
│  │     ├─ common/
│  │     │  ├─ guards/              # JwtGuard, RolesGuard, WorkspaceRoleGuard
│  │     │  ├─ interceptors/        # correlation-id, audit-transaction
│  │     │  ├─ filters/             # problem+json exception filter
│  │     │  └─ validation/          # zod pipes
│  │     ├─ modules/
│  │     │  ├─ identity/            # FR-46 – FR-54
│  │     │  ├─ workspaces/          # FR-01, FR-50, FR-51
│  │     │  ├─ ingestion/           # FR-02, FR-04 – FR-09
│  │     │  ├─ retrieval/           # FR-11 – FR-13
│  │     │  ├─ answering/           # FR-14 – FR-22
│  │     │  ├─ governance/          # FR-23 – FR-31
│  │     │  ├─ connectors/          # FR-32 – FR-38
│  │     │  ├─ egress/              # FR-39, FR-40, FR-45
│  │     │  ├─ audit/               # FR-55 – FR-57
│  │     │  ├─ admin/               # FR-58, FR-59, FR-61 – FR-63
│  │     │  └─ evaluation/          # FR-60
│  │     ├─ ports/
│  │     │  ├─ ModelProviderPort.ts # vLLM | Anthropic
│  │     │  ├─ VectorStorePort.ts   # pgvector | Qdrant
│  │     │  └─ StoragePort.ts       # local FS | S3/MinIO
│  │     └─ database/
│  │        ├─ migrations/
│  │        ├─ entities/
│  │        └─ repositories/
│  │
│  └─ parser/                       # Python 3.12 · Docling · Tesseract · PyMuPDF
│     └─ src/
│        ├─ worker.py               # Redis/BullMQ consumer
│        ├─ extract.py              # text, page, table, reading order
│        └─ ocr.py                  # OCR tiếng Việt + tiếng Anh
│
├─ packages/
│  ├─ shared-types/                 # DTO dùng chung web ↔ api ↔ eval
│  ├─ eslint-config/
│  └─ tsconfig/
│
├─ infra/
│  ├─ compose/
│  │  ├─ docker-compose.yml         # stack mặc định
│  │  ├─ compose.gpu.yml            # profile: vllm + infinity
│  │  └─ compose.monitoring.yml     # profile: prometheus + grafana + loki
│  ├─ squid/                        # egress proxy config template
│  ├─ postgres/                     # init: pgvector, unaccent
│  └─ scripts/                      # backup, restore, seed, bundle
│
├─ eval/
│  ├─ golden-set/                   # bộ 150 câu hỏi chuẩn (version-controlled)
│  └─ runner/
│
├─ docs/{design,plan,ops}/
└─ .github/workflows/               # CI 9 stage
```

**Bốn quyết định cấu trúc cần bạn duyệt:**

| Quyết định | Chọn | Đánh đổi |
| --- | --- | --- |
| Monorepo hay đa repo | Monorepo pnpm | Types dùng chung end-to-end, một PR đổi cả API lẫn web. Đổi lại CI nặng hơn chút |
| API và ingest-worker | Cùng codebase, cùng image, khác entrypoint | Tránh trùng lặp logic; worker vẫn scale độc lập bằng số container |
| Parser Python | Service riêng, chỉ nhận bytes trả text | Parser chết thì tài liệu xếp hàng, nhưng trợ lý vẫn trả lời được |
| Migration | SQL thuần, đánh số, forward-only | Khách tự host, phải đọc hiểu được migration khi debug |

## 1.3 Phạm vi chức năng

**Làm trọn vẹn trong Phần 1:**

| FR | Chức năng | Ghi chú |
| --- | --- | --- |
| FR-01 | Tạo / đổi tên / lưu trữ workspace | Đầy đủ |
| FR-02 | Upload 9 định dạng, ZIP, giới hạn kích thước | Nhận, validate, lưu đủ 9 định dạng; **chỉ `.md` / `.txt` chạy hết đường ống**, còn lại dừng ở `uploaded` chờ parser ở Phần 2 |
| FR-04 | Chunk 200–400 token, overlap 15%, giữ offset ký tự | Cho đường `.md` / `.txt`. Offset phải resolve được về text gốc ngay từ bây giờ |
| FR-05 | Embedding vector + full-text search vector | BGE-M3 qua Infinity trên GPU 4 GB |
| FR-11 | Hybrid: dense vector + full-text, fusion RRF | Cho corpus `.md`. Rerank (FR-13) để Phần 2 |
| FR-12 | **Permission predicate nằm TRONG câu SQL** | Làm đúng ngay từ truy vấn đầu tiên. Không bao giờ có phiên bản "lọc sau" để rồi phải sửa |
| FR-09 | Từ chối file content-type không khớp đuôi | Đầy đủ — đây là biện pháp bảo mật, không hoãn được |
| FR-46 | Đăng nhập local, Argon2id, password policy | Đầy đủ |
| FR-49 | 5 system role | Guard đầy đủ, có test cho từng cặp role/action |
| FR-50 | 3 workspace role | Đầy đủ |
| FR-53 | Access token 15 phút + refresh xoay vòng 8h, thu hồi family khi reuse | Đầy đủ |
| FR-54 | Rate limit auth + khoá account sau 10 lần fail | Đầy đủ |
| FR-55 | Audit event append-only | Khung ghi event trong cùng transaction; hash chain để Phần 2 |

**Làm một phần (khung + stub):**

| FR | Trong Phần 1 có gì | Còn thiếu gì |
| --- | --- | --- |
| FR-03 | **Spike OCR trên corpus proxy** (luật scan + bảng báo cáo) — chạy ngoài luồng, chỉ để đo | Chưa nối vào pipeline. Chưa test được trên tài liệu thật của khách |
| FR-06 | State machine đầy đủ cho đường `.md` / `.txt` + retry | Đường PDF/DOCX/ảnh chưa có vì parser ở Phần 2 |
| FR-47 | Luồng OIDC redirect + callback tạo user | Chưa map group → role |
| FR-58 | `/admin/health` trả 4 chỉ số: DB, Redis, disk, embedding service | 7 chỉ số còn lại cần service của Phần 2, 3 |

**Hiện "Sắp có"** (route có, màn hình có, chức năng chưa có): Answer, Refusal, Source viewer, Plan panel, Approval inbox, Approval detail, Connectors admin, Egress & providers admin, Audit log, Evaluation, Restore.

Màn hình Ask **không** ở trạng thái "Sắp có" nữa — nó hoạt động thật, ở dạng tìm kiếm ngữ nghĩa, với nhãn "Tìm trong tài liệu".

## 1.4 Cơ chế "Sắp có"

Không phải màn hình trắng, cũng không phải link chết. Cơ chế cụ thể:

1. `packages/shared-types` khai báo một registry tính năng:

```ts
// Trạng thái sẵn sàng của từng tính năng, dùng chung giữa API và web
// Input: không
// Output: bản đồ tên tính năng → trạng thái
export const FEATURE_STATUS = {
  workspaces: 'ready',
  documentUpload: 'ready',
  documentSearch: 'ready',
  askAnswer: 'coming_soon',
  sourceViewer: 'coming_soon',
  planPanel: 'coming_soon',
  approvals: 'coming_soon',
  connectors: 'coming_soon',
  egress: 'coming_soon',
  auditLog: 'coming_soon',
  evaluation: 'coming_soon',
  restore: 'coming_soon',
} as const;
```

2. `GET /me` trả trạng thái này cùng roles và workspace memberships — một nguồn sự thật duy nhất, bật bằng biến môi trường khi tính năng lên.
3. Route vẫn tồn tại. Item trong menu vẫn hiện, kèm badge **"Sắp có"** màu xám.
4. Component `<ComingSoon>` hiển thị: tên tính năng, đoạn mô tả tính năng sẽ làm gì (lấy từ thiết kế), phần dự kiến có, và một wireframe tĩnh của màn hình đó.
5. API trả `501 Not Implemented` theo chuẩn problem+json cho endpoint chưa có, kèm `feature` và `plannedPhase` — để test hợp đồng API viết được ngay từ Phần 1.

**Giá trị:** demo được toàn bộ luồng sản phẩm ở tuần 3, thu được góp ý về navigation khi sửa còn rẻ, và tránh việc màn hình admin bị dồn hết vào cuối dự án.

## 1.5 Hạ tầng & CI

- **Compose stack mặc định:** `postgres` (17.2 + pgvector 0.8 + unaccent), `redis` (7.4), `api`, `ingest-worker`, `web`, `parser`. GPU (`vllm`, `infinity`) và monitoring nằm ở profile riêng để máy dev không GPU vẫn chạy được.
- **Schema đầy đủ ngay Phần 1:** `workspaces`, `workspace_members`, `documents`, `document_grants`, `document_versions`, `pages`, `chunks`, `turns`, `answers`, `claims`, `citations`, `plan_steps`, `approval_requests`, `approval_decisions`, `audit_events`, `egress_records`, cộng các bảng identity và connectors. Bảng chưa dùng vẫn tạo — vì migration phá vỡ ở giữa dự án đắt hơn nhiều so với vài bảng rỗng.
- **CI 9 stage:** lint → typecheck → unit test → build → migration test → integration test (Testcontainers) → security scan → image build → push GHCR.
- **Seed data:** 1 admin, 3 user mẫu, 2 workspace, 20 tài liệu mẫu — để ai cũng chạy và bấm thử được ngay.

## 1.6 Tiêu chí nghiệm thu Phần 1

- [ ] `docker compose up` trên máy sạch → hệ thống chạy, không cần thao tác thủ công nào ngoài file `.env`
- [ ] Đăng nhập tài khoản local; sai 11 lần liên tiếp bị khoá với mã `AUTH_ACCOUNT_LOCKED`
- [ ] Replay một refresh token đã dùng → toàn bộ family bị thu hồi
- [ ] Tạo workspace, thêm thành viên với 3 workspace role; Reader không upload được, Editor không đổi được thành viên
- [ ] Upload 1 PDF, 1 DOCX, 1 ZIP 50 file → thấy trong danh sách trạng thái `uploaded`
- [ ] Upload một thư mục `.md` → trạng thái chạy tới `indexed`, số chunk khớp
- [ ] Gõ một câu hỏi ở màn Ask → **trả về đúng những đoạn liên quan nhất, kèm tên file và vị trí**
- [ ] **Không có một dòng văn bản sinh ra nào trong toàn bộ Phần 1**
- [ ] Test khẳng định câu SQL retrieval đã chứa permission predicate ngay từ bây giờ
- [ ] Upload file `.pdf` chứa executable → bị từ chối với `DOC_CONTENT_MISMATCH`
- [ ] Cả 19 màn hình mở được; màn chưa làm hiện "Sắp có" với mô tả và wireframe
- [ ] CI xanh cả 9 stage; coverage ma trận phân quyền đạt 100% cặp role/action
- [ ] **Báo cáo OCR trên corpus proxy** (luật scan + bảng báo cáo), có số cụ thể so với bản chép tay
- [ ] **Báo cáo benchmark trên laptop demo:** BGE-M3 + reranker có vừa 4 GB VRAM không, throughput bao nhiêu chunk/giây
- [ ] Profile `dev-hybrid` và `dev-local` đều khởi động được bằng một lệnh

## 1.7 Rủi ro Phần 1

| Rủi ro | Xác suất | Xử lý |
| --- | --- | --- |
| **Chưa có tài liệu thật của khách để đóng R-01** | **Cao — đã xảy ra** | Test trên corpus proxy (luật scan, bảng báo cáo) chỉ hạ rủi ro chứ không đóng. **Đặt mốc cứng: tài liệu thật phải có trước tuần 8** |
| OCR tiếng Việt trên tài liệu scan không đạt 90% (R-01) | Trung bình | Đo trên proxy ở tuần 1. Dự phòng: OCR thương mại, hoặc thu hẹp phạm vi định dạng ở v1 |
| BGE-M3 + reranker không vừa 4 GB VRAM | Thấp | Tổng ~2,4 GB fp16, còn dư. Nếu vẫn chật: đẩy reranker sang CPU, hoặc chạy embedding theo batch nhỏ |
| Phụ thuộc Anthropic API cho generation ở dev che mất vấn đề của model local | Trung bình | Chạy golden set trên **cả hai** provider ở mỗi cổng nghiệm thu, không đợi tới Phần 4 |
| Chưa chốt phần cứng thật cho khách | Trung bình | Không chặn Phần 1–2. **Phải chốt trước tuần 14** để Phần 3–4 chạy trên profile `prod` |

---

# PHẦN 2 — CORE

**Tuần 4–13 · 42 person-weeks · Mục tiêu: trợ lý trả lời có kiểm chứng, dùng được nội bộ**

## 2.1 Mục tiêu

Đây là phần quyết định sản phẩm có được tin hay không. Kết thúc Phần 2, một nhân viên gõ câu hỏi và nhận về câu trả lời mà **mọi câu đều có citation dẫn tới tài liệu và số trang**, bấm vào citation là thấy đúng đoạn văn được highlight trong trang gốc — hoặc nhận một lời từ chối tường minh nói rõ đã tìm ở đâu và không thấy gì.

Nguyên tắc bất di bất dịch của phần này: **không bao giờ hiển thị một câu chưa qua verifier.** Không có chuyện chữ hiện lên rồi biến mất.

## 2.2 Chia thành 4 mốc nhỏ

| Mốc | Tuần | Nội dung | Demo được gì |
| --- | --- | --- | --- |
| **2A — Mở rộng ingestion** | 4–6 | Nối parser Python + OCR vào đường ống đã có từ Phần 1; mở rộng cho PDF/DOCX/XLSX/ảnh; version, purge, retry cho đường parser | Upload 500 trang PDF scan → 10 phút sau trạng thái `indexed`, xem được số chunk và phương pháp trích xuất từng trang |
| **2B — Retrieval đầy đủ** | 7–9 | Thêm reranker cross-encoder vào truy vấn hybrid đã có + hạn chế quyền cấp tài liệu | Gõ từ khoá → trả về đúng 8 đoạn liên quan nhất; user không có quyền không bao giờ thấy đoạn bị cấm |
| **2C — Verified answering** | 9–12 | Draft → verifier → lọc claim → citation → streaming → refusal → follow-up | **Luồng chính của sản phẩm chạy end-to-end** |
| **2D — Đo lường & quản trị** | 10–13 | Eval harness, audit hash chain + search + export, OIDC group mapping | Chạy 150 câu hỏi chuẩn, ra báo cáo precision/recall/refusal/latency |

## 2.3 Phạm vi chức năng

### Mốc 2A — Mở rộng ingestion (FR-03, FR-06 – FR-08)

FR-04 và FR-05 đã hoàn thành cho đường `.md` / `.txt` ở Phần 1. Mốc này tái sử dụng chúng nguyên vẹn và chỉ nối thêm parser vào đầu đường ống.

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-03 | Trích xuất text, trang, bảng, thứ tự đọc + OCR | Ngưỡng nghiệm thu: ≥90% từ đúng trên PDF scan tiếng Việt 20 trang |
| FR-04 | Chunk 200–400 token, overlap 15%, giữ trang + offset ký tự | **Offset phải resolve được về text gốc** — đây là thứ làm cho citation viewer hoạt động |
| FR-05 | Embedding vector + full-text search vector | Số chunk có embedding phải bằng tổng số chunk sau khi ingest xong |
| FR-06 | State machine 8 trạng thái + lý do lỗi + retry | Có fixture PDF hỏng để test đường lỗi |
| FR-07 | Version mới, đánh dấu bản cũ `superseded` | Câu trả lời cũ vẫn resolve được citation về đúng version nó đã trích |
| FR-08 | Purge vĩnh viễn + ghi audit | Sau purge: không chunk nào retrievable, không file nào còn trong storage |

**Code phát sinh:** `modules/ingestion/*`, `apps/parser/*`, BullMQ queue + retry policy, `StoragePort` triển khai local FS.

### Mốc 2B — Retrieval đầy đủ (FR-13, FR-51)

FR-11 và FR-12 đã hoàn thành ở Phần 1 cho corpus Markdown, kể cả permission predicate. Mốc này thêm reranker và hạn chế cấp tài liệu, rồi đo lại trên corpus đã có PDF.

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-11 | Hybrid: dense vector + full-text, fusion 2 danh sách (RRF) | Số part-number tra được dù câu hỏi diễn đạt khác hoàn toàn |
| FR-12 | **Permission predicate nằm TRONG câu SQL** | Có test khẳng định SQL sinh ra chứa predicate; chunk bị cấm không bao giờ vào memory, log hay prompt |
| FR-13 | Rerank cross-encoder, giữ top 8 | nDCG@8 tăng ≥0.05 so với chưa rerank |
| FR-51 | Hạn chế quyền đọc cấp tài liệu | Tài liệu bị hạn chế vắng mặt cả ở kết quả tìm kiếm lẫn candidate set |

**Đây là một trong hai component mang tải trọng bảo mật của cả hệ thống.** Một lỗi ở đây làm rò tài liệu qua citation (threat T-02). Yêu cầu review 2 người cho mọi PR chạm vào retrieval SQL.

**Code phát sinh:** `modules/retrieval/*`, `VectorStorePort` (pgvector + HNSW), embedding/rerank client tới Infinity.

### Mốc 2C — Verified answering (FR-10, FR-14 – FR-22)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-10 | Nhận câu hỏi theo workspace được phép | Hỏi vào workspace không thuộc về mình → 403 `AUTHZ_WORKSPACE_FORBIDDEN` |
| FR-14 | Draft answer, mỗi câu gắn ID span nguồn | Mọi câu draft phải có ≥1 span reference hoặc bị đánh dấu là câu nối |
| FR-15 | Verifier trả verdict có cấu trúc + trích dẫn text hỗ trợ | 100% claim trả về JSON hợp lệ schema; claim bịa trong fixture phải ra `not_found` |
| FR-16 | Loại bỏ / viết lại claim không đạt | Câu không được hỗ trợ, tiêm vào test, không xuất hiện trong câu trả lời giao ra |
| FR-17 | Từ chối tường minh | 30 câu hỏi không trả lời được trong golden set đều phải ra refusal |
| FR-18 | Citation → document + version + trang + char span | Mỗi câu có ≥1 citation row, mỗi row resolve về span thật |
| FR-19 | Streaming SSE, chỉ stream sau khi verify | First token ≤3s p95 |
| FR-20 | Hỏi tiếp trong hội thoại | "Cái thứ hai thì sao?" resolve đúng chủ thể của câu trả lời trước |
| FR-21 | Đánh giá + bình luận | Feedback join được với retrieval trace sinh ra nó |
| FR-22 | Ghi trace đầy đủ | Trace dựng lại được từ DB cho bất kỳ câu trả lời nào còn trong hạn lưu trữ |

**Code phát sinh:** `modules/answering/*` (draft, claim segmentation, verifier, citation assembly, refusal composer, SSE stream), `ModelProviderPort` triển khai vLLM, màn hình Ask / Answer / Refusal / Source viewer ở web.

**Quyết định thiết kế cần giữ:** orchestration tự viết, **không dùng LangChain / LlamaIndex** (ADR-03). Lý do: mọi bước phải được lưu và hiển thị cho người dùng — orchestration chính là tính năng, không phải hạ tầng có thể giấu đi.

### Mốc 2D — Đo lường & quản trị (FR-47, FR-48, FR-52, FR-56, FR-57, FR-60)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-47 | OIDC SSO đầy đủ | Login vào test provider ra session, user record có subject id |
| FR-48 | Map directory group → role Ei-AI | Đổi mapping → đổi role hiệu lực ở lần login kế tiếp |
| FR-52 | Khoá quyền tức thì khi disable account | Session bị vô hiệu trong ≤60s |
| FR-56 | Tìm kiếm audit + export CSV/JSONL | Export 100.000 event dưới 60s, byte-identical với tập đã query |
| FR-57 | Hash chain audit | Sửa bất kỳ event nào → job verify báo đứt chain đúng chỗ |
| FR-60 | Evaluation harness | Chạy 150 câu golden set, ra báo cáo lưu lại và so sánh được |

**Eval harness nằm ở Phần 2, không phải Phần 4.** Đo chất lượng ở cuối dự án là đo vào hư không, vì không có baseline nào để so. Harness phải vào nightly pipeline từ tuần 10.

**Golden set bắt đầu xây từ tuần 4**, cùng khách hàng pilot, mỗi tuần một ít — không phải một cú xin lớn ở hai tuần cuối. Bộ này nằm trong version control và là tài sản dài hạn duy nhất khiến việc đổi model sau này đo được thay vì cãi nhau bằng cảm tính.

## 2.4 Tiêu chí nghiệm thu Phần 2

- [ ] Upload một manual 400 trang → `indexed` trong ≤10 phút, số chunk và số trang khớp
- [ ] Test khẳng định câu SQL retrieval **có chứa** permission predicate
- [ ] User A không thấy bất kỳ chunk nào của tài liệu chỉ cấp cho user B — kiểm tra ở cả kết quả, log, và prompt gửi model
- [ ] Hỏi 150 câu golden set → báo cáo có citation precision, citation recall, refusal accuracy, latency, cost/answer
- [ ] 30 câu không trả lời được → **cả 30 đều ra refusal**, không câu nào bịa
- [ ] Mọi câu trong mọi câu trả lời đều có ≥1 citation resolve được về trang thật
- [ ] Bấm citation → mở đúng trang, đúng đoạn được highlight
- [ ] First token ≤3s p95 với 10 người hỏi đồng thời
- [ ] Sửa một dòng trong `audit_events` → job verify chain báo đứt tại đúng event đó
- [ ] **Đội nội bộ dùng thật hằng ngày trong 2 tuần cuối Phần 2**

## 2.5 Rủi ro Phần 2

| Rủi ro | Xác suất | Xử lý |
| --- | --- | --- |
| Verifier làm latency vượt 3s | Trung bình | Chạy verifier song song theo claim; cân nhắc model nhỏ hơn cho verifier; đo từ tuần 9 chứ không đợi cuối |
| Chất lượng trả lời tiếng Việt thấp hơn kỳ vọng | Trung bình | Golden set từ tuần 4 làm điều này lộ ra sớm; phương án là đổi model qua `ModelProviderPort` (2 ngày + chạy lại eval) |
| Golden set không được khách hàng dành thời gian | **Cao** | Cần cam kết lịch cụ thể từ khách: 2 giờ/tuần từ tuần 4 |
| Tỉ lệ refusal quá cao khiến người dùng bỏ | Trung bình | Đo refusal accuracy tách riêng khỏi refusal rate; refusal đúng là tính năng, refusal thừa là lỗi retrieval |

---

# PHẦN 3 — MCP TÍCH HỢP

**Tuần 14–19 · 26 person-weeks · Mục tiêu: mở đường ra ngoài tập tài liệu, có kiểm soát**

## 3.1 Mục tiêu

Kết thúc Phần 3, trợ lý trả lời được câu hỏi cần dữ liệu sống từ ERP — nhưng **mỗi lần bước ra ngoài tập tài liệu đều dừng lại, hiện nguyên văn payload sẽ gửi đi, và chờ một con người có tên bấm duyệt.** Quyết định đó được ghi lại vĩnh viễn, không sửa được.

Đây là phần hiện thực hoá hai trong ba lời hứa của sản phẩm: **visible-and-approved** và **nothing-leaves-without-permission**.

> **Cập nhật:** ERP đã có sẵn MCP server, nên rủi ro lớn nhất của phần này — phải tự viết wrapper MCP, +3–4 tuần — **đã biến mất**. Chi tiết kỹ thuật của việc tích hợp được tách ra một tài liệu riêng: [Plan tích hợp MCP](./ei-ai-mcp-integration-plan.md). Tài liệu này chỉ giữ phần ranh giới và cổng nghiệm thu.

## 3.2 Chia thành 4 mốc nhỏ

| Mốc | Tuần | Nội dung |
| --- | --- | --- |
| **3A — Plan engine** | 14–15 | Dựng plan, lưu step, hiển thị trực tiếp từng bước |
| **3B — Cổng phê duyệt** | 15–17 | Approval request, payload nguyên văn, quyết định bất biến, hết hạn, thông báo, pre-authorisation |
| **3C — MCP client** | 16–18 | Registry, discovery, phân loại read/write, credential mã hoá, validate schema, timeout, rate limit, health check |
| **3D — Egress & provider** | 18–19 | Squid allowlist, egress record, đối soát, model provider port + provider ngoài + banner |

## 3.3 Phạm vi chức năng

### Mốc 3A — Plan (FR-23, FR-24)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-23 | Plan tuần tự cho mọi câu hỏi, lưu từng step | Mọi câu hỏi đều có plan ≥1 step, lấy ra được theo thứ tự |
| FR-24 | Hiển thị plan theo thời gian thực | UI phản ánh chuyển trạng thái trong ≤1s kể từ lúc server ghi |

Lưu ý: plan phải được dựng **cho cả câu hỏi thuần tài liệu**, không chỉ câu hỏi cần ERP. Người dùng cần thấy "Đang tìm trong 412 tài liệu…" ngay từ Phần 2 — nên khung plan nên được cắm sẵn từ mốc 2C và Phần 3 chỉ mở rộng thêm loại step.

### Mốc 3B — Cổng phê duyệt (FR-25 – FR-31)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-25 | **Dừng và tạo approval trước mọi bước ra ngoài** | Có test khẳng định **không đường code nào** bypass được cổng này |
| FR-26 | Hiện 6 trường, payload **nguyên văn, escaped, không tóm tắt** | Người duyệt phải thấy đúng thứ sẽ gửi đi, không phải bản diễn giải |
| FR-27 | Ghi bất biến approver / quyết định / lý do / thời điểm | DB policy từ chối UPDATE và DELETE; mọi lần thử đều bị log |
| FR-28 | Từ chối kèm lý do, trả về cho assistant | Plan tiếp tục không có dữ liệu đó, lý do xuất hiện trong cách xử lý sau đó |
| FR-29 | Hết hạn (mặc định 15 phút) = từ chối | Request đã hết hạn không thể duyệt lại được nữa |
| FR-30 | Thông báo Approver trong app + email | Số pending hiện trong ≤2s; email gửi trong ≤60s |
| FR-31 | Pre-authorisation cho tool cụ thể | Chạy không cần duyệt, nhưng **vẫn ghi audit mỗi lần gọi**, nêu rõ pre-auth nào |

**Đây là component mang tải trọng bảo mật thứ hai.** Một lỗi ở đây cho phép chỉ dẫn nhúng trong tài liệu (prompt injection) chạm tới mạng mà không qua phê duyệt (threat T-01). Yêu cầu: module `governance` là **đường code duy nhất** được phép thực thi một bước ra ngoài tập tài liệu, và điều đó phải được kiểm chứng bằng test kiến trúc, không chỉ bằng quy ước.

### Mốc 3C — MCP (FR-32 – FR-38)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-32 | Đăng ký MCP server, credential mã hoá at-rest | Credential không đọc được từ DB nếu không có app key; không bao giờ xuất hiện trong response hay log |
| FR-33 | Discovery tool catalogue, giữ nguyên input schema | Đăng ký ERP MCP server tham chiếu → ra đủ danh sách tool |
| FR-34 | Phân loại read/write, **mặc định `write` khi mơ hồ** | Fail-safe: tool không khai báo rõ thì bị coi là write, tức là bị tắt trong v1 |
| FR-35 | v1 chỉ gọi tool read đã bật | Gọi tool write → `MCP_WRITE_DISABLED` + ghi audit |
| FR-36 | Validate payload theo schema **trước khi** tạo approval | Payload sai schema bị chặn với `MCP_PAYLOAD_INVALID`, không làm phiền người duyệt |
| FR-37 | Health check định kỳ 5 phút | Server không tới được hiện `unreachable` + thời điểm thành công cuối |
| FR-38 | Timeout 20s + rate limit 30 calls/phút | Server chậm → step `timed_out`, câu trả lời nói rõ số liệu sống không lấy được, **không treo** |

### Mốc 3D — Egress & model provider (FR-39 – FR-45)

| FR | Chức năng | Điểm cần chú ý |
| --- | --- | --- |
| FR-39 | Default-deny, allowlist, **cưỡng chế ở tầng network** | Container ứng dụng không có default route; allowlist rỗng → request ra ngoài fail tại proxy |
| FR-40 | Ghi mọi request qua proxy | Log proxy đối soát 1:1 với bản ghi approval trong kỳ báo cáo |
| FR-41 | Cấu hình provider ngoài, mặc định tắt | Không kích hoạt được nếu thiếu key, model, hoặc lời xác nhận |
| FR-42 | Bắt buộc admin gõ xác nhận tường minh | Nội dung xác nhận + danh tính admin + thời điểm được lưu và vào audit |
| FR-43 | Banner cố định không tắt được khi provider ngoài bật | Hiện trên mọi màn hình mọi user; biến mất trong ≤60s sau khi tắt |
| FR-44 | Chọn provider theo từng workspace | Workspace ghim `local` không bao giờ gửi ra ngoài, kể cả khi provider ngoài đang bật toàn hệ thống |
| FR-45 | Web search — ship ở trạng thái **disabled** | Có trong catalogue, đánh dấu `disabled`; bật cần thêm allowlist entry |

## 3.4 Tiêu chí nghiệm thu Phần 3

- [ ] Hỏi một câu cần số liệu ERP → plan hiện bước "Truy vấn ERP", dừng lại, tạo approval
- [ ] Màn hình duyệt hiện đủ 6 trường, payload nguyên văn trong khối monospace
- [ ] Duyệt → bước chạy, dữ liệu vào câu trả lời, có citation ghi rõ nguồn là ERP tại thời điểm nào
- [ ] Từ chối kèm lý do → plan tiếp tục không có dữ liệu đó, câu trả lời nói rõ thiếu gì
- [ ] Để 15 phút không quyết định → hết hạn, không duyệt lại được, plan ghi `denied_expired`
- [ ] **Thử bypass cổng phê duyệt bằng mọi đường code — test kiến trúc chứng minh không có đường nào**
- [ ] Allowlist rỗng → mọi request ra ngoài từ container API đều fail tại proxy, có log denial
- [ ] Đối soát: mọi dòng trong log egress proxy khớp 1:1 với một approval record
- [ ] Bật provider ngoài → banner hiện trên mọi màn hình mọi user; workspace ghim `local` vẫn dùng model nội bộ
- [ ] Tool write bị từ chối gọi, có ghi audit
- [ ] MCP server chậm 60s → step `timed_out`, người dùng vẫn nhận được câu trả lời degrade

## 3.5 Rủi ro Phần 3

| Rủi ro | Xác suất | Xử lý |
| --- | --- | --- |
| ~~ERP không có sẵn MCP server, phải tự viết~~ (Q-02) | **Đã đóng** | ERP đã có MCP server. Rủi ro +3–4 tuần không còn |
| Tool catalogue của ERP không khai báo rõ read/write | Trung bình | FR-34 vốn đã fail-safe: thiếu metadata thì mặc định `write`, tức là bị tắt ở v1. Cần rà catalogue thật sớm để biết bao nhiêu tool dùng được |
| Prompt injection từ tài liệu vượt qua cổng phê duyệt (T-01) | Thấp nhưng hậu quả nặng | Test kiến trúc + red-team riêng cho luồng này; governance là đường code duy nhất |
| Người duyệt bị làm phiền quá nhiều rồi duyệt bừa | Trung bình | Pre-authorisation FR-31 cho tool an toàn dùng thường xuyên; đo tỉ lệ duyệt/từ chối để phát hiện duyệt máy móc |
| Squid làm phức tạp việc vận hành ở nhà khách | Trung bình | Đây là cái giá của việc chọn có internet thay vì air-gapped (ADR-06, ~1 tuần công). Cần tài liệu vận hành riêng |

---

# PHẦN 4 — IMPROVE & HOÀN THIỆN

**Tuần 20–23 · 18 person-weeks · Mục tiêu: hệ thống chịu được việc bàn giao**

## 4.1 Mục tiêu

Phần này **không thêm tính năng người dùng nào mới.** Nó trả lời một câu hỏi duy nhất: khi đội build rút đi, một IT generalist ở công ty khách có giữ được hệ thống này chạy không?

## 4.2 Chia thành 4 mốc nhỏ

| Mốc | Tuần | Nội dung |
| --- | --- | --- |
| **4A — Vận hành** | 20 | Health dashboard 11 chỉ số, cảnh báo, và quy trình xử lý từng cảnh báo |
| **4B — Sao lưu & phục hồi** | 20–21 | Backup tự động, tự kiểm chứng bằng test-restore, restore point-in-time, licence |
| **4C — Kiểm thử & bảo mật** | 21–22 | Load, soak, accessibility, security review đủ 15 threat |
| **4D — Bàn giao** | 22–23 | Tài liệu cài đặt & vận hành, offline bundle, UAT với khách pilot |

## 4.3 Phạm vi chức năng

| FR | Chức năng | Tiêu chí |
| --- | --- | --- |
| FR-58 | Health dashboard 11 chỉ số | Cả 11 chỉ số hiện dữ liệu không cũ quá 60s |
| FR-59 | Cảnh báo: queue >30 phút, disk <15%, model service chết, backup fail, restore verify fail | Mỗi điều kiện ra một cảnh báo nhìn thấy được + email khi có cấu hình |
| FR-61 | Backup DB + object storage theo lịch, tự test-restore hằng tuần | Backup hỏng phải **fail verification một cách nhìn thấy được**, không im lặng |
| FR-62 | Restore point-in-time có quy trình đã diễn tập | **Diễn tập restore có bấm giờ**, đạt RTO trong NFR |
| FR-63 | Licence ký offline | Hết hạn → chặn trả lời nhưng **không chặn** login, export, backup |

**11 chỉ số của health dashboard:** GPU utilisation, GPU memory, trạng thái model service, độ sâu ingestion queue, tuổi job cũ nhất trong queue, kích thước database, dung lượng đĩa trống, trạng thái MCP server, thời điểm backup cuối, thời điểm kiểm chứng restore cuối, và trạng thái licence.

## 4.4 Hoàn thiện chất lượng (không phải FR, nhưng là phần lớn giá trị)

| Hạng mục | Nội dung |
| --- | --- |
| **Vòng lặp chất lượng trả lời** | Dùng eval harness đã có từ Phần 2: tinh chỉnh chunk size, ngưỡng relevance floor, prompt verifier, số span giữ lại — mỗi thay đổi đo bằng golden set, không đoán |
| **Load & soak test** | 60 user đồng thời theo NFR-04; soak 72 giờ để bắt memory leak và rò rỉ connection |
| **Accessibility** | Kiểm tra theo NFR-13: bàn phím, screen reader, độ tương phản — đặc biệt ở citation chip và plan panel |
| **Security review** | Rà đủ 15 threat trong mục 10.1, mọi phát hiện phải đóng trước khi bàn giao |
| **i18n** | Tách chuỗi ra khỏi code (bản tiếng Việt của giao diện là deliverable riêng, không nằm trong v1) |
| **Offline bundle** | `docker save` toàn bộ image + weights model thành tarball, cho khách không có internet ở server |
| **Tài liệu** | Hướng dẫn cài đặt và vận hành, **được kiểm chứng bằng một lần cài có bấm giờ do người ngoài đội build thực hiện** |
| **UAT** | Khách hàng pilot dùng thật, có kịch bản và tiêu chí chấp nhận viết trước |

## 4.5 Tiêu chí nghiệm thu Phần 4

- [ ] Cả 11 chỉ số health hiện dữ liệu tươi ≤60s
- [ ] Gây ra từng điều kiện cảnh báo một → mỗi cái ra đúng cảnh báo và email
- [ ] **Diễn tập restore có bấm giờ, từ backup thật, đạt RTO** — có biên bản
- [ ] Làm hỏng cố ý một file backup → verification báo fail rõ ràng
- [ ] Licence hết hạn → chặn trả lời, vẫn login và export được
- [ ] Load test 60 user đồng thời đạt NFR-01 (first token ≤3s p95) và NFR-02
- [ ] Soak 72 giờ không rò bộ nhớ, không rò connection
- [ ] Security review đóng đủ 15 threat, có biên bản
- [ ] **Một người ngoài đội build cài đặt hệ thống từ đầu chỉ bằng tài liệu, có bấm giờ**
- [ ] UAT với khách pilot đạt tiêu chí đã thống nhất
- [ ] Eval run cuối cùng ≥ baseline của Phần 2 trên cả 5 chỉ số

## 4.6 Rủi ro Phần 4

| Rủi ro | Xác suất | Xử lý |
| --- | --- | --- |
| Security review lòi ra lỗi nặng ở tuần 22 | Trung bình | Không đợi Phần 4 — review threat T-01 và T-02 ngay khi Phần 2 và Phần 3 xong từng phần |
| Tài liệu vận hành viết vội, khách không dùng được | **Cao** | Bài test "người ngoài cài có bấm giờ" là cách duy nhất phát hiện điều này trước khi bàn giao |
| Chất lượng trả lời chưa đạt kỳ vọng ở UAT | Trung bình | Nếu eval từ Phần 2 đã tốt thì rủi ro này thấp. Nếu đến Phần 4 mới biết thì đã quá muộn — đây chính là lý do harness nằm ở Phần 2 |

---

# Sau v1 (ngoài phạm vi 4 phần)

| Giai đoạn | Nội dung | Effort | Điều kiện |
| --- | --- | --- | --- |
| **Phase 4** | Bật write action từng tool một, kèm quy trình review riêng, thiết kế undo/rollback. Bật web search (FR-45) sau khi đường egress đã được chứng minh trong production. AD bind trực tiếp nếu cần. Keycloak SAML nếu khách yêu cầu | 8–12 pw | v1 chạy production ít nhất một quý |
| **Phase 5** | Index source code (chunk theo cú pháp). Nạp tự động từ email và file server (phải mirror chính xác quyền hiện có). Tự động phân loại và gắn thẻ tài liệu | 12–16 pw | Nhu cầu thực từ khách |

---

# Đội ngũ & phụ thuộc

## Vai trò cần có

| Vai trò | Tham gia | Nặng nhất ở |
| --- | --- | --- |
| Tech lead / backend NestJS | Toàn dự án | Phần 2 (retrieval + answering), Phần 3 (governance) |
| Backend NestJS thứ hai | Từ tuần 4 | Phần 2, Phần 3 |
| Frontend React | Từ tuần 1 | Phần 1 (dựng đủ 19 màn), Phần 2 (streaming + citation viewer) |
| Python / ML engineer | Tuần 1–3, 4–9 | Spike OCR, parser worker, tinh chỉnh retrieval |
| DevOps / hạ tầng (part-time) | Tuần 1–3, 18–23 | Compose stack, CI, Squid, backup, bundle |

## Phụ thuộc bên ngoài — cần bạn chốt

| # | Câu hỏi | Trạng thái | Cần trước | Ảnh hưởng nếu chậm |
| --- | --- | --- | --- | --- |
| Q-02 | ERP là gì, đã có MCP server chưa? | **Đã trả lời** — đã có sẵn | — | Rủi ro +3–4 tuần đã đóng. Chuyển thành plan riêng |
| Q-03 | 200 tài liệu thật để test OCR | **Đã trả lời** — chưa có, dùng proxy | — | R-01 **vẫn mở**. Xem mốc tuần 8 bên dưới |
| — | Phần cứng dev | **Đã trả lời** — laptop RTX 3050 Ti 4 GB | — | Cần profile `dev-hybrid`; generation chạy qua API |
| **Mới** | **Tài liệu thật của khách để đóng R-01** | Chờ | **Tuần 8** | Phần 2 kết thúc mà không ai biết OCR có đạt hay không |
| **Mới** | **Chốt phần cứng thật cho bản pilot** (GPU 48 GB hay 24 GB) | Chờ | **Tuần 14** | Phần 3–4 không chạy được trên profile `prod`; không benchmark được NFR-01 |
| **Mới** | Tool catalogue thật của ERP MCP server — tên tool, schema, phân loại read/write | Chờ | **Tuần 12** | Không biết bao nhiêu tool dùng được ở v1; có thể toàn bộ bị phân loại `write` và tắt hết |
| Q-01 | Công ty dùng Entra ID / AD nào, có OIDC sẵn không? | Chờ | Tuần 3 | Đẩy FR-47, FR-48 sang sau; có thể phải làm AD bind trực tiếp (+1 tuần) |
| Q-04 | Tỉ lệ tiếng Việt / tiếng Anh trong kho tài liệu | Chờ | Tuần 3 | Ảnh hưởng lựa chọn model embedding và cấu hình OCR |
| — | Cam kết 2 giờ/tuần từ khách pilot để xây golden set, từ tuần 4 | Chờ | Tuần 3 | Không có golden set thì không đo được chất lượng, cả dự án bay bằng cảm tính |

---

# Câu hỏi cho bạn khi review

**Đã đóng ở vòng review 1:**

- ~~Phần 1 có nên bao gồm pipeline ingest cơ bản không?~~ → **Có.** Vì corpus khởi đầu là `.md`, đường ống không cần parser hay OCR, chỉ tốn ~1 tuần, và cho một demo tìm kiếm thật ở tuần 3.
- ~~ERP có MCP server chưa?~~ → **Có sẵn.** Tách thành [plan riêng](./ei-ai-mcp-integration-plan.md).
- ~~Phần cứng?~~ → **Laptop demo 4 GB VRAM.** Sinh ra profile `dev-hybrid` / `dev-local` / `prod`.

**Đã đóng ở vòng review 2:**

- ~~Dùng Anthropic API làm provider generation trong Phần 1–2 có ổn không?~~ → **Đã chốt: chạy trên máy demo với profile `dev-hybrid`.** Ghi thành [ADR-07](./ei-ai-dev-environment.md#1-adr-07--phát-triển-trên-máy-demo-với-profile-dev-hybrid), kèm ba biện pháp khoá rủi ro và mốc chuyển sang `prod` trước tuần 14.

**Còn mở:**

1. **Corpus proxy nên gồm những gì?** Tôi đề xuất 30–50 văn bản luật bản scan (có dấu, con dấu, nhiều cột), 10–20 bảng báo cáo có bảng biểu, và bộ `.md` mẫu. Bạn có nguồn tài liệu nào gần với tài liệu thật của khách hơn không?

2. **Mốc tuần 8 cho tài liệu thật có khả thi không?** Nếu không, cần nói rõ ngay từ bây giờ rằng **v1 sẽ bàn giao với R-01 chưa đóng**, và đó là một rủi ro được chấp nhận có ý thức chứ không phải một thiếu sót.

3. **Ranh giới 4 phần có đúng ý bạn không?** Cụ thể: bạn có muốn cổng phê duyệt (FR-25 – FR-31) kéo lên Phần 2 không? Lý do tôi để ở Phần 3 là nó chỉ có ý nghĩa khi đã có thứ để phê duyệt.

4. **Có muốn tách một mốc "demo được cho khách" riêng ở giữa Phần 2 không?** Ví dụ tuần 9, sau mốc 2B, để khách thấy retrieval hoạt động trước khi answering xong.

5. **Có muốn bắt đầu discovery MCP sớm từ tuần 10 không?** Chạy song song được với Phần 2, nhưng cần một người bên ERP dành thời gian điền bảng discovery.
