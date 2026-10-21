"""Real backend integration tests. Python standard library + .NET 8 SDK only.
Starts an isolated Development server and temporary SQLite database.
Does not alter your normal demo database or signing key.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def encode(value):
    if isinstance(value, dict):
        value = json.dumps(value, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="jwtdemo-test-")
        cls.key = secrets.token_urlsafe(64)
        cls.database = Path(cls.temp.name) / "test.db"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        cls.log = open(Path(cls.temp.name) / "server.log", "w+", encoding="utf-8")
        env = dict(os.environ, ASPNETCORE_ENVIRONMENT="Development",
                   ASPNETCORE_URLS=cls.base, JWT_KEY=cls.key, JWT_ISSUER="JwtDemo",
                   JWT_AUDIENCE="JwtDemo.Web", JWT_MINUTES="15",
                   DATABASE_PATH=str(cls.database), SEED_DEMO="true",
                   DOTNET_CLI_TELEMETRY_OPTOUT="1")
        cls.server = subprocess.Popen(
            ["dotnet", "run", "--no-launch-profile", "--project",
             str(ROOT / "src/JwtDemo/JwtDemo.csproj")],
            cwd=ROOT, env=env, stdout=cls.log, stderr=subprocess.STDOUT)
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            try:
                with urlopen(cls.base, timeout=1) as response:
                    if response.status == 200:
                        return
            except (OSError, URLError):
                pass
            if cls.server.poll() is not None:
                break
            time.sleep(.3)
        cls.server.terminate()
        cls.server.wait(timeout=15)
        cls.log.seek(0)
        log = cls.log.read()
        cls.log.close()
        cls.temp.cleanup()
        raise RuntimeError("Backend did not start; restore/build/runtime log:\n" + log)

    @classmethod
    def tearDownClass(cls):
        cls.server.terminate()
        try:
            cls.server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait()
        cls.log.close()
        cls.temp.cleanup()

    def request(self, path, token=None, data=None):
        headers = {"Accept": "application/json"}
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        body = None if data is None else json.dumps(data).encode()
        if body:
            headers["Content-Type"] = "application/json"
        request = Request(self.base + path, data=body, headers=headers,
                          method="GET" if data is None else "POST")
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            return response.status, json.load(response)

    def login(self, username="user", password="123456", **extra):
        return self.request("/api/auth/login", data=dict(username=username, password=password, **extra))

    def signed_token(self, overrides=None, key=None, algorithm="HS256"):
        status, login = self.login()
        self.assertEqual(status, 200)
        claims = dict(sub=str(login["user"]["id"]), name="user", role="user",
                      iss="JwtDemo", aud="JwtDemo.Web", nbf=int(time.time()) - 120,
                      exp=int(time.time()) + 60)
        if overrides:
            claims.update(overrides)
        if claims.get("exp") is None:
            claims.pop("exp", None)
        body = encode(dict(alg=algorithm, typ="JWT")) + "." + encode(claims)
        signature = encode(hmac.new((key or self.key).encode(), body.encode(), hashlib.sha256).digest())
        return body + "." + signature

    def test_login_returns_signed_jwt_with_identity_role_and_expiry(self):
        status, data = self.login()
        self.assertEqual(status, 200)
        header, payload, signature = data["accessToken"].split(".")
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        self.assertEqual(claims["role"], "user")
        self.assertEqual(claims["sub"], str(data["user"]["id"]))
        self.assertGreater(claims["exp"], time.time())
        self.assertEqual(signature, encode(hmac.new(self.key.encode(), (header + "." + payload).encode(), hashlib.sha256).digest()))
        self.assertNotIn("password", json.dumps(claims).lower())
        self.assertNotIn("password", json.dumps(data).lower())

    def test_wrong_password_and_unknown_user_return_401(self):
        for username, password in [("user", "wrong"), ("missing", "wrong")]:
            with self.subTest(username=username):
                self.assertEqual(self.login(username, password)[0], 401)

    def test_missing_token_returns_401_on_both_endpoints(self):
        self.assertEqual(self.request("/api/me")[0], 401)
        self.assertEqual(self.request("/api/admin")[0], 401)

    def test_fake_tampered_and_expired_tokens_return_401(self):
        tokens = ["fake-token", self.signed_token(key="wrong-key" * 8),
                  self.signed_token({"exp": int(time.time()) - 60})]
        for token in tokens:
            with self.subTest(kind=tokens.index(token)):
                self.assertEqual(self.request("/api/me", token)[0], 401)

    def test_wrong_issuer_audience_algorithm_and_missing_expiry(self):
        tokens = [self.signed_token({"iss": "wrong"}), self.signed_token({"aud": "wrong"}),
                  self.signed_token({"exp": None}), self.signed_token(algorithm="none")]
        for token in tokens:
            with self.subTest(kind=tokens.index(token)):
                self.assertEqual(self.request("/api/me", token)[0], 401)

    def test_user_can_access_profile_but_not_admin(self):
        _, data = self.login()
        self.assertEqual(self.request("/api/me", data["accessToken"])[0], 200)
        self.assertEqual(self.request("/api/admin", data["accessToken"])[0], 403)

    def test_admin_can_access_both_endpoints_without_hash_leak(self):
        status, data = self.login("admin", "123456")
        self.assertEqual(status, 200)
        token = data["accessToken"]
        self.assertEqual(self.request("/api/me", token)[0], 200)
        status, admin = self.request("/api/admin", token)
        self.assertEqual(status, 200)
        self.assertEqual(admin["totalUsers"], 2)
        self.assertNotIn("password", json.dumps(admin).lower())

    def test_role_in_login_body_does_not_escalate_privileges(self):
        status, data = self.login(role="admin")
        self.assertEqual(status, 200)
        self.assertEqual(data["user"]["role"], "user")
        self.assertEqual(self.request("/api/admin", data["accessToken"])[0], 403)

    def test_database_contains_hashes_not_plaintext(self):
        with sqlite3.connect(self.database) as database:
            rows = database.execute('SELECT Username, PasswordHash FROM Users').fetchall()
        self.assertEqual(len(rows), 2)
        for username, password_hash in rows:
            self.assertGreater(len(password_hash), 50)
            self.assertNotEqual(password_hash, "123456")

    def remove_test_account(self, username):
        with sqlite3.connect(self.database) as database:
            database.execute('DELETE FROM Users WHERE Username = ?', (username.lower(),))

    def test_public_api_does_not_require_login(self):
        status, data = self.request("/api/demo/public")
        self.assertEqual(status, 200)
        self.assertIn("message", data)

    def test_demo_aliases_have_the_same_role_protection(self):
        for path in ["/api/demo/user-area", "/api/demo/admin-area"]:
            self.assertEqual(self.request(path)[0], 401)
        _, user = self.login()
        self.assertEqual(self.request("/api/demo/user-area", user["accessToken"])[0], 200)
        self.assertEqual(self.request("/api/demo/admin-area", user["accessToken"])[0], 403)
        _, admin = self.login("admin", "123456")
        self.assertEqual(self.request("/api/demo/admin-area", admin["accessToken"])[0], 200)

    def test_register_always_creates_user_hashes_password_and_requires_login(self):
        username = "test_" + secrets.token_hex(4)
        self.addCleanup(self.remove_test_account, username)
        status, registered = self.request("/api/auth/register", data={
            "username": username, "password": "123456", "role": "admin"
        })
        self.assertEqual(status, 201)
        self.assertEqual(registered["user"]["role"], "user")
        self.assertNotIn("accessToken", registered)
        self.assertNotIn("password", json.dumps(registered).lower())
        with sqlite3.connect(self.database) as database:
            stored_hash = database.execute('SELECT PasswordHash FROM Users WHERE Username = ?',
                                           (username,)).fetchone()[0]
        self.assertNotEqual(stored_hash, "123456")
        self.assertGreater(len(stored_hash), 50)
        status, login = self.login(username, "123456")
        self.assertEqual(status, 200)
        self.assertEqual(self.request("/api/me", login["accessToken"])[0], 200)
        self.assertEqual(self.request("/api/admin", login["accessToken"])[0], 403)

    def test_register_rejects_duplicate_and_invalid_credentials(self):
        self.assertEqual(self.request("/api/auth/register", data={
            "username": "USER", "password": "123456"
        })[0], 409)
        for username, password in [("ab", "123456"), ("bad name", "123456"),
                                   ("a" * 31, "123456"), ("newuser", "123")]:
            with self.subTest(username=username):
                self.assertEqual(self.request("/api/auth/register", data={
                    "username": username, "password": password
                })[0], 400)


if __name__ == "__main__":
    if not shutil.which("dotnet"):
        print("NOT RUN: .NET 8 SDK is missing. Install the SDK, then rerun this script.", file=sys.stderr)
        sys.exit(2)
    unittest.main(verbosity=2)
