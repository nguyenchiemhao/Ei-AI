# Tài liệu kỹ thuật hệ thống theo dõi công nợ

## Tổng quan kiến trúc

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

### Xử lý nền

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

Hệ thống được triển khai theo kiến trúc nguyên khối có phân tách mô-đun rõ ràng, trong đó mỗi mô-đun chịu trách nhiệm cho một miền nghiệp vụ và giao tiếp với nhau qua giao diện đã công bố.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.
