using JwtDemo.Data;
using JwtDemo.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JwtDemo.Controllers;

[ApiController]
[Route("api")]
public sealed class DemoController(AppDbContext db) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("demo/public")]
    public IActionResult Public() => Ok(new {
        message = "Đây là chức năng công khai. Ai cũng truy cập được, không cần đăng nhập."
    });

    [Authorize(Roles = "user,admin")]
    [HttpGet("me")]
    [HttpGet("demo/user-area")]
    public async Task<IActionResult> Me()
    {
        var id = int.Parse(User.FindFirst("sub")!.Value);
        var account = await db.Users.AsNoTracking().SingleAsync(user => user.Id == id);
        return Ok(new { message = "Được phép truy cập thông tin cá nhân.", user = UserInfo.From(account) });
    }

    [Authorize(Roles = "admin")]
    [HttpGet("admin")]
    [HttpGet("demo/admin-area")]
    public async Task<IActionResult> Admin()
    {
        var users = await db.Users.AsNoTracking().OrderBy(user => user.Id)
            .Select(user => new UserInfo(user.Id, user.Username, user.FullName, user.Role)).ToListAsync();
        return Ok(new { message = "Được phép truy cập chức năng quản trị.", totalUsers = users.Count, users });
    }
}
