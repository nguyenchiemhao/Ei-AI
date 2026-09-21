# Tài liệu kỹ thuật hệ thống quản lý kho

## Tổng quan kiến trúc

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

Mọi biến môi trường đều được kiểm tra bằng lược đồ khi khởi động, nên một cấu hình thiếu sẽ làm tiến trình dừng ngay thay vì gây lỗi khó truy vết về sau.

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

### Xử lý nền

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Mọi biến môi trường đều được kiểm tra bằng lược đồ khi khởi động, nên một cấu hình thiếu sẽ làm tiến trình dừng ngay thay vì gây lỗi khó truy vết về sau.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.
