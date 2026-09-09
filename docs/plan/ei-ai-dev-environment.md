# Ei-AI — Môi trường phát triển trên máy demo

> Tài liệu con của [Kế hoạch triển khai 4 phần](./ei-ai-implementation-plan.md). Ghi lại hai quyết định về môi trường dev và cách dựng nó cụ thể trên máy hiện có.

**Trạng thái:** đã chốt · 2026-09-08

---

## 1. ADR-07 — Phát triển trên máy demo với profile `dev-hybrid`

**Bối cảnh.** Thiết kế giả định một server có GPU 48 GB, chạy Qwen3-32B AWQ cục bộ. Máy thực tế là laptop với RTX 3050 Ti 4 GB VRAM. 4 GB đủ cho embedding và rerank, không đủ cho generation ở bất kỳ kích thước model có ý nghĩa nào. Đồng thời chưa có tài liệu thật của khách, nên corpus dev là văn bản luật công khai và file `.md` mẫu — không có dữ liệu cần bảo mật.

**Quyết định.** Phát triển Phần 1 và Phần 2 trên máy demo với profile `dev-hybrid`: embedding và rerank chạy cục bộ trên GPU, generation gọi Anthropic API qua `ModelProviderPort`. Profile `dev-local` (generation bằng Qwen3-4B trên CPU) tồn tại song song và được chạy ở mỗi cổng nghiệm thu để chứng minh đường local không mục.

**Hệ quả.**

| Loại | Nội dung |
| --- | --- |
| **Tốt** | Không bị phần cứng cản khi xây logic answering, verifier và citation — phần khó nhất của sản phẩm. `ModelProviderPort` được dùng thật ngay từ tuần 1, nên nó là một seam đã được kiểm chứng chứ không phải một abstraction lý thuyết |
| **Tốt** | Retrieval — nơi chất lượng câu trả lời thực sự được quyết định — chạy cục bộ đúng như production. Không có sự khác biệt nào ở đây giữa dev và prod |
| **Xấu** | Có nguy cơ tinh chỉnh prompt cho một model mạnh rồi ngã ở model yếu hơn. Bù bằng ba biện pháp ở mục 7 |
| **Xấu** | Không đo được NFR-01 (first token ≤3s p95 với model cục bộ) cho tới khi có phần cứng thật. Số liệu latency của Phần 1–2 **không dùng để kết luận gì về production** |
| **Trung tính** | Đường ra ngoài mạng tồn tại từ tuần 1, trước khi Squid được dựng ở tuần 18. Phải chuyển dev sang đi qua Squid ở mốc 3D, nằm trong cổng nghiệm thu Phần 3 |

**Điều kiện huỷ quyết định.** Khi có phần cứng thật (mốc: trước tuần 14), profile `prod` thành mặc định cho mọi việc đo lường. `dev-hybrid` vẫn giữ cho vòng lặp phát triển hằng ngày vì nó nhanh hơn.

---

## 2. ADR-08 — Chạy toàn bộ hệ thống trong Docker

**Bối cảnh.** Máy demo có Node v14.21.3 (EOL từ 4/2023), không có pnpm, Python 3.11 thay vì 3.12. Cài toolchain lên host nghĩa là mỗi máy dev phải tự đúng phiên bản, và sự lệch pha giữa các máy là một nguồn lỗi kinh điển. Đồng thời sản phẩm được bàn giao cho khách dưới dạng một stack Docker Compose, nên chạy dev trên cùng stack đó có giá trị riêng.

**Quyết định.** **Có — chạy toàn bộ hệ thống trong Docker, dưới dạng Dev Container.** Host chỉ cần Docker Desktop, VS Code và Git. Không cài Node, pnpm hay Python lên Windows.

Nhưng quyết định này đi kèm **một điều kiện bắt buộc: mã nguồn phải nằm trên filesystem Linux, không phải trên ổ D: của Windows.** Không có điều kiện đó thì quyết định này biến vòng lặp phát triển thành một cực hình, và lợi ích về phiên bản không bù nổi.

### 2.1 Vì sao điều kiện đó là bắt buộc

Docker Desktop trên Windows chạy container trong một máy ảo WSL2. Khi bind-mount một thư mục Windows (`D:\Data\Ei-AI`) vào container, mọi lần đọc ghi file phải đi qua lớp cầu 9p/drvfs giữa Windows và Linux. Lớp cầu đó chậm hơn filesystem native nhiều lần — và ba việc nặng file nhất của dự án này lại đúng là ba việc làm suốt ngày:

| Việc | Số file liên quan | Hệ quả khi qua lớp cầu |
| --- | --- | --- |
| `pnpm install` | hàng chục nghìn file nhỏ trong `node_modules` | Chậm nhiều lần |
| Vite HMR khi sửa một component | vài file, nhưng phải theo dõi cả cây | HMR từ mức chục millisecond lên mức giây |
| `tsc --watch` / `nest start --watch` | cả project | Mỗi lần lưu file là một lần chờ |

Tệ hơn: sự kiện inotify **không truyền tin cậy** qua lớp cầu này, nên watcher phải chuyển sang chế độ polling (`usePolling: true`). Polling nghĩa là quét lại cây file theo chu kỳ — ăn CPU liên tục và vẫn trễ.

Đặt mã nguồn trên filesystem Linux thì cả ba vấn đề biến mất cùng lúc: tốc độ native ext4, inotify hoạt động đúng.

### 2.2 Ba chỗ có thể đặt mã nguồn

Máy hiện tại **chỉ có distro `docker-desktop`, chưa có Ubuntu WSL2 nào** — nên phương án A cần thêm một bước cài đặt.

| | Nơi đặt mã nguồn | Tốc độ | Cần làm gì | Đánh giá |
| --- | --- | --- | --- | --- |
| **A** | Trong distro Ubuntu WSL2 | Native | `wsl --install -d Ubuntu`, rồi clone repo vào `~/ei-ai`. Mở bằng VS Code Remote-WSL | **✅ ĐÃ CHỌN.** Nhanh, git vẫn dùng bình thường, thư mục vẫn truy cập được từ Windows qua `\\wsl$\Ubuntu\home\...` |
| **B** | Trong một Docker named volume | Native | VS Code Dev Containers → "Clone Repository in Container Volume" | Không chọn. Nhanh và không cần Ubuntu, nhưng mã nguồn nằm trong vhdx — cộng áp lực lên ổ C: đang chật, và sao lưu/thao tác git ngoài container bất tiện |
| **C** | Giữ nguyên `D:\Data\Ei-AI`, bind-mount vào container | **Chậm** | Không cần làm gì | Không chọn. Chạy được, nhưng vòng lặp phát triển chậm đủ để làm mòn tinh thần đội |

> **✅ Quyết định: phương án A** — mã nguồn nằm trong distro Ubuntu WSL2 tại `~/ei-ai`. Chốt ngày 2026-09-08.
>
> **Tiến độ thực thi:** xem mục 4.4. Chưa cài Ubuntu, chưa chuyển repo.

Chi phí: một lần cài Ubuntu WSL2 khoảng 15 phút, cộng chuyển repo. Đổi lại một vòng lặp phát triển nhanh trong suốt 23 tuần.

**Ghi chú cho trường hợp phải quay lại C** (nếu vì lý do nào đó không dùng được WSL2): để `node_modules` trong một named volume thay vì bind-mount. Đường nóng nhất khi đó không đi qua lớp cầu nữa — `pnpm install` nhanh lại, chỉ còn watch là chậm. Cấu hình ở mục 5 vốn đã làm đúng như vậy, nên không cần sửa gì.

### 2.3 Hệ quả của ADR-08

| Loại | Nội dung |
| --- | --- |
| **Tốt** | **Phiên bản được đảm bảo bằng image, không bằng lời nhắc.** Node 22.13, pnpm 10, Python 3.12, Postgres 17.2, pgvector 0.8 — tất cả ghim trong Dockerfile. Máy mới vào dự án chỉ cần Docker và VS Code |
| **Tốt** | **Đội dev chạy đúng stack mà khách sẽ nhận.** Đường cài đặt được diễn tập hằng ngày thay vì chỉ ở Phần 4. Điều này trực tiếp hạ rủi ro của tiêu chí nghiệm thu "một người ngoài đội build cài được hệ thống chỉ bằng tài liệu" |
| **Tốt** | Không phải nâng Node trên host, không phải xử lý xung đột phiên bản với dự án khác trên cùng máy |
| **Xấu** | **Cần một lần thiết lập nghiêm túc** — Dev Container, path mapping cho debugger, cấu hình WSL2. Khoảng 2–3 ngày công ở tuần 1, và phải làm cho đúng |
| **Xấu** | Thêm dependency `pnpm add` thì phải rebuild image hoặc `exec` vào container. Vòng lặp dài hơn so với chạy trên host |
| **Xấu** | Ăn RAM nhiều hơn. Cần giới hạn WSL2 tường minh, xem mục 4.3 |
| **Trung tính** | IDE phải chạy *trong* container (Dev Containers) để TypeScript language server thấy `node_modules`. Nếu không, editor mất autocomplete và báo lỗi type sai — đây là cái bẫy phổ biến nhất của cách làm này |

**Điều không thay đổi.** Production và CI **đã** hoàn toàn dockerized từ đầu trong kế hoạch — điều đó chưa bao giờ là câu hỏi. Bảo đảm phiên bản cho *thứ được bàn giao* đến từ image, bất kể lập trình viên chạy cục bộ thế nào. ADR-08 chỉ quyết định **vòng lặp phát triển bên trong**. Lập luận của bạn về tính nhất quán phiên bản *giữa các máy trong đội* vẫn đúng và là lý do chính để chọn.

---

## 3. Kiểm kê máy demo

Số liệu thật, đo ngày 2026-09-08.

| Hạng mục | Thực tế | Đánh giá |
| --- | --- | --- |
| CPU | Intel i7-12700H · 14 cores / 20 threads | Đủ tốt. Chạy được Qwen3-4B trên CPU cho profile `dev-local` |
| RAM | 31,7 GB | Đủ, nhưng phải giới hạn WSL2 tường minh |
| GPU compute | NVIDIA RTX 3050 Ti Laptop · **4 GB VRAM** · driver 581.95 · compute 8.6 | Đủ cho embedding + rerank. Không đủ cho generation |
| GPU hiển thị | Intel Iris Xe | **Tin tốt:** màn hình do iGPU lo, nên gần như trọn 4 GB của 3050 Ti dành cho compute |
| Docker | 29.4.3 · Compose v5.1.3 · backend WSL2 | Sẵn sàng |
| **NVIDIA container runtime** | **Đã đăng ký** (`nvidia-container-runtime`) | **Ẩn số lớn nhất đã được giải quyết** — GPU passthrough vào container đã hoạt động |
| **WSL distro** | **Chỉ có `docker-desktop`** | **Chưa có Ubuntu.** Cần cài nếu chọn phương án A ở mục 2.2 |
| **`.wslconfig`** | **Không có** | WSL2 sẽ tự lấy tới 50% RAM ≈ 16 GB. Cần cấu hình tường minh |
| Node.js trên host | v14.21.3 | **Không còn quan trọng** nếu theo ADR-08 |
| pnpm trên host | Chưa có | **Không cần** nếu theo ADR-08 |
| Python trên host | 3.11.15 | **Không cần** — parser chạy trong container |
| Git | 2.50.1 | Được |
| **Ổ vật lý** | **Samsung PM991a NVMe 512 GB — chỉ MỘT ổ, Disk 0** | **C: và D: là hai phân vùng của cùng một đĩa.** Chuyển dữ liệu qua lại không nhanh hơn và không tạo thêm dung lượng |
| Phân vùng C: | **50,3 GB trống** / 358,2 GB *(sau dọn dẹp 09-09)* | Docker vhdx ở đây, 73,2 GB — chưa nén, nên chỗ trống bên trong chưa trả về Windows |
| Phân vùng D: | 90,4 GB trống / 117,2 GB | Phân vùng nhỏ hơn. Không cần dùng đến |
| WSL | 2.7.3 — hỗ trợ `--location` khi cài distro | Đặt được distro sang D: nếu muốn, nhưng không cần |
| Sparse VHD | **Bị WSL chặn** — cảnh báo hỏng dữ liệu | Muốn nén vhdx thì dùng `diskpart compact vdisk`, **không** dùng `--set-sparse --allow-unsafe` |

> **Lưu ý về máy dùng chung.** Máy này còn chạy hai dự án khác: `marlin-dev` và `eerp-dev` (Laravel, bind-mount từ `D:\Data\ERP-Team\EERP`), cùng bốn volume của chúng — `marlin_marlin_node_modules`, `e-erp_eerp_vendor`, `e-erp_eerp_storage_framework`, `e-erp_eerp_bootstrap_cache`.
>
> Mọi thao tác dọn dẹp Docker phải **nhắm đích cụ thể**, không dùng lệnh quét toàn bộ — đặc biệt **không bao giờ** `docker volume prune`. Bài học đã trả giá: đợt dọn ngày 09-09 bằng Docker Desktop đã xoá mất `e-erp_eerp_mysql_data` và `eerp-dev_db-data` vì chúng không gắn container đang chạy nên bị tính là "unused".

---

## 4. Chuẩn bị môi trường — việc của tuần 1

Theo ADR-08, danh sách này ngắn hơn trước: không còn việc nâng Node hay cài pnpm trên host.

**Tiến độ:** B1 xong, B0 làm dở, B2–B4 chưa bắt đầu. Chi tiết ở mục 4.4.

### 4.1 Yêu cầu dung lượng

Ei-AI cần khoảng **35–45 GB** trên ổ C:

| Thành phần | Dung lượng |
| --- | --- |
| Image Infinity nền CUDA | ~6–8 GB |
| Weights model (BGE-M3 + reranker + Qwen3-4B GGUF) | ~7 GB |
| Postgres + dữ liệu, Redis, các volume `node_modules`, build cache | ~12–20 GB |
| Distro Ubuntu WSL2 + repo | ~8–10 GB |

Máy này chỉ có **một ổ vật lý** (Samsung PM991a NVMe 512 GB); C: và D: là hai phân vùng của nó. Vì thế chuyển dữ liệu giữa hai ổ không nhanh hơn và không tạo thêm dung lượng — **cứ để mọi thứ ở vị trí mặc định trên C:**.

> **Điều kiện tiên quyết:** C: phải còn **≥45 GB trống** trước khi dựng stack. Kiểm tra bằng `Get-PSDrive C`. Việc dọn dẹp để đạt ngưỡng này là housekeeping một lần, không thuộc phạm vi kế hoạch này.

### 4.2 Cài Ubuntu WSL2 và chuyển repo — bước B3

> **Phải xong B0 trước.** `git init` đã chạy và file đã được stage, nhưng **chưa có commit nào và chưa có remote**. Chuyển một thư mục chưa được commit sang chỗ khác là lúc dễ mất dữ liệu nhất. Hãy commit và push **trước khi** đụng vào bất cứ thứ gì khác.
>
> Đây cũng là câu trả lời cho "code nằm trong vhdx của WSL thì có an toàn không": an toàn vì nó có remote, không phải vì nó nằm ở ổ nào.

**Distro Ubuntu nằm ở đâu.** Mặc định WSL cài vào `C:\Users\<user>\AppData\Local\Packages\CanonicalGroupLimited...\LocalState\ext4.vhdx`. Vì C: và D: là hai phân vùng của cùng một ổ vật lý (mục 3), chỗ này **không ảnh hưởng tốc độ**, và C: còn 50,3 GB nên đủ chỗ. Nên: **cứ để mặc định.**

Nếu vẫn muốn đặt distro sang D: — WSL trên máy này là 2.7.3 nên hỗ trợ `--location`:

```powershell
wsl --install -d Ubuntu --location D:\wsl\Ubuntu
```

Với distro đã cài rồi thì dùng export/import:

```powershell
wsl --export Ubuntu D:\wsl\ubuntu-backup.tar
wsl --unregister Ubuntu
wsl --import Ubuntu D:\wsl\Ubuntu D:\wsl\ubuntu-backup.tar
```

**Cài và chuyển repo:**

```bash
# Trên Windows (PowerShell)
wsl --install -d Ubuntu
# Khởi động lại nếu được yêu cầu, rồi đặt user/password cho Ubuntu

# Trong Ubuntu
sudo apt update && sudo apt install -y git
git config --global user.email "howie@cal-se.com"
git config --global core.autocrlf input      # tránh lộn xộn CRLF/LF khi qua lại Windows

# Nếu repo đã lên remote:
git clone <repo-url> ~/ei-ai

# Nếu chưa có remote, chuyển từ D: sang (chạy trong Ubuntu):
cp -r /mnt/d/Data/Ei-AI ~/ei-ai
cd ~/ei-ai && git init && git add -A && git commit -m "chore: initial import from D:"

cd ~/ei-ai && code .        # VS Code mở ở chế độ Remote-WSL
```

Thư mục vẫn truy cập được từ Windows Explorer qua `\\wsl$\Ubuntu\home\<user>\ei-ai` nếu cần — nhưng **đừng sửa file qua đường đó khi đang chạy container**, vì đó chính là lớp cầu chậm mà ADR-08 tránh.

**Về `docs/` hiện ở `D:\Data\Ei-AI\docs`:** chuyển cả repo vào WSL2, không tách. Tài liệu và code nên đi cùng nhau trong version control, và `docs/` là file text nên tốc độ không phải vấn đề. Sau khi chuyển, `D:\Data\Ei-AI` nên xoá hoặc đổi tên thành `Ei-AI.moved` để không ai sửa nhầm vào bản cũ.

> **Chưa làm bước này.** Ba tài liệu plan hiện vẫn nằm ở `D:\Data\Ei-AI\docs\plan\`.

### 4.3 Giới hạn RAM cho WSL2

Không có `.wslconfig` thì WSL2 tự lấy tới 50% RAM (≈16 GB) và không trả lại nhanh. Với Infinity + Postgres + Node + Vite cùng chạy, cộng Windows và IDE, laptop sẽ thrash.

Tạo `C:\Users\<user>\.wslconfig`:

```ini
[wsl2]
memory=18GB
processors=12
swap=4GB
# Cho phép vhdx co lại khi xoá dữ liệu
sparseVhd=true

[experimental]
autoMemoryReclaim=gradual
```

Rồi `wsl --shutdown` để áp dụng. Con số 18 GB để lại ~13 GB cho Windows, IDE và browser — điều chỉnh sau khi đo thực tế.

### 4.4 Nhật ký thực thi

| Bước | Trạng thái | Ngày | Ghi chú |
| --- | --- | --- | --- |
| **B0a** — `git init` + commit | ✅ **Xong** | 09-09 | Commit `fbbadca "Init commit"`, 8 file (4 trong `docs/`) |
| **B0b** — gắn remote | ✅ **Xong** | 09-09 | `origin` → `https://github.com/nguyenchiemhao/Ei-AI.git`. Repo trên GitHub còn rỗng |
| **B0c** — push | 🔴 **Chưa** | | Nhánh cục bộ là `master`; cân nhắc đổi sang `main` trước khi push |
| **B1** — C: ≥45 GB trống | ✅ **Xong** | 09-09 | Xoá 30 image và 48 volume. C: còn 50 GB |
| **B1b** — `docker builder prune -a` | ✅ **Xong** | 09-09 | Build cache về **0 B**. Docker giờ chỉ chiếm ~5,7 GB bên trong vhdx |
| **B2** — `.wslconfig` | ⬜ Chưa | | |
| **B3** — cài Ubuntu, chuyển repo | ⬜ Chưa | | |
| **B4** — Dev Containers + Remote-WSL | ⬜ Chưa | | |

**Ghi chú từ đợt dọn 09-09:**

- vhdx **chưa nén**, vẫn 73,2 GB. **Không cần nén.** Sau khi dọn xong, Docker chỉ còn chiếm **~5,7 GB** bên trong vhdx (image 4,58 + container 0,17 + volume 0,94 + cache 0) — tức **trống ~67 GB bên trong**. Toàn bộ image và volume của Ei-AI (25–35 GB) nằm gọn trong đó mà file không phình thêm. C: chỉ cần chỗ cho distro Ubuntu + repo (~8–10 GB) và đang còn 50 GB. Nếu sau này cần lấy lại chỗ cho việc khác thì dùng `diskpart compact vdisk`, **không** dùng sparse VHD (WSL chặn vì rủi ro hỏng dữ liệu).
- Mất `e-erp_eerp_mysql_data` và `eerp-dev_db-data`. Mã nguồn e-erp không ảnh hưởng (bind-mount). Dựng lại bằng migration/seeder của Laravel nếu cần.

---

## 5. Compose stack cho `dev-hybrid`

Bảy service. GPU chỉ cấp cho một service duy nhất là `infinity`.

```yaml
# infra/compose/docker-compose.yml (rút gọn — chỉ phần cốt lõi)
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: eiai
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ../postgres/init:/docker-entrypoint-initdb.d:ro   # CREATE EXTENSION vector, unaccent
    ports: ['5432:5432']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d eiai']
      interval: 10s

  redis:
    image: redis:7.4-alpine
    command: redis-server --save 60 1 --appendonly no
    ports: ['6379:6379']

  infinity:
    image: michaelf34/infinity:0.0.76          # ghim lại đúng patch khi dựng
    command: >
      v2
      --model-id BAAI/bge-m3
      --model-id BAAI/bge-reranker-v2-m3
      --batch-size 8
      --port 7997
    environment:
      HF_HOME: /models
    volumes:
      - models:/models                          # cache weights, tránh tải lại mỗi lần
    ports: ['7997:7997']
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  api:
    build: { context: ../.., dockerfile: apps/api/Dockerfile, target: dev }
    command: pnpm --filter api start:dev
    env_file: ../../.env
    volumes:
      - ../..:/workspace                        # mã nguồn
      - api_node_modules:/workspace/node_modules        # KHÔNG bind-mount node_modules
      - api_pkg_modules:/workspace/apps/api/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    ports:
      - '3000:3000'
      - '9229:9229'                             # Node inspector cho debugger

  ingest-worker:
    build: { context: ../.., dockerfile: apps/api/Dockerfile, target: dev }
    command: pnpm --filter api start:worker     # cùng image, khác entrypoint
    env_file: ../../.env
    volumes:
      - ../..:/workspace
      - api_node_modules:/workspace/node_modules
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }

  parser:
    build: { context: ../.., dockerfile: apps/parser/Dockerfile }
    env_file: ../../.env
    volumes:
      - ../../apps/parser:/app
    depends_on:
      redis: { condition: service_started }

  web:
    build: { context: ../.., dockerfile: apps/web/Dockerfile, target: dev }
    command: pnpm --filter web dev --host 0.0.0.0
    volumes:
      - ../..:/workspace
      - web_node_modules:/workspace/node_modules
      - web_pkg_modules:/workspace/apps/web/node_modules
    ports: ['5173:5173']

volumes:
  pgdata:
  models:
  api_node_modules:
  api_pkg_modules:
  web_node_modules:
  web_pkg_modules:
```

**Ba chi tiết dễ bỏ sót, và cả ba đều gây đau nếu bỏ:**

1. **`node_modules` phải là named volume, không bind-mount.** Nếu để nó theo bind-mount, container sẽ ghi hàng chục nghìn file qua lớp cầu filesystem. Đây là nguyên nhân số một của "Docker chậm quá" trên Windows.
2. **Cổng 9229 phải mở** để VS Code attach debugger vào Node trong container. Kèm cấu hình `remoteRoot: /workspace` trong `launch.json`.
3. **Nếu mã nguồn ở ổ D: (phương án C mục 2.2)**, phải bật polling cho watcher, nếu không HMR sẽ đơn giản là không chạy:
   ```bash
   CHOKIDAR_USEPOLLING=true
   WATCHPACK_POLLING=true
   ```
   Nếu mã nguồn ở WSL2 hoặc trong volume thì **không** đặt hai biến này — polling chỉ làm chậm vô ích.

**Profile GPU tách riêng** (`compose.gpu.yml`) chỉ dùng khi có phần cứng thật — nó thêm `vllm` và đổi `MODEL_PROVIDER` sang `local`. Trên laptop, profile này không khởi động được và **đó là hành vi đúng**, không phải lỗi.

### 5.1 Dev Container

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "Ei-AI",
  "dockerComposeFile": ["../infra/compose/docker-compose.yml"],
  "service": "api",
  "workspaceFolder": "/workspace",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-python.python",
        "bradlc.vscode-tailwindcss"
      ],
      "settings": {
        "typescript.tsdk": "/workspace/node_modules/typescript/lib"
      }
    }
  },
  "forwardPorts": [3000, 5173, 5432, 7997],
  "postCreateCommand": "pnpm install"
}
```

`typescript.tsdk` trỏ vào `node_modules` trong container là điều kiện để IDE có autocomplete và báo lỗi type đúng. Thiếu dòng này là cái bẫy phổ biến nhất của cách làm này.

---

## 6. Ngân sách 4 GB VRAM

| Thành phần | VRAM | Ghi chú |
| --- | --- | --- |
| BGE-M3 weights (fp16) | ~1,15 GB | 568M tham số |
| BGE-reranker-v2-m3 weights (fp16) | ~1,15 GB | 568M tham số |
| Activation + batch buffer | ~0,5–0,8 GB | Phụ thuộc batch size |
| CUDA context overhead | ~0,3 GB | |
| **Tổng** | **~3,1–3,4 GB** | Vừa trong 4 GB, nhưng **chật** |

**Ba việc phải làm để không tràn:**

1. Đặt batch size thấp: `--batch-size 8` cho Infinity. Với corpus dev nhỏ thì throughput không phải vấn đề.
2. Nếu vẫn tràn: nạp reranker ở int8 thay vì fp16 (giảm còn ~0,6 GB), hoặc đẩy reranker sang CPU — corpus dev nhỏ nên chấp nhận được.
3. **Không chạy game, Stable Diffusion hay công cụ AI nào khác dùng GPU cùng lúc.** 4 GB không chia được.

---

## 7. Biến môi trường

```bash
# .env.example — commit file này, không commit .env

# --- Database & queue (tên service, không phải localhost, vì chạy trong Docker) ---
DATABASE_URL=postgresql://postgres:changeme@postgres:5432/eiai
REDIS_URL=redis://redis:6379

# --- Retrieval (luôn cục bộ, mọi profile) ---
EMBEDDING_BASE_URL=http://infinity:7997
EMBEDDING_MODEL=BAAI/bge-m3
RERANK_MODEL=BAAI/bge-reranker-v2-m3
RETRIEVAL_CANDIDATE_LIMIT=60
RETRIEVAL_KEEP_TOP=8
RETRIEVAL_RELEVANCE_FLOOR=0.35

# --- Generation ---
# dev-hybrid | dev-local | prod
MODEL_PROFILE=dev-hybrid

# dev-hybrid: Anthropic qua ModelProviderPort
ANTHROPIC_API_KEY=              # KHÔNG commit
GENERATION_MODEL=claude-haiku-4-5-20251001
VERIFIER_MODEL=claude-haiku-4-5-20251001
CEILING_MODEL=claude-sonnet-5   # chỉ dùng khi đo trần chất lượng

# dev-local: llama.cpp, cũng là một service trong compose
LOCAL_GENERATION_BASE_URL=http://llamacpp:8080
LOCAL_GENERATION_MODEL=qwen3-4b-instruct-q4_k_m

# --- Auth ---
JWT_SECRET=                     # sinh bằng: openssl rand -base64 48
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=8h

# --- Feature flags (mục 1.4 của plan chính) ---
FEATURE_ASK_ANSWER=coming_soon
FEATURE_APPROVALS=coming_soon
FEATURE_CONNECTORS=coming_soon
```

### Vì sao chọn `claude-haiku-4-5` làm mặc định cho dev, không phải Sonnet hay Opus

Đây là điểm ngược trực giác nhưng quan trọng.

Đích production là Qwen3-32B chạy cục bộ. Nếu dev bằng model mạnh nhất, ta sẽ viết prompt dựa trên năng lực mà model production không có, và cú đổi ở Phần 4 thành một vách đá. Chọn model ở tầng năng lực gần với một model 32B cục bộ hơn khiến cú đổi đó thành một bậc thang.

`claude-sonnet-5` giữ vai trò **đo trần**: chạy golden set bằng nó mỗi khi cần biết "kém là do prompt hay do model". Nếu Sonnet cũng sai ở cùng chỗ thì lỗi nằm ở retrieval hoặc ở prompt, không phải ở kích thước model — và đó là thông tin đáng giá hơn nhiều so với một điểm số cao.

Ta không đoán khoảng cách giữa các model. **Eval harness đo nó**, từ tuần 10, trên cả ba lựa chọn.

### Ba biện pháp khoá rủi ro "dev mạnh, prod yếu"

1. **Mỗi cổng nghiệm thu chạy golden set trên cả `dev-hybrid` và `dev-local`.** Chênh lệch điểm là một chỉ số được theo dõi liên tục, không phải một bất ngờ ở tuần 20.
2. **Không viết prompt phụ thuộc tính năng riêng của provider.** Verifier trả JSON theo schema ta tự định nghĩa. Không dùng citation API riêng của bên nào — nếu dùng, `ModelProviderPort` sẽ rò rỉ chi tiết provider vào tầng nghiệp vụ và cú đổi sẽ đau.
3. **Latency của Phần 1–2 không dùng để kết luận về production.** Ghi rõ trong mọi báo cáo eval là số nào đo trên profile nào.

---

## 8. Kỳ vọng hiệu năng — và điều không được kết luận từ nó

| Chỉ số | Trên máy demo (`dev-hybrid`) | Trên phần cứng thật (`prod`) |
| --- | --- | --- |
| Embedding throughput | Đo ở tuần 1. Ước lượng 40–80 chunk/giây với batch 8 | Cao hơn nhiều, GPU lớn hơn và batch lớn hơn |
| Rerank 60 candidate | ~200–400 ms | ~50–100 ms |
| First token | Phụ thuộc mạng và API, không phụ thuộc máy | **Đây là số duy nhất có ý nghĩa cho NFR-01, và chỉ đo được trên `prod`** |
| Ingest 400 trang PDF | Chậm — parser và OCR ăn CPU, mà CPU cũng đang chạy mọi thứ khác | Nhanh hơn, và song song hoá được |

**Không được dùng số liệu máy demo để:** kết luận NFR-01 đạt hay không đạt; hứa với khách về thời gian ingest; chọn kích thước GPU cho bản pilot. Ba việc đó chỉ làm được sau khi có phần cứng thật, **mốc trước tuần 14**.

---

## 9. Checklist ngày 1

**Chuẩn bị môi trường** — tiến độ ở mục 4.4

- [ ] **B0** · Commit và push lên remote **trước khi chuyển bất cứ thứ gì** (mục 4.2) — `git init` đã xong, còn thiếu commit
- [x] **B1** · Đảm bảo C: còn ≥45 GB trống (mục 4.1) — xong 09-09, còn 50,3 GB
- [ ] **B1b** · `docker builder prune -a` — 28,4 GB còn sót, không rủi ro
- [ ] **B2** · Tạo `.wslconfig` giới hạn RAM (mục 4.3), rồi `wsl --shutdown`
- [ ] **B3** · `wsl --install -d Ubuntu` (để vị trí mặc định), chuyển repo vào `~/ei-ai` (mục 4.2)
- [ ] **B4** · Cài VS Code extension **Dev Containers** và **Remote-WSL**, mở `~/ei-ai`
- [ ] Xác nhận GPU vào được container: `docker run --rm --gpus all nvidia/cuda:12.6.0-base-ubuntu24.04 nvidia-smi`

**Dựng stack**

- [ ] Mở repo trong Dev Container → `pnpm install` chạy tự động qua `postCreateCommand`
- [ ] `docker compose up postgres redis infinity` → cả ba healthy
- [ ] Gọi thử `POST http://localhost:7997/embeddings` → trả về vector 1024 chiều
- [ ] Gọi thử `POST http://localhost:7997/rerank` → trả về điểm
- [ ] **Đo VRAM thực tế đang dùng:** `nvidia-smi --query-gpu=memory.used --format=csv` khi cả hai model đã nạp. Ghi lại con số
- [ ] Xác nhận HMR hoạt động: sửa một file component → thấy đổi trên browser dưới 1 giây
- [ ] Xác nhận debugger attach được vào cổng 9229 và dừng ở breakpoint
- [ ] Xác nhận IDE có autocomplete và báo lỗi type đúng (kiểm tra `typescript.tsdk`)

**Corpus và đo lường**

- [ ] Dựng corpus proxy: 30–50 văn bản luật PDF scan, 10–20 bảng báo cáo, bộ `.md` mẫu
- [ ] Chạy Docling + Tesseract trên corpus proxy ngoài luồng, ghi lại độ chính xác so với bản chép tay
- [ ] Ghi lại throughput embedding thực tế

**Báo cáo cuối tuần 1**

- [ ] VRAM thực dùng, throughput embedding, độ chính xác OCR trên proxy, và thời gian HMR — bốn con số này quyết định có cần đổi gì trong kế hoạch hay không

---

## 10. Còn mở

| # | Việc | Trạng thái | Cần trước |
| --- | --- | --- | --- |
| — | ~~Chốt nơi đặt mã nguồn~~ | **Đã chốt: phương án A** (Ubuntu WSL2, `~/ei-ai`) · 2026-09-08 | — |
| 1 | **Thực thi các bước chuẩn bị** ở mục 9 | B1 xong · B0 làm dở · B2–B4 chưa | **Tuần 1** |
| 2 | Anthropic API key cho môi trường dev | Chưa có | **Tuần 1** |
| 3 | Tài liệu thật của khách để đóng R-01 | Chưa có | **Tuần 8** |
| 4 | Tool catalogue thật của ERP MCP server | Chưa có | Tuần 12 |
| 5 | Chốt phần cứng pilot — GPU 48 GB (Qwen3-32B) hay 24 GB (Mistral Small 24B) | Chưa chốt | **Tuần 14** |
