using System.Text;

namespace JwtDemo.Configuration;

public sealed record JwtSettings(string Key, string Issuer, string Audience, int Minutes)
{
    public static JwtSettings Read(IConfiguration configuration)
    {
        var key = configuration["JWT_KEY"] ?? "";
        if (Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException(
                "JWT_KEY must contain at least 32 UTF-8 bytes. Use Development for automatic local setup or configure server environment variables.");
        var issuer = configuration["JWT_ISSUER"] ?? "JwtDemo";
        var audience = configuration["JWT_AUDIENCE"] ?? "JwtDemo.Web";
        if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience))
            throw new InvalidOperationException("JWT_ISSUER and JWT_AUDIENCE cannot be empty.");
        var lifetime = configuration["JWT_MINUTES"] ?? "15";
        if (!int.TryParse(lifetime, out var minutes) || minutes < 1 || minutes > 120)
            throw new InvalidOperationException("JWT_MINUTES must be between 1 and 120.");
        return new(key, issuer, audience, minutes);
    }
}
