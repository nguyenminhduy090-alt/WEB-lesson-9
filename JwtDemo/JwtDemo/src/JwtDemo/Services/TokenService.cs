using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using JwtDemo.Configuration;
using JwtDemo.Models;
using Microsoft.IdentityModel.Tokens;

namespace JwtDemo.Services;

public sealed class TokenService(JwtSettings settings)
{
    public LoginResponse Create(AppUser user)
    {
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(settings.Minutes);
        // Identity and role are read from the database user, never the login body.
        var claims = new[] {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("name", user.Username),
            new Claim("role", user.Role)
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(settings.Issuer, settings.Audience,
            claims, notBefore: now, expires: expires, signingCredentials: credentials);
        return new(new JwtSecurityTokenHandler().WriteToken(token), "Bearer", expires, UserInfo.From(user));
    }
}
