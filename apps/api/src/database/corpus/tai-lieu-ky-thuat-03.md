# Tài liệu kỹ thuật hệ thống phân quyền truy cập

## Tổng quan kiến trúc

Chỉ mục tìm kiếm kết hợp hai nhánh: nhánh véc-tơ dựa trên độ tương đồng ngữ nghĩa và nhánh từ khóa dựa trên chỉ mục toàn văn, sau đó hợp nhất kết quả bằng thuật toán xếp hạng nghịch đảo.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Hệ thống được triển khai theo kiến trúc nguyên khối có phân tách mô-đun rõ ràng, trong đó mỗi mô-đun chịu trách nhiệm cho một miền nghiệp vụ và giao tiếp với nhau qua giao diện đã công bố.

## Luồng xử lý

### Tiếp nhận và lưu trữ

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

Dữ liệu tài liệu được lưu theo nguyên tắc định địa chỉ bằng nội dung, nghĩa là khóa lưu trữ được sinh ra từ mã băm của chính nội dung tệp tin.

### Xử lý nền

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

Mỗi phiên bản tài liệu đi qua một máy trạng thái xác định, và bất kỳ chuyển trạng thái nào không hợp lệ đều bị từ chối ở tầng ứng dụng lẫn tầng cơ sở dữ liệu.

```sql
SELECT count(*) FROM chunks WHERE embedding IS NULL;
```

## Vận hành và giám sát

Tiến trình xử lý nền nhận việc từ hàng đợi, thực hiện tách trang, cắt đoạn và sinh véc-tơ nhúng theo lô để hạn chế dung lượng bộ nhớ đồ họa cần dùng cùng lúc.

Hệ thống được triển khai theo kiến trúc nguyên khối có phân tách mô-đun rõ ràng, trong đó mỗi mô-đun chịu trách nhiệm cho một miền nghiệp vụ và giao tiếp với nhau qua giao diện đã công bố.
