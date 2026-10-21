# JWT Lab — Đăng nhập và phân quyền user/admin

Bài thực hành mới theo yêu cầu: giao diện web gửi POST đăng nhập, backend kiểm tra tài khoản trong SQLite và mật khẩu đã băm, trả JWT, client gửi `Authorization: Bearer <token>`, backend trả **200 / 401 / 403** theo quyền. Có solution `JwtDemo.sln` để mở bằng Visual Studio.

### Chức năng theo ảnh tham chiếu

Giao diện đơn giản, trình bày theo đúng các nhóm chức năng trong ảnh:

1. **Đăng nhập / Đăng ký / Đăng xuất**: nhập tài khoản và mật khẩu, bấm nút tương ứng. Hai nút tài khoản mẫu `user / 123456` và `admin / 123456` giúp điền nhanh.
2. **API Public / API User / API Admin**: Public ai cũng gọi được; User cần đăng nhập; Admin chỉ dành cho quản trị viên và trả danh sách tài khoản trong database.
3. **Kết quả từ server**: thông báo dễ hiểu cùng mã 200/401/403; đăng ký mới thành công trả 201, trùng tên trả 409, dữ liệu không hợp lệ trả 400.
4. **JWT hiện tại**: hiển thị đầy đủ token, tên tài khoản, quyền và hạn đăng nhập. Khung này được xóa khi đăng xuất, hết hạn hoặc nhận 401 từ API được bảo vệ.

Phần **Xem yêu cầu và JSON trả về** thu gọn bên dưới giúp thuyết minh và đối chiếu DevTools. Giao diện không có menu hoặc dashboard phức tạp.

**Đăng ký:** nhập tên mới dài 3–30 ký tự (chữ không dấu, số, dấu chấm, gạch dưới/gạch ngang) và mật khẩu 6–256 ký tự, rồi bấm **Đăng ký**. Tài khoản mới được lưu vào SQLite với mật khẩu đã băm và luôn có role `user`, kể cả khi client cố gửi `role=admin`. Đăng ký xong cần bấm **Đăng nhập** mới nhận JWT; không có chức năng công khai tự cấp quyền admin.

**Mật khẩu demo mới cho cả hai tài khoản: `123456`.** Nếu dùng database của bản trước, dừng server rồi chạy lại ở Development với `SEED_DEMO=true`; seed sẽ cập nhật hash của hai tài khoản demo sang mật khẩu này, không cần xóa database.

## 1. Mở nhanh bằng Visual Studio

1. Giải nén **toàn bộ ZIP** vào thư mục, không mở riêng file trong ZIP.
2. Cài **Visual Studio 2022 phiên bản 17.8 trở lên**, workload **ASP.NET and web development**, và **.NET 8 SDK**. Visual Studio phải hỗ trợ target `net8.0`; nếu chưa có, cài SDK tại <https://dotnet.microsoft.com/download/dotnet/8.0>.
3. Mở `JwtDemo.sln`. Cho phép Visual Studio khôi phục NuGet; lần đầu cần Internet để tải hai gói Microsoft.
4. Nếu cần, chuột phải project **JwtDemo → Set as Startup Project**. Chọn profile **JwtDemo**, nhấn **F5** hoặc **Ctrl+F5**.
5. Trình duyệt mở <http://localhost:5188>. Nếu không tự mở, truy cập địa chỉ đó.

**Không cần SQL Server, SSMS, Node.js hoặc Python để chạy ứng dụng.** Frontend nằm trong `wwwroot` và chạy chung server ASP.NET Core. Các công cụ Node/Python chỉ phục vụ kiểm thử bổ sung.

Khi chạy lần đầu bằng profile Development, ứng dụng tự:

- Tạo `src/JwtDemo/.env` chứa khóa JWT ngẫu nhiên do bộ sinh số mật mã tạo, không in khóa ra màn hình.
- Tạo SQLite ở `src/JwtDemo/App_Data/jwtdemo.db` với bảng `Users`.
- Seed hai tài khoản demo, lưu **PasswordHash**, không lưu mật khẩu dạng rõ trong database.

Không phải chép `.env.example` nếu dùng F5; một `.env` đã tồn tại nhưng có `JWT_KEY` rỗng sẽ gây lỗi cấu hình. Hãy điền khóa hoặc xóa file `.env` cục bộ đó và chạy lại trong Development để sinh mới. Không xóa database nếu muốn giữ dữ liệu.

## 2. Tài khoản demo — chỉ dùng thử nghiệm

| Tài khoản | Mật khẩu | Role |
|---|---|---|
| `user` | `123456` | `user` |
| `admin` | `123456` | `admin` |

Nút **user / 123456** và **admin / 123456** chỉ điền form; cần bấm **Đăng nhập** để gửi POST thật. Các mật khẩu demo có chủ ý được công khai trong bài tập; không dùng cho dịch vụ thật. Seed không tạo trùng tài khoản. Khi seed bật, mỗi lần khởi động Development sẽ bảo đảm mật khẩu hai tài khoản demo là `123456`; nếu đã đổi mật khẩu thủ công, seed sẽ đặt lại. Seed chỉ hoạt động khi cả môi trường **Development** và `SEED_DEMO=true`.

## 3. Chạy bằng dòng lệnh

Tại thư mục chứa `JwtDemo.sln`:

```powershell
dotnet restore JwtDemo.sln
dotnet build JwtDemo.sln --no-restore
dotnet run --project src/JwtDemo/JwtDemo.csproj --launch-profile JwtDemo
```

Mở <http://localhost:5188>. Trên Windows có thể chạy `RUN.cmd` thay lệnh cuối. Để dừng, nhấn Ctrl+C ở terminal hoặc nút Stop trong Visual Studio. Nếu cổng 5188 đang dùng, dừng phiên cũ hoặc đổi `applicationUrl` trong `Properties/launchSettings.json`; khi kiểm thử, truyền `-BaseUrl` theo cổng mới.

## 4. Cấu hình và database

Mẫu tên biến nằm trong `src/JwtDemo/.env.example`, không chứa bí mật thật. Biến môi trường của tiến trình ưu tiên hơn `.env`. Không dùng cú pháp `${...}` trong `.env`; parser chỉ hỗ trợ từng dòng `NAME=value`, giá trị có thể đặt trong dấu nháy.

| Biến | Ý nghĩa |
|---|---|
| `JWT_KEY` | Khóa ký HS256, ít nhất 32 byte UTF-8; tự sinh ngẫu nhiên 64 byte rồi lưu base64 khi chạy Development lần đầu |
| `JWT_ISSUER` | Bên phát hành, mặc định `JwtDemo` |
| `JWT_AUDIENCE` | Client nhận token, mặc định `JwtDemo.Web` |
| `JWT_MINUTES` | Thời hạn 1–120 phút, mặc định 15 |
| `DATABASE_PATH` | Đường dẫn file SQLite, mặc định `App_Data/jwtdemo.db`, tương đối với thư mục project |
| `SEED_DEMO` | `true` cho seed Development; tắt khi không muốn tạo tài khoản demo |

`EnsureCreatedAsync` tạo schema cho bài tập nhỏ này; không cần lệnh migration hoặc dịch vụ database riêng. Nếu muốn reset hoàn toàn demo: dừng app, xóa `App_Data/jwtdemo.db` cùng file `-wal`/`-shm` nếu có, chạy lại trong Development với seed bật. Thao tác này xóa dữ liệu cục bộ.

Mật khẩu sử dụng `PasswordHasher<AppUser>` của ASP.NET Core Identity, PBKDF2 kèm salt và 210.000 vòng lặp. Khi đăng nhập, dùng `VerifyHashedPassword`, không so sánh plaintext. Account role được giới hạn `user/admin` ở database. DTO trả về không chứa `PasswordHash`.

## 5. API và bảng quyền

| Method | API | Chưa đăng nhập | User | Admin |
|---|---|---|---|---|
| POST | `/api/auth/login` | Công khai; 200 nếu đúng thông tin | Công khai | Công khai |
| POST | `/api/auth/register` | Công khai; 201 khi tạo thành công | Công khai | Công khai |
| GET | `/api/demo/public` | **200** | **200** | **200** |
| GET | `/api/demo/user-area` hoặc `/api/me` | **401** | **200** | **200** |
| GET | `/api/demo/admin-area` hoặc `/api/admin` | **401** | **403** | **200** |

Token sai hoặc hết hạn khi gọi API được bảo vệ luôn trả **401**. Đăng nhập sai tài khoản/mật khẩu trả **401** với thông báo chung. Đăng ký dữ liệu thiếu/sai định dạng trả **400**, tên trùng (không phân biệt chữ hoa/thường) trả **409**. API quản trị trả ID, tên và role, không trả mật khẩu hoặc PasswordHash. Các endpoint cũ `/api/me` và `/api/admin` vẫn hoạt động để giữ tương thích với bộ kiểm tra trước.

Ví dụ body đăng nhập:

```json
{"username":"user","password":"123456"}
```

Response thành công có `accessToken`, `tokenType`, `expiresAt`, `user`. Payload JWT có `sub`, `name`, `role`, `jti`, `nbf`, `exp`, `iss`, `aud`. JWT được ký HS256, **không mã hóa**; không chứa mật khẩu.

Luồng xử lý:

1. Form trong `wwwroot/app.js` gửi `POST /api/auth/login` dưới dạng JSON, không gửi role.
2. `AuthController` tìm tài khoản SQLite, đối chiếu hash, lấy ID và role từ database.
3. `TokenService` tạo JWT có thời hạn bằng khóa lấy từ môi trường server.
4. Client giữ token trong biến `accessToken`, đính kèm `Authorization: Bearer <token>` khi gọi API được bảo vệ.
5. `JwtBearer` kiểm tra chữ ký, thuật toán HS256, issuer, audience và thời hạn; `ClockSkew = 0` để token hết hạn bị từ chối ngay.
6. Sau khi xác thực JWT, server còn kiểm tra tài khoản/role có còn khớp database hay không. `[Authorize(Roles = ...)]` quyết định quyền truy cập. Thiếu/sai/hết hạn → 401; hợp lệ nhưng thiếu quyền → 403; đủ quyền → 200.

### Lưu token và đăng xuất

Token chỉ nằm trong **bộ nhớ JavaScript của tab**; không dùng localStorage, sessionStorage hay cookie. Cách này đơn giản cho frontend/backend cùng origin và hạn chế lưu token lâu dài. Tải lại trang thì cần đăng nhập lại. Client tự xóa phiên khi hết giờ hoặc khi nhận 401; 403 không xóa phiên đang hợp lệ. Không thêm CORS vì không cần server frontend riêng.

Đăng xuất xóa token, thời gian phiên và dữ liệu response trên giao diện; request sau đó không còn Authorization. Client bỏ qua response đến muộn từ phiên cũ. Đây là logout phía client theo yêu cầu bài tập: bản sao token đã lấy trước logout vẫn có thể dùng tới khi hết hạn; bài này không triển khai blacklist/refresh token hoặc logout toàn thiết bị.

Các nút gọi API luôn hiện để dễ demo 401/403. Việc ẩn nút hoặc role trên giao diện không quyết định quyền; backend thực hiện phân quyền bắt buộc.

## 6. Cách kiểm tra 200 / 401 / 403

### Trên trình duyệt

1. Chưa đăng nhập → bấm **API Public** → **200**. Bấm **API User** hoặc **API Admin** → **401**.
2. Nhập tài khoản mới như `student01`, mật khẩu `123456` → bấm **Đăng ký** → **201**; đăng ký lại cùng tên → **409**. Tên sai định dạng/mật khẩu quá ngắn → **400**.
3. Đăng nhập sai mật khẩu → **401**, không cấp JWT.
4. Đăng nhập `user / 123456` → **200**, khung **JWT hiện tại** có token và thông tin phiên. **API User** → **200**; **API Admin** → **403**.
5. Bấm **Đăng xuất**: khung JWT được xóa. Gọi lại API User → **401**; DevTools cho thấy request không còn Authorization.
6. Đăng nhập `admin / 123456` → **API Admin** → **200**, có danh sách tài khoản, bao gồm tài khoản vừa đăng ký.
7. Đăng nhập tài khoản tự đăng ký → API User **200**, API Admin **403**, vì đăng ký luôn tạo role user.
8. Để thử hết hạn, đặt `JWT_MINUTES=1`, dừng/chạy lại app và đăng nhập mới; đợi hơn một phút. Giao diện yêu cầu đăng nhập lại và xóa khung JWT. Script bên dưới kiểm tra thêm token hết hạn trực tiếp với server.

### PowerShell — Windows, kiểm tra server đang chạy F5

Mở PowerShell tại thư mục solution, trong khi app vẫn đang chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\TEST_API.ps1
```

`Bypass` chỉ áp dụng cho tiến trình lệnh này. Script kiểm tra 13 trường hợp thật qua HTTP, gồm Public không cần đăng nhập, thiếu token, sai mật khẩu, JWT giả, user 200/403, admin 200, role giả gửi khi login, và JWT được ký đúng nhưng **đã hết hạn**. Script đọc khóa **cục bộ** từ môi trường hoặc `.env` để tự ký token hết hạn, không gửi khóa qua HTTP và không in khóa/token. Chạy với đúng ứng dụng local vừa tạo; nếu đang cấu hình cổng khác:

```powershell
.\TEST_API.ps1 -BaseUrl http://localhost:5199
```

### Kiểm thử backend cách ly, tùy chọn Python

```powershell
python tests/test_api.py
```

Cần .NET 8 SDK và Python 3.10+. Script tự chạy backend với khóa ngẫu nhiên và database tạm riêng, thực hiện 13 nhóm kiểm tra, rồi dừng server/xóa database test. Có thêm các trường hợp issuer/audience sai, thiếu exp, thuật toán sai, chữ ký sai, kiểm tra hash trong SQLite và không lộ hash ở response. Có thêm kiểm tra đăng ký thật, mật khẩu băm trong DB, tên trùng, dữ liệu sai, tài khoản đăng ký luôn là user và các endpoint giống ảnh. Nếu chưa có SDK, script báo **NOT RUN** và exit 2, không đánh dấu thành công.

### Kiểm thử trạng thái frontend, tùy chọn Node.js 18+

```powershell
node --test tests/frontend.test.cjs
```

Không cần `npm install`. 21 kiểm tra dùng DOM/fetch giả lập để xác minh logic gửi/xóa token, 401/403, response đến muộn, hết hạn, mật khẩu demo mới, hiện/ẩn mật khẩu, render/xóa bảng quản trị, lời giải thích quyền dễ hiểu hiển thị/xóa thông tin cá nhân, API Public, đăng ký không tự đăng nhập, lỗi đăng ký và hiển thị/xóa khung JWT. Đây là test client độc lập, **không thay thế kiểm thử backend thật**.

**Tình trạng đã kiểm chứng khi bàn giao:** đọc `TEST_RESULTS.md`. Môi trường tạo bài không có .NET SDK và chặn tải SDK/NuGet, vì vậy chưa xác nhận build/backend chạy được; hãy chạy build và các test HTTP trên máy Windows trước khi quay video/nộp bài.

## 7. Cấu trúc để giải thích trong video

```text
JwtDemo.sln                       Solution mở bằng Visual Studio
src/JwtDemo/
  Program.cs                      DI, SQLite, JwtBearer, middleware, startup seed
  Configuration/LocalEnvironment.cs  Nạp .env, sinh khóa Development
  Configuration/JwtSettings.cs     Đọc/kiểm tra cấu hình JWT
  Controllers/AuthController.cs   POST login/register, kiểm tra và băm mật khẩu
  Controllers/DemoController.cs   GET public/user/admin, Authorize theo role
  Services/TokenService.cs        Tạo JWT
  Models/AppUser.cs               Entity và các DTO không lộ PasswordHash
  Data/AppDbContext.cs            Bảng Users, role constraint
  Data/DatabaseSeeder.cs          Hai tài khoản demo có hash
  Properties/launchSettings.json  Profile F5, localhost:5188, Development
  wwwroot/                       HTML, CSS, JavaScript frontend
  .env.example                   Mẫu biến cấu hình không có khóa thật
RUN.cmd                           Chạy ứng dụng trên Windows
TEST_API.ps1                      Test HTTP với app đang chạy
tests/test_api.py                 Backend test độc lập (Python)
tests/frontend.test.cjs           Test client (Node)
VIDEO_SCRIPT.md                   Lời thuyết minh cá nhân khoảng 3–5 phút
TEST_RESULTS.md                   Phân biệt đã chạy/chưa kiểm chứng
```

## 8. Đưa code lên GitHub và nộp bài

Tạo một repository rỗng trên tài khoản GitHub của bạn, đặt tên tùy chọn. Từ thư mục solution:

```powershell
git init
git add .
git status --short
git commit -m "Add JWT authentication and user admin authorization"
git branch -M main
```

Kiểm tra `git status` trước commit: không được có `.env`, file database, `bin/`, `obj/`, `.vs/` hoặc khóa thật. `.gitignore` đã có sẵn. Sau đó sao chép **URL thật** của repository vừa tạo vào các lệnh sau:

```powershell
git remote add origin <URL_REPOSITORY_THAT_CUA_BAN>
git push -u origin main
```

Thay cả phần `<...>` bằng URL thật, không giữ nguyên dấu ngoặc. Bài bàn giao chưa được push và không có link GitHub giả. Không push từ thư mục cha chứa dự án hoặc tài liệu khác.

Quay video cá nhân theo `VIDEO_SCRIPT.md`, đăng lên nơi giảng viên yêu cầu hoặc chia sẻ link xem được. Nộp **link repository thật + link video cá nhân**. Bài tập đang là dự án mới theo yêu cầu của bạn; nếu giảng viên bắt buộc tích hợp bài nhóm cũ, cần chuyển chức năng này vào bài đó trước khi nộp.

## 9. Phạm vi bài tập

Đây là ứng dụng minh họa local, chưa có quên mật khẩu, refresh token, blacklist hoặc khóa tài khoản khi thử sai nhiều lần. HTTP localhost giúp F5 dễ chạy; khi đưa lên mạng cần HTTPS, quản lý khóa bằng môi trường triển khai, bỏ tài khoản demo và bổ sung biện pháp vận hành phù hợp. Không triển khai công khai trực tiếp bằng cấu hình demo.

Tài liệu chính thức: [JWT bearer](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication), [Role authorization](https://learn.microsoft.com/aspnet/core/security/authorization/roles), [EF Core SQLite](https://learn.microsoft.com/ef/core/providers/sqlite/), [Visual Studio và .NET SDK](https://learn.microsoft.com/dotnet/core/porting/versioning-sdk-msbuild-vs).
