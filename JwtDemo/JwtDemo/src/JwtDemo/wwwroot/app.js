"use strict";

// JWT stays in memory only. Reloading the page or logging out removes it.
let accessToken = null;
let expiryTimer = null;
let sessionVersion = 0; // Ignore responses from an older login session.
const $ = (id) => document.getElementById(id);
const roleName = (role) => role === "admin" ? "Quản trị viên" : "Người dùng";

function showMessage(message, error = false, success = false) {
  $("login-message").textContent = message;
  $("login-message").className = error ? "message error" : success ? "message success" : "message";
}

function resetMembers() {
  $("members-body").replaceChildren();
  $("members-table-wrap").hidden = true;
}

function renderMembers(users) {
  const rows = users.map((user) => {
    const row = document.createElement("tr");
    for (const [index, value] of [user.username, user.fullName, user.role].entries()) {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      if (index === 2) {
        cell.textContent = "";
        const badge = document.createElement("span");
        badge.className = user.role === "admin" ? "role-tag admin" : "role-tag";
        badge.textContent = roleName(user.role);
        cell.append(badge);
      }
      row.append(cell);
    }
    return row;
  });
  // textContent above keeps server-provided names as text, never executable HTML.
  $("members-body").replaceChildren(...rows);
  $("members-table-wrap").hidden = users.length === 0;
}

function showResult(method, path, status, data) {
  $("profile-info").hidden = true;
  resetMembers();
  $("request-line").textContent = `${method} ${path}`;
  $("response-output").textContent = JSON.stringify(data, null, 2);
  const labels = { 200: "200 Authorized — Được phép", 201: "201 Created — Đăng ký thành công", 400: "400 — Kiểm tra lại thông tin", 401: "401 Unauthorized — Cần đăng nhập", 403: "403 Forbidden — Không đủ quyền", 409: "409 — Tài khoản đã tồn tại" };
  $("http-status").textContent = labels[status] || (status ? `Lỗi · ${status}` : "LỖI KẾT NỐI");
  $("http-status").className = "http-status" + (status === 200 || status === 201 ? " success" : status === 401 ? " unauthorized" : status >= 400 ? " denied" : "");
  $("result-box").className = "result-box" + (status === 200 || status === 201 ? " success" : " error");

  let title = "Chưa thực hiện được thao tác";
  let message = "Vui lòng thử lại sau.";
  if (status === 201 && path === "/api/auth/register") {
    title = "Đăng ký thành công";
    message = "Tài khoản mới có quyền Người dùng. Bấm Đăng nhập để sử dụng tài khoản vừa tạo.";
  } else if (status === 200 && path === "/api/demo/public") {
    title = "Bạn được phép truy cập chức năng công khai";
    message = "API Public ai cũng dùng được, không cần đăng nhập.";
  } else if (status === 200 && path === "/api/auth/login") {
    title = "Đăng nhập thành công";
    message = "Bây giờ hãy bấm một chức năng ở bước 2.";
  } else if (status === 200 && (path === "/api/me" || path === "/api/demo/user-area")) {
    title = "Bạn được phép xem thông tin của mình";
    message = "Thông tin tài khoản của bạn được hiển thị bên dưới.";
    if (data.user) {
      $("profile-name").textContent = data.user.fullName;
      $("profile-username").textContent = data.user.username;
      $("profile-role").textContent = roleName(data.user.role);
      $("profile-info").hidden = false;
    }
  } else if (status === 200 && (path === "/api/admin" || path === "/api/demo/admin-area")) {
    title = "Bạn được phép xem danh sách tài khoản";
    const users = Array.isArray(data.users) ? data.users : [];
    message = users.length ? `Có ${users.length} tài khoản trong danh sách.` : "Danh sách hiện chưa có tài khoản.";
    renderMembers(users);
  } else if (status === 401 && path === "/api/auth/login") {
    title = "Tài khoản hoặc mật khẩu chưa đúng";
    message = "Bạn hãy chọn Người dùng hoặc Quản trị viên ở bước 1, rồi bấm Đăng nhập. Mật khẩu là 123456.";
  } else if (status === 401) {
    title = "Bạn cần đăng nhập trước";
    message = "Chưa đăng nhập hoặc phiên đã hết hạn. Hãy đăng nhập ở bước 1 rồi thử lại.";
  } else if (status === 403) {
    title = "Bạn không có quyền xem danh sách tài khoản";
    message = "Chức năng này chỉ dành cho quản trị viên. Hãy đăng xuất rồi đăng nhập bằng tài khoản admin.";
  } else if (status === 409) {
    title = "Tài khoản này đã tồn tại";
    message = "Hãy nhập một tên tài khoản mới, rồi bấm Đăng ký.";
  } else if (status === 400) {
    title = "Bạn hãy kiểm tra lại thông tin";
    message = path === "/api/auth/register"
      ? "Tên tài khoản dài 3–30 ký tự, không có dấu hoặc khoảng trắng. Mật khẩu dài ít nhất 6 ký tự."
      : "Điền tài khoản và mật khẩu, rồi bấm Đăng nhập.";
  } else if (!status) {
    title = "Chưa kết nối được với ứng dụng";
    message = "Kiểm tra ứng dụng đang chạy trong Visual Studio, rồi thử lại.";
  }
  $("result-title").textContent = title;
  $("result-message").textContent = message;
}

function hidePassword() {
  $("password").type = "password";
  $("toggle-password").textContent = "Hiện";
  $("toggle-password").setAttribute("aria-label", "Hiện mật khẩu");
  $("toggle-password").setAttribute("aria-pressed", "false");
}

function clearSession(message = "Đã đăng xuất. Bạn có thể chọn tài khoản khác để đăng nhập.", error = false) {
  sessionVersion++;
  accessToken = null;
  clearTimeout(expiryTimer);
  $("current-token").textContent = "Chưa có JWT. Hãy đăng nhập.";
  for (const id of ["token-username", "token-role", "token-expiry"]) $(id).textContent = "—";
  resetMembers();
  $("profile-info").hidden = true;
  for (const id of ["profile-name", "profile-username", "profile-role"]) $(id).textContent = "";
  hidePassword();
  $("session-dot").className = "status-dot";
  $("session-status").textContent = "Bạn chưa đăng nhập";
  $("session-details").textContent = "Đăng nhập xong, bạn có thể thử các chức năng ở bước 2.";
  $("logout").disabled = true;
  $("http-status").textContent = "Chưa thực hiện";
  $("http-status").className = "http-status";
  $("result-box").className = "result-box";
  $("result-title").textContent = error ? "Bạn cần đăng nhập lại" : "Chưa có kết quả mới";
  $("result-message").textContent = message;
  $("request-line").textContent = "Chưa có yêu cầu mới.";
  $("response-output").textContent = JSON.stringify({ message }, null, 2);
  $("technical-details").open = false;
  showMessage(message, error);
}

async function readResponse(response) {
  const text = await response.text();
  try { return JSON.parse(text); }
  catch { return { message: text || response.statusText }; }
}

function selectDemo(role) {
  $("username").value = role;
  $("password").value = "123456";
  hidePassword();
  for (const account of ["user", "admin"]) {
    $("demo-" + account).className = role === account ? "selected" : "";
    $("demo-" + account).setAttribute("aria-pressed", String(role === account));
  }
  showMessage(`Đã điền tài khoản ${role}. Bây giờ bấm nút Đăng nhập.`);
}
$("demo-user").addEventListener("click", () => selectDemo("user"));
$("demo-admin").addEventListener("click", () => selectDemo("admin"));
$("toggle-password").addEventListener("click", () => {
  const visible = $("password").type === "password";
  $("password").type = visible ? "text" : "password";
  $("toggle-password").textContent = visible ? "Ẩn" : "Hiện";
  $("toggle-password").setAttribute("aria-label", visible ? "Ẩn mật khẩu" : "Hiện mật khẩu");
  $("toggle-password").setAttribute("aria-pressed", String(visible));
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearSession("Đang đăng nhập, vui lòng chờ…");
  const version = sessionVersion;
  $("login-button").disabled = true;
  $("register-button").disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Only credentials are sent. Role always comes from the server database.
      body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value })
    });
    const data = await readResponse(response);
    if (version !== sessionVersion) return;
    showResult("POST", "/api/auth/login", response.status, data);
    if (!response.ok) {
      showMessage(data.message || "Kiểm tra lại tài khoản và mật khẩu rồi thử lại.", true);
      return;
    }
    const expiresAt = Date.parse(data.expiresAt);
    if (!data.accessToken || !data.user || !Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new Error("Server trả về phiên đăng nhập không hợp lệ.");
    accessToken = data.accessToken;
    $("current-token").textContent = data.accessToken;
    $("token-username").textContent = data.user.username;
    $("token-role").textContent = `${roleName(data.user.role)} (${data.user.role})`;
    $("token-expiry").textContent = new Date(expiresAt).toLocaleString("vi-VN");
    $("password").value = "";
    $("session-dot").className = "status-dot active";
    $("session-status").textContent = `Đã đăng nhập: ${data.user.username}`;
    $("session-details").textContent = `Quyền của bạn: ${roleName(data.user.role)}.\nHãy thử các chức năng ở bước 2.`;
    $("logout").disabled = false;
    showMessage("Đăng nhập thành công. Tiếp tục sang bước 2.", false, true);
    expiryTimer = setTimeout(() => clearSession("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", true), expiresAt - Date.now());
  } catch (error) {
    if (version !== sessionVersion) return;
    clearSession("Chưa đăng nhập được. Kiểm tra ứng dụng và thử lại.", true);
    showResult("POST", "/api/auth/login", 0, { message: error.message });
  } finally {
    $("login-button").disabled = false;
    $("register-button").disabled = false;
  }
});

$("register-button").addEventListener("click", async () => {
  if (!$("login-form").reportValidity()) return;
  clearSession("Đang đăng ký tài khoản…");
  const version = sessionVersion;
  $("register-button").disabled = true;
  $("login-button").disabled = true;
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("username").value.trim(), password: $("password").value })
    });
    const data = await readResponse(response);
    if (version !== sessionVersion) return;
    showResult("POST", "/api/auth/register", response.status, data);
    showMessage(response.ok ? "Đăng ký thành công. Giữ nguyên thông tin và bấm Đăng nhập."
      : (data.message || "Thông tin đăng ký chưa hợp lệ. Xem hướng dẫn trong phần Kết quả."), !response.ok, response.ok);
    // Registration never grants an authenticated session; login must issue a JWT.
  } catch (error) {
    if (version !== sessionVersion) return;
    showResult("POST", "/api/auth/register", 0, { message: error.message });
    showMessage("Chưa kết nối được ứng dụng. Hãy kiểm tra và thử lại.", true);
  } finally {
    $("register-button").disabled = false;
    $("login-button").disabled = false;
  }
});

async function callApi(path, button, needsToken = true) {
  const version = sessionVersion;
  button.disabled = true;
  try {
    const headers = { Accept: "application/json" };
    if (needsToken && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(path, { method: "GET", headers });
    const data = await readResponse(response);
    if (version !== sessionVersion) return;
    if (needsToken && response.status === 401)
      clearSession("Bạn chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.", true);
    showResult("GET", path, response.status, data);
  } catch (error) {
    if (version === sessionVersion)
      showResult("GET", path, 0, { message: "Không kết nối được ứng dụng. " + error.message });
  } finally { button.disabled = false; }
}
$("call-public").addEventListener("click", () => callApi("/api/demo/public", $("call-public"), false));
$("call-me").addEventListener("click", () => callApi("/api/demo/user-area", $("call-me")));
$("call-admin").addEventListener("click", () => callApi("/api/demo/admin-area", $("call-admin")));
$("logout").addEventListener("click", () => {
  clearSession();
  $("password").value = "";
  $("result-title").textContent = "Bạn đã đăng xuất";
  $("http-status").textContent = "Đã đăng xuất";
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) clearSession("Vui lòng đăng nhập lại.");
});
