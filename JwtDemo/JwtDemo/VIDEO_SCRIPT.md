# Kịch bản video cá nhân — theo giao diện ảnh mẫu (khoảng 4–5 phút)

Trước khi quay: mở JwtDemo.sln trong Visual Studio, chạy F5, kiểm tra ứng dụng hoạt động trên máy bạn. Mở DevTools (F12) → Network → Fetch/XHR. Không mở hoặc đọc khóa trong `.env` lên video. Thay [họ tên/mã sinh viên] bằng thông tin thật. Chỉ mô tả các kết quả đã chạy được thực tế.

## 0:00–0:25 — Giới thiệu

**Hiển thị:** Giao diện web và Solution Explorer.

“Em là [họ tên], mã sinh viên [mã sinh viên]. Bài này dùng ASP.NET Core 8, SQLite và HTML/CSS/JavaScript. Các chức năng gồm đăng nhập, đăng ký, đăng xuất, API Public, User và Admin. Bên dưới có khung JWT hiện tại, tên tài khoản, quyền và hạn đăng nhập.”

“Controllers xử lý API, Data quản lý database, TokenService tạo JWT và wwwroot chứa giao diện.”

## 0:25–1:05 — Public và đăng ký

**Thao tác:** Khi chưa đăng nhập, bấm API Public → 200. Bấm API User → 401. Nhập một tài khoản mới chưa tồn tại như `student01`, mật khẩu `123456`, bấm Đăng ký → 201. Bấm lại Đăng ký để thấy tên trùng → 409 nếu còn thời gian.

“API Public ai cũng dùng được. API User cần đăng nhập nên trả 401. Tài khoản mới được lưu trong database, mật khẩu được băm. Đăng ký luôn tạo quyền user; client không thể tự chọn quyền admin. Sau đăng ký cần bấm Đăng nhập mới nhận JWT.”

## 1:05–2:00 — User, JWT và phân quyền

**Thao tác:** Bấm tài khoản mẫu user / 123456 → Đăng nhập. Mở request `/api/auth/login` trong DevTools. Chỉ rõ POST, body username/password, response `accessToken`, `expiresAt`, user. Chỉ vào khung JWT hiện tại trên trang. Bấm API User → 200, mở Request Headers để thấy `Authorization: Bearer ...`. Bấm API Admin → 403.

“Server kiểm tra tài khoản và mật khẩu rồi cấp JWT. JWT có định danh người dùng, role và thời hạn, không chứa mật khẩu. Client gửi token qua Authorization Bearer cho các request cần đăng nhập.”

“User xem được thông tin cá nhân, nhưng không có quyền xem danh sách quản trị. Server trả 403 vì token hợp lệ nhưng không đủ quyền.”

## 2:00–2:40 — Admin và đăng xuất

**Thao tác:** Đăng xuất → khung JWT mất token. Gọi API User → 401; DevTools cho thấy không còn Authorization. Chọn admin / 123456 → Đăng nhập → API Admin → 200. Chỉ ra danh sách tài khoản trong DB, có tài khoản vừa đăng ký.

“Đăng xuất xóa token trong bộ nhớ client. Request mới không còn token nên bị từ chối. Khi đăng nhập admin, server cho phép truy cập chức năng quản trị và trả danh sách tài khoản. Danh sách không chứa mật khẩu hay hash mật khẩu.”

## 2:40–3:50 — Giải thích code

**Hiển thị:** AuthController.cs, TokenService.cs, Program.cs và DemoController.cs.

“Trong AuthController, đăng ký cố định role user và băm mật khẩu trước khi lưu. Đăng nhập tìm tài khoản từ database rồi gọi VerifyHashedPassword. Khi đúng, TokenService nhận tài khoản đó để tạo JWT.”

“TokenService tạo claim sub, name, role và hạn dùng. Role lấy từ database. Khóa HS256 lấy từ môi trường server, không đặt trong frontend hay commit lên GitHub.”

“Program.cs cấu hình JwtBearer kiểm tra chữ ký, thuật toán, issuer, audience và hạn dùng. Token thiếu, sai hoặc hết hạn trả 401. Sau đó server kiểm tra quyền. Authentication chạy trước Authorization.”

“DemoController cho API Public dùng AllowAnonymous, API User dùng Authorize cho user/admin và API Admin dùng Authorize chỉ admin. Phân quyền nằm ở backend, không phụ thuộc nút có được hiển thị trên web hay không.”

## 3:50–4:30 — Sai thông tin, token giả và hết hạn

**Thao tác:** Thử mật khẩu sai để thấy 401. Chạy TEST_API.ps1 với app đang chạy; chỉ hiển thị các dòng PASS nếu script thực sự thành công trên máy bạn.

“Script kiểm tra Public không cần đăng nhập, thiếu token, token giả, token được ký đúng nhưng đã hết hạn, user bị 403 và admin được 200. Client nhận 401 từ API được bảo vệ sẽ xóa phiên và yêu cầu đăng nhập lại. 403 chỉ từ chối thao tác, không xóa phiên còn hợp lệ.”

## 4:30–4:45 — Nội dung nộp

**Hiển thị:** README và repository GitHub thật đã push.

“README có hướng dẫn chạy, tài khoản mẫu, API, phân quyền và kiểm thử. Em nộp link GitHub cùng video cá nhân này. Em cảm ơn thầy/cô.”

## Trước khi nộp

- Build và chạy thật ứng dụng; đọc TEST_RESULTS.md và cập nhật theo kết quả trên máy.
- Video có đăng ký, Public 200 khi chưa đăng nhập, User 200/401, Admin 403/200.
- Thấy login POST, JWT trong response, header Authorization Bearer và khung JWT trên giao diện.
- Thấy đăng xuất xóa JWT và request sau không còn token.
- Không đưa `.env`, khóa thật, database, bin/obj/.vs lên GitHub.
- Dùng link GitHub và video thật, có quyền xem đúng yêu cầu giảng viên.
