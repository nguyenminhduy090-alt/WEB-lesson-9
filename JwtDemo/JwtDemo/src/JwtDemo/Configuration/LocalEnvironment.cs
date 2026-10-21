using System.Security.Cryptography;

namespace JwtDemo.Configuration;

public static class LocalEnvironment
{
    // Process environment wins over .env. Development only: create a private,
    // random local key, rather than shipping a hard-coded signing secret.
    public static void Load(IWebHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, ".env");
        if (!File.Exists(path) && environment.IsDevelopment()
            && string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("JWT_KEY")))
        {
            using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write);
            using var writer = new StreamWriter(stream);
            writer.WriteLine("# Local development only. Never commit this file.");
            writer.WriteLine($"JWT_KEY={Convert.ToBase64String(RandomNumberGenerator.GetBytes(64))}");
            writer.WriteLine("JWT_ISSUER=JwtDemo\nJWT_AUDIENCE=JwtDemo.Web\nJWT_MINUTES=15");
            writer.WriteLine("DATABASE_PATH=App_Data/jwtdemo.db\nSEED_DEMO=true");
        }

        if (!File.Exists(path)) return;
        foreach (var line in File.ReadLines(path))
        {
            var text = line.Trim();
            if (text.Length == 0 || text.StartsWith('#')) continue;
            var separator = text.IndexOf('=');
            if (separator <= 0) continue;
            var key = text[..separator].Trim();
            var value = text[(separator + 1)..].Trim();
            if (value.Length >= 2 && ((value.StartsWith('"') && value.EndsWith('"'))
                || (value.StartsWith('\'') && value.EndsWith('\''))))
                value = value[1..^1];
            if (Environment.GetEnvironmentVariable(key) is null)
                Environment.SetEnvironmentVariable(key, value);
        }
    }
}
