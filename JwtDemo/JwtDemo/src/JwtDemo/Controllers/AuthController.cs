using JwtDemo.Data;
using JwtDemo.Models;
using JwtDemo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace JwtDemo.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AppDbContext db, IPasswordHasher<AppUser> hasher,
    TokenService tokens) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var username = request.Username.ToLowerInvariant();
        if (await db.Users.AnyAsync(account => account.Username == username))
            return Conflict(new { message = "Tài khoản này đã tồn tại. Bạn hãy chọn tên khác." });

        var user = new AppUser { Username = username, FullName = username, Role = "user" };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        try { await db.SaveChangesAsync(); }
        catch (DbUpdateException exception) when
            (exception.InnerException is SqliteException { SqliteErrorCode: 19 })
        {
            // The unique index also protects against simultaneous duplicate registrations.
            return Conflict(new { message = "Tài khoản này đã tồn tại. Bạn hãy chọn tên khác." });
        }
        return StatusCode(StatusCodes.Status201Created, new {
            message = "Đăng ký thành công. Hãy bấm Đăng nhập để sử dụng tài khoản mới.",
            user = UserInfo.From(user)
        });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var user = await db.Users.SingleOrDefaultAsync(account => account.Username == username);
        if (user is null)
            return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không đúng." });
        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
            return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không đúng." });
        if (user.Role is not ("user" or "admin"))
            return Unauthorized(new { message = "Tài khoản không hợp lệ." });
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, request.Password);
            await db.SaveChangesAsync();
        }
        return Ok(tokens.Create(user));
    }
}
