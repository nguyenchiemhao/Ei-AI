# Tài liệu kỹ thuật hệ thống quản lý kho

## Tổng quan kiến trúc

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

### Xử lý nền

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.
