// No npm install required: these tests use Node's built-in test runner.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/JwtDemo/wwwroot/app.js'), 'utf8');

function browser() {
  const nodes = new Map();
  const calls = [];
  const replies = [];
  let timer;
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', className: '', disabled: false, hidden: false,
      type: 'password', events: {}, attributes: {}, children: [],
      addEventListener(event, handler) { this.events[event] = handler; }, focus() {}, reportValidity() { return true; },
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren(...children) { this.children = children; },
      append(child) { this.children.push(child); }
    });
    return nodes.get(id);
  };
  const context = vm.createContext({
    document: {
      getElementById: node, querySelectorAll: () => [],
      createElement: tag => ({ tag, textContent: '', className: '', children: [], append(child) { this.children.push(child); } })
    }, window: { addEventListener() {} },
    setTimeout: callback => { timer = callback; return 1; },
    clearTimeout: () => { timer = null; },
    setInterval: () => 2, clearInterval() {},
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const next = replies.shift();
      if (!next) throw new Error('No mocked response queued');
      return typeof next === 'function' ? next() : next;
    }
  });
  vm.runInContext(source, context);
  return {
    node, calls, replies, context,
    reply(status, data) { replies.push({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data) }); },
    fire(id, event = 'click') { return node(id).events[event]({ preventDefault() {} }); },
    expire() { timer(); }
  };
}
function loginData(role = 'user') {
  return { accessToken: `signed-${role}-token`, expiresAt: new Date(Date.now() + 900000).toISOString(), user: { username: role, role, fullName: 'Demo' } };
}
async function login(b, role = 'user') {
  b.fire(`demo-${role}`);
  b.reply(200, loginData(role));
  await b.fire('login-form', 'submit');
}

test('Anonymous request has no Authorization header', async () => {
  const b = browser(); b.reply(401, { message: 'Unauthorized' });
  await b.fire('call-me');
  assert.equal(b.calls[0].headers.Authorization, undefined);
  assert.match(b.node('http-status').textContent, /401/);
});
test('Login POST sends username/password only; protected calls attach Bearer', async () => {
  const b = browser(); await login(b);
  assert.equal(b.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(b.calls[0].body), { username: 'user', password: '123456' });
  assert.equal(b.calls[0].headers.Authorization, undefined);
  b.reply(200, { user: { role: 'user' } }); await b.fire('call-me');
  assert.equal(b.calls[1].headers.Authorization, 'Bearer signed-user-token');
  assert.equal(b.node('password').value, '');
});
test('Wrong login clears any previous token and displays a readable message', async () => {
  const b = browser(); await login(b);
  b.reply(401, { message: 'Tài khoản hoặc mật khẩu không đúng.' });
  await b.fire('login-form', 'submit');
  assert.match(b.node('login-message').textContent, /không đúng/);
  b.reply(401, {}); await b.fire('call-me');
  assert.equal(b.calls[2].headers.Authorization, undefined);
});
test('403 preserves a valid session for subsequent allowed calls', async () => {
  const b = browser(); await login(b);
  b.reply(403, { message: 'Forbidden' }); await b.fire('call-admin');
  assert.match(b.node('http-status').textContent, /403/);
  b.reply(200, {}); await b.fire('call-me');
  assert.equal(b.calls[2].headers.Authorization, 'Bearer signed-user-token');
});
test('401 invalidates the session; next API call has no stale token', async () => {
  const b = browser(); await login(b);
  b.reply(401, { message: 'Expired' }); await b.fire('call-me');
  assert.match(b.node('login-message').textContent, /đăng nhập lại/);
  b.reply(401, {}); await b.fire('call-admin');
  assert.equal(b.calls[2].headers.Authorization, undefined);
});
test('Logout removes token, clears visible login response, and stops Authorization', async () => {
  const b = browser(); await login(b, 'admin'); b.fire('logout');
  assert.equal(b.node('logout').disabled, true);
  assert.doesNotMatch(b.node('response-output').textContent, /signed-admin-token/);
  b.reply(401, {}); await b.fire('call-admin');
  assert.equal(b.calls[1].headers.Authorization, undefined);
});
test('A protected response arriving after logout cannot restore old private data', async () => {
  const b = browser(); await login(b);
  let finish;
  b.replies.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = b.fire('call-me');
  b.fire('logout');
  finish({ status: 200, ok: true, text: async () => JSON.stringify({ privateData: 'old-private-data' }) });
  await pending;
  assert.doesNotMatch(b.node('response-output').textContent, /old-private-data/);
});
test('A new login cannot be invalidated by a stale 401 from the previous session', async () => {
  const b = browser(); await login(b);
  let finish;
  b.replies.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = b.fire('call-me');
  await login(b, 'admin');
  finish({ status: 401, ok: false, text: async () => '{}' }); await pending;
  assert.match(b.node('session-status').textContent, /admin/);
});
test('Expiry timer clears the token before the next request', async () => {
  const b = browser(); await login(b); b.expire();
  assert.match(b.node('login-message').textContent, /hết hạn/);
  b.reply(401, {}); await b.fire('call-me');
  assert.equal(b.calls[1].headers.Authorization, undefined);
});
test('Network failure is visible and re-enables the API button', async () => {
  const b = browser();
  b.replies.push(() => { throw new Error('Offline'); });
  await b.fire('call-me');
  assert.match(b.node('http-status').textContent, /KẾT NỐI/);
  assert.equal(b.node('call-me').disabled, false);
});

test('Both demo choices use 123456 and update the selected role', () => {
  const b = browser();
  b.fire('demo-user');
  assert.equal(b.node('username').value, 'user');
  assert.equal(b.node('password').value, '123456');
  assert.equal(b.node('demo-user').attributes['aria-pressed'], 'true');
  b.fire('demo-admin');
  assert.equal(b.node('username').value, 'admin');
  assert.equal(b.node('password').value, '123456');
  assert.equal(b.node('demo-user').attributes['aria-pressed'], 'false');
});
test('Password visibility toggle works and logout hides it again', async () => {
  const b = browser();
  b.fire('demo-user'); b.fire('toggle-password');
  assert.equal(b.node('password').type, 'text');
  assert.equal(b.node('toggle-password').attributes['aria-label'], 'Ẩn mật khẩu');
  await login(b); b.fire('toggle-password'); b.fire('logout');
  assert.equal(b.node('password').type, 'password');
  assert.equal(b.node('password').value, '');
});
test('Admin table uses text cells and logout removes private account rows', async () => {
  const b = browser(); await login(b, 'admin');
  b.reply(200, { users: [{ username: 'user', fullName: '<img src=x onerror=alert(1)>', role: 'user', id: 1 }] });
  await b.fire('call-admin');
  assert.equal(b.node('members-table-wrap').hidden, false);
  const cells = b.node('members-body').children[0].children;
  assert.equal(cells[0].textContent, 'user');
  assert.equal(cells[1].textContent, '<img src=x onerror=alert(1)>');
  assert.equal(cells[1].children.length, 0);
  assert.equal(cells[2].children[0].textContent, 'Người dùng');
  b.fire('logout');
  assert.equal(b.node('members-table-wrap').hidden, true);
  assert.equal(b.node('members-body').children.length, 0);
});
test('Results explain allowed and denied access in plain Vietnamese', async () => {
  const b = browser(); await login(b);
  b.reply(200, {}); await b.fire('call-me');
  assert.match(b.node('result-title').textContent, /được phép xem thông tin/);
  b.reply(403, { message: 'Forbidden' }); await b.fire('call-admin');
  assert.match(b.node('result-title').textContent, /không có quyền/);
  assert.match(b.node('result-message').textContent, /đăng xuất.*admin/);
  assert.match(b.node('session-status').textContent, /user/);
});

test('Profile is readable and private profile data is cleared on logout', async () => {
  const b = browser(); await login(b);
  b.reply(200, { user: { username: 'user', fullName: 'Demo', role: 'user' } });
  await b.fire('call-me');
  assert.equal(b.node('profile-info').hidden, false);
  assert.equal(b.node('profile-role').textContent, 'Người dùng');
  b.fire('logout');
  assert.equal(b.node('profile-info').hidden, true);
  assert.equal(b.node('profile-name').textContent, '');
});

test('API Public works without login and never sends an Authorization header', async () => {
  const b = browser();
  b.reply(200, { message: 'Public' }); await b.fire('call-public');
  assert.equal(b.calls[0].url, '/api/demo/public');
  assert.equal(b.calls[0].headers.Authorization, undefined);
  assert.match(b.node('result-title').textContent, /công khai/);
  await login(b);
  b.reply(200, {}); await b.fire('call-public');
  assert.equal(b.calls[2].headers.Authorization, undefined);
  assert.match(b.node('session-status').textContent, /user/);
});
test('Registration sends a public POST with no role and does not create a login session', async () => {
  const b = browser();
  b.node('username').value = 'student01'; b.node('password').value = '123456';
  b.reply(201, { user: { username: 'student01', role: 'user' } });
  await b.fire('register-button');
  assert.equal(b.calls[0].url, '/api/auth/register');
  assert.equal(b.calls[0].method, 'POST');
  assert.deepEqual(JSON.parse(b.calls[0].body), { username: 'student01', password: '123456' });
  assert.equal(b.calls[0].headers.Authorization, undefined);
  assert.match(b.node('result-title').textContent, /Đăng ký thành công/);
  assert.match(b.node('session-status').textContent, /chưa đăng nhập/);
  b.reply(401, {}); await b.fire('call-me');
  assert.equal(b.calls[1].headers.Authorization, undefined);
});
test('Duplicate registration displays a helpful message and restores the buttons', async () => {
  const b = browser();
  b.node('username').value = 'user'; b.node('password').value = '123456';
  b.reply(409, { message: 'Tài khoản này đã tồn tại.' }); await b.fire('register-button');
  assert.match(b.node('result-message').textContent, /tên tài khoản mới/);
  assert.match(b.node('http-status').textContent, /409/);
  assert.equal(b.node('register-button').disabled, false);
  assert.equal(b.node('login-button').disabled, false);
});
test('Registration validation and network errors are readable', async () => {
  const b = browser(); b.reply(400, { errors: { Password: ['Too short'] } });
  await b.fire('register-button');
  assert.match(b.node('result-message').textContent, /ít nhất 6/);
  b.replies.push(() => { throw new Error('Offline'); }); await b.fire('register-button');
  assert.match(b.node('result-title').textContent, /kết nối/);
  assert.equal(b.node('register-button').disabled, false);
});
test('Current JWT panel shows server data and clears on logout and HTTP 401', async () => {
  const b = browser(); await login(b, 'admin');
  assert.equal(b.node('current-token').textContent, 'signed-admin-token');
  assert.equal(b.node('token-username').textContent, 'admin');
  assert.match(b.node('token-role').textContent, /Quản trị viên/);
  assert.ok(b.node('token-expiry').textContent.length > 0);
  b.fire('logout');
  assert.doesNotMatch(b.node('current-token').textContent, /signed-admin-token/);
  assert.equal(b.node('token-username').textContent, '—');
  await login(b);
  b.reply(401, {}); await b.fire('call-me');
  assert.doesNotMatch(b.node('current-token').textContent, /signed-user-token/);
  assert.equal(b.node('token-role').textContent, '—');
});
test('Registration result arriving after logout cannot overwrite the newer screen', async () => {
  const b = browser(); let finish;
  b.replies.push(() => new Promise(resolve => { finish = resolve; }));
  const pending = b.fire('register-button');
  b.fire('logout');
  finish({ status: 201, ok: true, text: async () => '{}' }); await pending;
  assert.equal(b.node('result-title').textContent, 'Bạn đã đăng xuất');
});
