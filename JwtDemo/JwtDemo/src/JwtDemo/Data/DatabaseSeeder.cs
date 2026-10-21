using JwtDemo.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace JwtDemo.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services, bool seedDemo)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        if (!seedDemo) return;
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<AppUser>>();
        // Public demo credentials, used only for this local classroom exercise.
        var accounts = new[] {
            (Username: "user", Password: "123456", Name: "Người dùng demo", Role: "user"),
            (Username: "admin", Password: "123456", Name: "Quản trị viên demo", Role: "admin")
        };
        foreach (var account in accounts)
        {
            var user = await db.Users.SingleOrDefaultAsync(user => user.Username == account.Username);
            if (user is null)
            {
                user = new AppUser {
                    Username = account.Username, FullName = account.Name, Role = account.Role
                };
                user.PasswordHash = hasher.HashPassword(user, account.Password);
                db.Users.Add(user);
            }
            else if (hasher.VerifyHashedPassword(user, user.PasswordHash, account.Password)
                != PasswordVerificationResult.Success)
            {
                // Development demo only: migrate old demo passwords to the requested
                // 123456 password without deleting the user's local SQLite database.
                user.PasswordHash = hasher.HashPassword(user, account.Password);
            }
        }
        await db.SaveChangesAsync();
    }
}
