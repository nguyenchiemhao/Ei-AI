# Tài liệu kỹ thuật hệ thống phân quyền truy cập

## Tổng quan kiến trúc

Toàn bộ dịch vụ chạy trong các vùng mạng nội bộ không có đường ra Internet mặc định; mọi kết nối ra ngoài bắt buộc phải đi qua máy chủ proxy có danh sách cho phép.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

Khi một lô xử lý thất bại, hệ thống thử lại theo chiến lược lùi dần theo cấp số nhân và ghi nguyên nhân thất bại cuối cùng vào bản ghi phiên bản tài liệu.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

### Xử lý nền

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Nhật ký kiểm toán được ghi trong cùng giao dịch với hành động tạo ra nó, do đó hành động và bản ghi của hành động cùng được cam kết hoặc cùng bị hủy bỏ.

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.
