# Tài liệu kỹ thuật hệ thống tra cứu tài liệu

## Tổng quan kiến trúc

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

Điều kiện phân quyền được đưa thẳng vào câu truy vấn thay vì lọc sau khi đã lấy dữ liệu, bảo đảm rằng người dùng không thể nhận được đoạn văn bản nằm ngoài phạm vi được phép.

### Xử lý nền

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Hệ thống được triển khai theo kiến trúc nguyên khối có phân tách mô-đun rõ ràng, trong đó mỗi mô-đun chịu trách nhiệm cho một miền nghiệp vụ và giao tiếp với nhau qua giao diện đã công bố.
