# Kết quả kiểm tra khi bàn giao

Ngày: 21/10/2026. Báo cáo này phân biệt kiểm tra đã thực hiện với kịch bản chưa chạy được; không xác nhận backend đã build hoặc chạy thành công.

## Đã thực hiện

Lệnh:

```text
node --check src/JwtDemo/wwwroot/app.js
node --test tests/frontend.test.cjs
```

Kết quả bản bổ sung theo ảnh tham chiếu: JavaScript hợp lệ; **21/21 test client đạt**, không bỏ qua test nào. Mật khẩu hai tài khoản demo đã đổi thành `123456`.

| Kiểm tra client với DOM/fetch giả lập | Kết quả |
|---|---|
| Chưa đăng nhập, không gửi Authorization | PASS |
| Login POST chỉ gửi username/password; API sau đó dùng Bearer | PASS |
| Login sai xóa token cũ và báo lỗi | PASS |
| 403 vẫn giữ phiên để gọi API được phép | PASS |
| 401 xóa phiên, lần gọi tiếp không còn token cũ | PASS |
| Đăng xuất xóa token và token hiển thị ở response | PASS |
| Response dữ liệu cá nhân đến sau logout bị bỏ qua | PASS |
| 401 từ phiên cũ không xóa phiên mới | PASS |
| Timer hết hạn xóa token trước request tiếp theo | PASS |
| Lỗi kết nối có thông báo và mở lại nút gọi API | PASS |
| Hai nút demo điền đúng 123456 và lựa chọn User/Admin | PASS |
| Hiện/ẩn mật khẩu và tự ẩn lại khi logout | PASS |
| Bảng admin render text an toàn, logout xóa các dòng riêng tư | PASS |
| Giải thích quyền được phép/bị từ chối bằng tiếng Việt dễ hiểu | PASS |
| Thông tin cá nhân hiển thị rõ ràng và được xóa khi logout | PASS |
| Public gọi được khi chưa đăng nhập và không gửi Authorization | PASS |
| Đăng ký POST không gửi role/token và không tự tạo phiên đăng nhập | PASS |
| Đăng ký trùng tên báo dễ hiểu và mở lại nút thao tác | PASS |
| Đăng ký sai dữ liệu/lỗi kết nối có thông báo rõ ràng | PASS |
| Khung JWT hiển thị dữ liệu server và xóa khi logout/401 | PASS |
| Response đăng ký đến sau logout không ghi đè màn hình mới | PASS |

Ngoài ra đã parse các file JSON, XML `.csproj`, kiểm tra cú pháp Python của `tests/test_api.py`, đối chiếu đường dẫn project trong solution và tài nguyên HTML, kiểm tra ZIP chứa source cần thiết, không có khóa thật/database/dependencies.

Các test client dùng response mô phỏng. PASS ở đây **không chứng minh server trả đúng 200/401/403**.

## Chưa kiểm chứng do môi trường

`dotnet --info` trả `dotnet: command not found`. Đã thử truy cập nguồn SDK Microsoft và NuGet, nhưng môi trường trả HTTP 403. Vì vậy không cài được SDK hoặc restore package để chạy ứng dụng.

Đã thực sự gọi `python tests/test_api.py`; script báo:

```text
NOT RUN: .NET 8 SDK is missing. Install the SDK, then rerun this script.
```

Script dừng exit 2; **không có test backend nào được tính là đạt**.

| Kiểm tra backend thật | Trạng thái |
|---|---|
| Restore NuGet, build solution, chạy F5 trong Visual Studio | Chưa kiểm chứng |
| Tạo database/seed và xác minh hash thực tế | Chưa kiểm chứng |
| Đổi mật khẩu tài khoản demo trong database cũ khi khởi động Development | Đã triển khai, chưa kiểm chứng runtime |
| Login đúng trả JWT, login sai trả 401 | Chưa kiểm chứng |
| Đăng ký thật lưu hash, không cho tự chọn role admin | Chưa kiểm chứng |
| Đăng ký thành công 201, trùng 409, dữ liệu sai 400 | Chưa kiểm chứng |
| API Public không cần đăng nhập và các route mới giống ảnh | Chưa kiểm chứng |
| Thiếu token, token giả, sai chữ ký hoặc hết hạn → 401 | Chưa kiểm chứng |
| User gọi profile → 200; admin API → 403 | Chưa kiểm chứng |
| Admin gọi profile và admin API → 200 | Chưa kiểm chứng |
| Gửi role giả từ client không nâng quyền | Chưa kiểm chứng |
| PowerShell TEST_API.ps1 | Chưa chạy vì không có backend/.NET/PowerShell |

Đã thử mở giao diện bằng Playwright, nhưng không có executable Chromium trong môi trường; tải Chromium bị chặn HTTP 403. Chưa hoàn tất kiểm tra hiển thị trên trình duyệt hoặc thao tác bằng chuột. Không có screenshot được dùng làm bằng chứng chạy ứng dụng.

## Thực hiện trên máy trước khi nộp

1. Cài Visual Studio với ASP.NET workload và .NET 8 SDK; giải nén ZIP.
2. Mở `JwtDemo.sln`, restore/build, chạy F5.
3. Chạy `powershell -NoProfile -ExecutionPolicy Bypass -File .\TEST_API.ps1` khi app đang chạy; cần 13 dòng PASS.
4. Thử bằng trình duyệt: đăng ký, API Public, login user/admin, 200/401/403, DevTools Bearer header, khung JWT và logout không còn token.
5. Nếu có Python, chạy `python tests/test_api.py` để kiểm thử backend với database riêng.
6. Cập nhật kết quả thực tế, quay video và push lên GitHub. Không tuyên bố đã chạy thành công khi chưa thực hiện các bước này.
