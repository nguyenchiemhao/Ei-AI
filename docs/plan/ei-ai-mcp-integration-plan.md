# Ei-AI — Plan tích hợp MCP

> Tài liệu con của [Kế hoạch triển khai 4 phần](./ei-ai-implementation-plan.md). Bao phủ **Phần 3** — FR-23 đến FR-45. Tách riêng vì ERP đã có sẵn MCP server, nên track này có đầu vào rõ ràng và có thể chạy song song một phần với Phần 2.

**Tuần 14–19 · 26 person-weeks · Trạng thái: bản nháp chờ review**

---

## 1. Vì sao track này tách riêng được

Ba lý do:

1. **Đầu vào đã xác định.** ERP đã có MCP server, nên không còn ẩn số lớn nhất — việc phải tự viết wrapper (+3–4 tuần). Track này bắt đầu bằng discovery, không bằng phát triển.
2. **Ranh giới kỹ thuật sạch.** Toàn bộ track chạm vào đúng ba module: `governance`, `connectors`, `egress`. Không module nào trong số đó bị Phần 2 sửa.
3. **Một phần chạy song song được.** Discovery và thử nghiệm MCP client có thể bắt đầu **từ tuần 10**, trong lúc Phần 2 còn đang chạy mốc 2D — miễn là không ai nối nó vào luồng answering trước khi cổng phê duyệt xong.

**Nhưng có một ràng buộc cứng:** không một lời gọi MCP nào được chạy trong luồng answering thật trước khi FR-25 (cổng phê duyệt) hoàn thành và được test. Trước đó, MCP client chỉ chạy trong sandbox và trong test.

---

## 2. Điều kiện đầu vào — cần từ đội ERP

Đây là deliverable đầu tiên của track, và là thứ cần bắt đầu xin **ngay từ tuần 10**, không phải tuần 14.

### 2.1 Bảng discovery cần điền

| Hạng mục | Cần biết | Đã có | Ảnh hưởng nếu thiếu |
| --- | --- | --- | --- |
| **Transport** | `stdio`, HTTP + SSE, hay Streamable HTTP? | ☐ | Quyết định cách đóng gói client và cấu hình egress |
| **Endpoint** | URL nội bộ, cổng, có TLS không | ☐ | Cần cho allowlist và health check |
| **Xác thực** | Bearer token / API key / mTLS / OAuth | ☐ | Quyết định schema lưu credential và cách mã hoá |
| **Danh sách tool** | Tên, mô tả, input schema đầy đủ | ☐ | Không biết bao nhiêu tool dùng được ở v1 |
| **Phân loại read/write** | Server có khai báo annotation `readOnlyHint` không | ☐ | **Nếu không khai báo, FR-34 bắt buộc coi tất cả là `write` → tắt hết ở v1** |
| **Rate limit phía ERP** | Bao nhiêu call/phút được phép | ☐ | Cấu hình rate limit phía Ei-AI phải thấp hơn |
| **Độ trễ điển hình** | p50 / p95 của các tool hay dùng | ☐ | Quyết định timeout; mặc định thiết kế là 20s |
| **Môi trường test** | Có instance staging riêng không | ☐ | Không có thì phải test trên production ERP — rủi ro cao |
| **Người liên hệ** | Ai bên ERP chịu trách nhiệm khi server lỗi | ☐ | Cần cho vận hành sau bàn giao |

### 2.2 Rủi ro lớn nhất của track: phân loại read/write

Thiết kế đặt FR-34 ở chế độ **fail-safe**: tool nào không khai báo rõ là read-only thì bị coi là `write`, và tool `write` bị tắt hoàn toàn ở v1.

Điều này nghĩa là: **nếu MCP server của ERP không gắn annotation `readOnlyHint`, thì v1 sẽ không gọi được tool nào cả** — track này sẽ hoàn thành về mặt kỹ thuật nhưng vô dụng về mặt sản phẩm.

Ba phương án nếu điều đó xảy ra, theo thứ tự ưu tiên:

| Phương án | Nội dung | Chi phí | Đánh đổi |
| --- | --- | --- | --- |
| **A** | Đội ERP bổ sung annotation vào server của họ | Vài giờ phía ERP | Sạch nhất. Phân loại nằm đúng chỗ — ở nơi hiểu rõ tool nhất |
| **B** | Ei-AI cho Administrator **ghi đè thủ công** phân loại từng tool, có ghi audit và yêu cầu xác nhận gõ tay | ~3 ngày | Chấp nhận được, nhưng chuyển trách nhiệm phân loại sang người không viết tool đó |
| **C** | Danh sách allowlist tool cứng trong config | ~1 ngày | Không mở rộng được, mỗi tool mới cần một lần release |

**Đề xuất: theo đuổi A, xây B như lưới an toàn.** B đằng nào cũng cần cho trường hợp một tool được khai báo read nhưng thực tế có tác dụng phụ.

---

## 3. Kiến trúc tích hợp

### 3.1 Đường đi của một lời gọi

```
Người dùng hỏi
      │
      ▼
[answering] dựng draft, phát hiện cần dữ liệu sống
      │
      ▼
[governance] tạo plan step loại `mcp_call`         ← FR-23
      │
      ├─ [connectors] validate payload theo schema  ← FR-36
      │        └─ sai schema → MCP_PAYLOAD_INVALID, dừng, không làm phiền người duyệt
      │
      ▼
[governance] kiểm tra pre-authorisation             ← FR-31
      │
      ├─ có pre-auth → chạy luôn, VẪN ghi audit
      │
      └─ không có → tạo ApprovalRequest, DỪNG      ← FR-25
               │
               ▼
         Người duyệt xem payload nguyên văn         ← FR-26
               │
               ├─ Từ chối / hết hạn → step `denied`, plan tiếp tục thiếu dữ liệu  ← FR-28, FR-29
               │
               └─ Duyệt → ghi quyết định bất biến   ← FR-27
                        │
                        ▼
                  [connectors] gọi tool qua MCP SDK  ← FR-35
                        │  timeout 20s, rate limit 30/phút  ← FR-38
                        ▼
                  [egress] request đi qua Squid      ← FR-39
                        │  allowlist kiểm tra ở tầng network
                        ▼
                  [egress] ghi egress_record         ← FR-40
                        │
                        ▼
                  Kết quả vào answering như một span có nguồn
```

### 3.2 Bất biến bắt buộc

Ba điều này phải đúng bằng cấu trúc code, không phải bằng quy ước:

1. **`governance` là module duy nhất được phép gọi `connectors.invoke()`.** Kiểm chứng bằng test kiến trúc (dependency-cruiser hoặc tương đương), chạy trong CI, fail build nếu vi phạm.
2. **`connectors.invoke()` nhận vào một `approvalId` bắt buộc, không nullable.** Không có cách nào gọi tool mà không cầm theo một quyết định phê duyệt hoặc một pre-authorisation hợp lệ.
3. **Container `api` không có default route ra ngoài.** Mọi request đi ra phải qua Squid. Đây là điều kiện ở tầng Docker network, không phải ở tầng code.

> **Threat T-01 — prompt injection.** Một tài liệu độc hại có thể chứa chỉ dẫn khiến trợ lý muốn gọi một tool với payload do kẻ tấn công soạn. Ba bất biến trên không ngăn được ý định đó, nhưng đảm bảo nó **luôn phải đi qua mắt một con người**, và người đó thấy payload nguyên văn. Đây chính là lý do FR-26 cấm tóm tắt payload.

---

## 4. Bốn mốc thi công

### Mốc 3A — Plan engine · Tuần 14–15 · ~6 pw

| Việc | FR | Ghi chú |
| --- | --- | --- |
| Bảng `plan_steps` + state machine | FR-23 | Bảng đã tạo từ Phần 1; giờ mới có logic |
| Dựng plan cho mọi câu hỏi, kể cả câu thuần tài liệu | FR-23 | Khung này nên đã cắm sẵn ở mốc 2C của Phần 2 |
| Phát sự kiện step qua SSE cùng kênh với answer stream | FR-24 | Dùng lại hạ tầng SSE của FR-19, không mở kênh thứ hai |
| Plan panel ở web: danh sách bước có trạng thái, thời gian, kết quả rút gọn | FR-24 | Mặc định thu gọn, mở ra khi người dùng bấm |

**Nghiệm thu mốc:** hỏi một câu thuần tài liệu → plan hiện "Tìm trong 412 tài liệu" → "Kiểm chứng 6 khẳng định" → "Hoàn tất", mỗi bước đổi trạng thái trong ≤1s kể từ lúc server ghi.

### Mốc 3B — Cổng phê duyệt · Tuần 15–17 · ~9 pw

| Việc | FR | Ghi chú |
| --- | --- | --- |
| `approval_requests` + `approval_decisions`, DB policy chặn UPDATE/DELETE | FR-25, FR-27 | Test phải khẳng định UPDATE bị từ chối ở tầng database, không phải tầng ứng dụng |
| Tạm dừng plan, chờ quyết định, khôi phục khi có kết quả | FR-25 | Đây là phần khó nhất về mặt kỹ thuật: một request HTTP đang stream phải chờ một sự kiện ngoài |
| Màn Approval inbox: pending, tuổi request, đếm ngược hết hạn | FR-30 | |
| Màn Approval detail: 6 trường, payload trong khối monospace **escaped, không tóm tắt** | FR-26 | Render payload như văn bản thuần, không parse thành cây JSON có thể gập — người duyệt phải thấy đúng bytes sẽ gửi |
| Từ chối kèm lý do, trả lý do về answering | FR-28 | |
| Job hết hạn 15 phút, coi như từ chối | FR-29 | Chạy bằng BullMQ repeatable job |
| Thông báo in-app + email | FR-30 | Email tuỳ chọn, chỉ khi SMTP được cấu hình |
| Pre-authorisation: tạo, thu hồi, kiểm tra, ghi audit mỗi lần dùng | FR-31 | |

**Nghiệm thu mốc:** tạo một approval giả lập (chưa cần MCP thật), duyệt → tiếp tục; từ chối → plan đi tiếp thiếu dữ liệu; để 15 phút → hết hạn và không duyệt lại được.

### Mốc 3C — MCP client · Tuần 16–18 · ~7 pw

| Việc | FR | Ghi chú |
| --- | --- | --- |
| Tích hợp `@modelcontextprotocol/sdk`, hỗ trợ transport mà ERP dùng | — | Xác định ở bảng discovery mục 2.1 |
| Registry MCP server: đăng ký, sửa, xoá; credential mã hoá at-rest | FR-32 | Credential không bao giờ xuất hiện trong response API hay log — có test riêng cho điều này |
| Tool discovery, lưu nguyên văn input schema | FR-33 | |
| Phân loại read/write, **mặc định `write`** | FR-34 | Cộng cơ chế ghi đè thủ công (phương án B mục 2.2) nếu ERP không khai báo |
| Chặn gọi tool `write` với `MCP_WRITE_DISABLED` | FR-35 | Chặn ở cả tầng service lẫn ràng buộc database |
| Validate payload theo schema trước khi tạo approval | FR-36 | Dùng đúng schema server trả về, không viết lại |
| Health check định kỳ 5 phút, hiện trạng thái ở admin | FR-37 | |
| Timeout 20s, rate limit 30 call/phút, degrade thay vì treo | FR-38 | Server chậm → step `timed_out` → câu trả lời nói rõ số liệu sống không lấy được |
| Màn Connectors admin | FR-32, 33, 35, 37 | Tool `write` hiện ra nhưng bị khoá, có tooltip giải thích vì sao |

**Nghiệm thu mốc:** đăng ký MCP server thật của ERP → discovery ra đủ danh sách tool → phân loại đúng → gọi được một tool read trong sandbox (chưa nối vào luồng answering).

### Mốc 3D — Egress & model provider · Tuần 18–19 · ~4 pw

| Việc | FR | Ghi chú |
| --- | --- | --- |
| Squid container, container `api` bỏ default route | FR-39 | Đây là thay đổi ở `docker-compose.yml`, cần test trên máy sạch |
| Sinh cấu hình Squid từ bảng allowlist trong database | FR-39 | Đổi allowlist → reload Squid, không restart |
| Ghi `egress_records`, đối soát với approval | FR-40 | Job đối soát chạy hằng ngày, báo lệch |
| Màn Egress admin: allowlist, log, đối soát | FR-39, FR-40 | |
| `ModelProviderPort`: cấu hình provider ngoài, mặc định tắt | FR-41 | **Port này đã tồn tại từ Phần 1** vì dev dùng Anthropic API — mốc này chỉ thêm phần quản trị và banner |
| Xác nhận gõ tay bắt buộc trước khi kích hoạt | FR-42 | Lưu nguyên văn lời xác nhận + danh tính + thời điểm |
| Banner cố định không tắt được | FR-43 | Trên mọi màn hình, mọi user; biến mất ≤60s sau khi tắt |
| Chọn provider theo từng workspace | FR-44 | Workspace ghim `local` không bao giờ ra ngoài |
| Web search tool, ship ở trạng thái `disabled` | FR-45 | Có trong catalogue, không bật được nếu chưa có allowlist entry |

> **Lưu ý về thứ tự.** Vì môi trường dev đã dùng Anthropic API từ Phần 1, đường đi ra ngoài mạng **đã tồn tại trước khi Squid được dựng**. Điều này phải được xử lý tường minh: từ tuần 18, dev environment cũng phải đi qua Squid như production. Nếu không, ta sẽ bàn giao một hệ thống mà đường egress chưa bao giờ được kiểm chứng trong điều kiện thật.

---

## 5. Kế hoạch kiểm thử

| Loại | Nội dung | Khi nào |
| --- | --- | --- |
| **Test kiến trúc** | `governance` là đường duy nhất gọi `connectors.invoke()`; `invoke()` bắt buộc có `approvalId` | Chạy mỗi lần CI, từ tuần 15 |
| **Test bất biến database** | UPDATE và DELETE trên `approval_decisions` và `audit_events` đều bị từ chối ở tầng DB | Tuần 16 |
| **Test bypass** | Thử gọi tool qua mọi entry point: API trực tiếp, worker, eval harness, admin endpoint | Tuần 17 |
| **Test prompt injection** | Nạp tài liệu chứa chỉ dẫn độc hại, xác nhận nó vẫn phải qua approval và payload hiện nguyên văn | Tuần 17–18 |
| **Test degrade** | ERP chậm 60s, ERP trả lỗi, ERP trả payload khổng lồ, ERP trả JSON sai schema | Tuần 18 |
| **Test egress** | Allowlist rỗng → mọi request fail tại proxy, có log. Thêm entry → đi được. Xoá entry đang dùng → bị chặn với 409 | Tuần 19 |
| **Test đối soát** | Chạy 100 lời gọi, xác nhận log Squid khớp 1:1 với `egress_records` và với approval | Tuần 19 |

---

## 6. Cổng nghiệm thu track MCP

- [ ] Bảng discovery mục 2.1 điền đủ, có xác nhận từ đội ERP
- [ ] Hỏi một câu cần số liệu ERP → plan hiện bước "Truy vấn ERP", dừng lại, tạo approval
- [ ] Màn duyệt hiện đủ 6 trường, payload nguyên văn trong khối monospace, không tóm tắt
- [ ] Duyệt → bước chạy, dữ liệu vào câu trả lời, có ghi rõ nguồn là ERP tại thời điểm nào
- [ ] Từ chối kèm lý do → plan tiếp tục, câu trả lời nói rõ thiếu gì
- [ ] Để 15 phút → hết hạn, không duyệt lại được, plan ghi `denied_expired`
- [ ] **Test kiến trúc chứng minh không có đường code nào bypass cổng phê duyệt**
- [ ] **Test prompt injection: tài liệu độc hại vẫn phải qua người duyệt**
- [ ] Allowlist rỗng → mọi request ra ngoài từ container `api` fail tại proxy, có log denial
- [ ] Đối soát 1:1 giữa log Squid, `egress_records` và approval records
- [ ] Tool `write` bị từ chối gọi, có ghi audit
- [ ] ERP chậm 60s → step `timed_out`, người dùng vẫn nhận câu trả lời degrade
- [ ] Bật provider ngoài → banner trên mọi màn hình; workspace ghim `local` vẫn dùng model nội bộ
- [ ] **Dev environment đã chuyển sang đi qua Squid, không còn đường tắt**

---

## 7. Rủi ro riêng của track

| Rủi ro | Xác suất | Xử lý |
| --- | --- | --- |
| **ERP MCP server không khai báo `readOnlyHint` → toàn bộ tool bị tắt ở v1** | **Cao** | Hỏi ngay tuần 10. Theo đuổi phương án A, xây phương án B làm lưới an toàn (mục 2.2) |
| Không có instance ERP staging, phải test trên production | Trung bình | Chỉ gọi tool read nên rủi ro thấp, nhưng vẫn cần thoả thuận bằng văn bản với đội ERP trước khi test |
| Tạm dừng một HTTP stream để chờ phê duyệt phức tạp hơn dự kiến | Trung bình | Đây là phần kỹ thuật khó nhất của mốc 3B. Dựng spike ở tuần 14 chứ không đợi tuần 16 |
| Người duyệt bị làm phiền quá nhiều rồi duyệt bừa | Trung bình | Pre-authorisation FR-31 cho tool an toàn dùng thường xuyên; theo dõi tỉ lệ duyệt/từ chối để phát hiện duyệt máy móc |
| Squid làm phức tạp vận hành ở nhà khách | Trung bình | Cái giá của việc chọn có internet thay vì air-gapped (ADR-06). Cần một chương riêng trong tài liệu vận hành |
| Đường egress của dev chưa bao giờ đi qua Squid | Trung bình | Chuyển dev sang Squid ở tuần 18, nằm trong cổng nghiệm thu |

---

## 8. Cần bạn chốt

1. **Ai bên ERP là đầu mối, và bao giờ xin được bảng discovery mục 2.1?** Cần bắt đầu từ tuần 10, không phải tuần 14.
2. **MCP server của ERP có khai báo `readOnlyHint` cho các tool không?** Đây là câu hỏi quan trọng nhất của cả track — nếu không có, cần thêm ~3 ngày cho cơ chế ghi đè thủ công.
3. **Có instance ERP staging để test không?** Nếu không, cần thoả thuận bằng văn bản về việc gọi read lên production.
4. **Có muốn bắt đầu discovery sớm từ tuần 10 không?** Việc này chạy song song được với Phần 2 và không tốn nhiều công, nhưng cần một người bên ERP dành thời gian.
