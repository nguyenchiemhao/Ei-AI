# Lưu trữ — phiên bản v1 (không agentic)

Thư mục này giữ bản thiết kế và kế hoạch đầu tiên của Ei-AI, được thay thế ngày **2026-09-09** khi định hướng sản phẩm chuyển sang **AI agentic**.

## Vì sao bị thay thế

Bản v1 thiết kế một **pipeline tất định**: `retrieve → draft → verify → assemble | refuse`. ADR-03 của nó chọn orchestration viết tay với plan cố định, và cố tình loại bỏ vòng lặp agent.

Định hướng mới là **vòng lặp tự chủ** (agent tự quyết định từng bước sau khi thấy kết quả bước trước), với bốn nhóm tool gồm cả **ghi vào ERP**. Đó là một sản phẩm khác, không phải một biến thể — nên viết lại từ đầu thay vì vá.

## Cái gì vẫn còn giá trị

Phần lớn nội dung phân tích trong `ei-ai-self-hosted-knowledge-assistant.md` **không phụ thuộc vào orchestration** và là đầu vào trực tiếp cho bản thiết kế mới:

| Mục | Trạng thái |
| --- | --- |
| Vấn đề, tầm nhìn, stakeholder | Giữ nguyên |
| Domain model, vòng đời entity | Giữ nguyên |
| Ingestion, chunking, embedding (FR-02 – FR-09) | Giữ nguyên |
| Retrieval + permission predicate (FR-11 – FR-13) | Giữ nguyên |
| Identity, phân quyền (FR-46 – FR-54) | Giữ nguyên |
| Audit, hash chain (FR-55 – FR-57) | Giữ nguyên |
| Vận hành, backup, licence (FR-58 – FR-63) | Giữ nguyên |
| Threat model 15 mối đe doạ | Giữ nguyên — **T-01 còn quan trọng hơn** dưới mô hình agentic |
| Tech stack | Giữ nguyên phần lớn |
| **Orchestration (ADR-03), plan cố định** | **Bị thay thế** |
| **Ranh giới 4 phase, phạm vi v1** | **Bị thay thế** — tool layer chuyển lên nền móng, write path vào v1 |
| **NFR-01 (first token ≤3s)** | **Phải đàm phán lại** — không sống sót qua lượt agentic nhiều bước |

## Bốn luật an toàn phát sinh từ hướng mới

Ghi lại ở đây vì chúng ra đời từ việc đối chiếu hướng agentic với threat model của bản v1:

1. **Write không bao giờ được pre-authorise.** Read thì có thể.
2. **Write phá vỡ vòng lặp** — agent lặp tự do trên tool read; chạm write là dừng, thoát loop, chờ người duyệt.
3. **Dry-run bắt buộc** — mọi write hiện diff "trước → sau" của đúng bản ghi sẽ đổi.
4. **Giới hạn bán kính** — cap số bản ghi mỗi lượt được sửa; vượt là từ chối, không phải cảnh báo.

## Ghi chú lịch sử

Các quyết định môi trường dev (ADR-07, ADR-08) trong `ei-ai-dev-environment.md` **vẫn còn hiệu lực** và cần chuyển sang bộ tài liệu mới: profile `dev-hybrid`, chạy toàn bộ trong Docker, mã nguồn trong Ubuntu WSL2, kiểm kê máy demo.
