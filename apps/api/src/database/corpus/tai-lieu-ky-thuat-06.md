# Tài liệu kỹ thuật hệ thống phân quyền truy cập

## Tổng quan kiến trúc

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Mọi biến môi trường đều được kiểm tra bằng lược đồ khi khởi động, nên một cấu hình thiếu sẽ làm tiến trình dừng ngay thay vì gây lỗi khó truy vết về sau.

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

### Xử lý nền

Mọi biến môi trường đều được kiểm tra bằng lược đồ khi khởi động, nên một cấu hình thiếu sẽ làm tiến trình dừng ngay thay vì gây lỗi khó truy vết về sau.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.
