using System.ComponentModel.DataAnnotations;

namespace JwtDemo.Models;

public sealed class AppUser
{
    public int Id { get; set; }
    [MaxLength(80)] public string Username { get; set; } = "";
    [MaxLength(100)] public string FullName { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    [MaxLength(10)] public string Role { get; set; } = "user";
}

public sealed class LoginRequest
{
    [Required, StringLength(80)] public string Username { get; init; } = "";
    [Required, StringLength(256)] public string Password { get; init; } = "";
}

public sealed class RegisterRequest
{
    [Required, StringLength(30, MinimumLength = 3)]
    [RegularExpression(@"^[a-zA-Z0-9._-]+$",
        ErrorMessage = "Tên tài khoản chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.")]
    public string Username { get; init; } = "";

    [Required, StringLength(256, MinimumLength = 6)]
    public string Password { get; init; } = "";
    // Registration deliberately has no Role field. New accounts always have user rights.
}

// Never serialize the database entity: this DTO intentionally omits PasswordHash.
public sealed record UserInfo(int Id, string Username, string FullName, string Role)
{
    public static UserInfo From(AppUser user) => new(user.Id, user.Username, user.FullName, user.Role);
}

public sealed record LoginResponse(string AccessToken, string TokenType,
    DateTime ExpiresAt, UserInfo User);
