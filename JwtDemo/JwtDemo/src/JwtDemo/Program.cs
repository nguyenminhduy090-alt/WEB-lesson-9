using System.Text;
using JwtDemo.Configuration;
using JwtDemo.Data;
using JwtDemo.Models;
using JwtDemo.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
LocalEnvironment.Load(builder.Environment);
builder.Configuration.AddEnvironmentVariables();
var jwt = JwtSettings.Read(builder.Configuration);
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TokenService>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210_000);
builder.Services.AddScoped<IPasswordHasher<AppUser>, PasswordHasher<AppUser>>();

var databasePath = Path.GetFullPath(builder.Configuration["DATABASE_PATH"] ?? "App_Data/jwtdemo.db",
    builder.Environment.ContentRootPath);
Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
var connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString();
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddControllers();

// JwtBearer verifies signature, algorithm, issuer, audience and expiration.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
            ValidateIssuer = true, ValidIssuer = jwt.Issuer,
            ValidateAudience = true, ValidAudience = jwt.Audience,
            ValidateLifetime = true, RequireExpirationTime = true,
            RequireSignedTokens = true, ClockSkew = TimeSpan.Zero,
            NameClaimType = "name", RoleClaimType = "role"
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                // Reject a removed account or an outdated role even before JWT expiry.
                var subject = context.Principal?.FindFirst("sub")?.Value;
                var role = context.Principal?.FindFirst("role")?.Value;
                if (!int.TryParse(subject, out var id) || role is not ("user" or "admin"))
                { context.Fail("Invalid account."); return; }
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                if (!await db.Users.AsNoTracking().AnyAsync(user => user.Id == id && user.Role == role))
                    context.Fail("Account or role has changed.");
            },
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.Headers["WWW-Authenticate"] = "Bearer";
                await context.Response.WriteAsJsonAsync(new {
                    message = "Chưa đăng nhập hoặc phiên đăng nhập không hợp lệ/hết hạn. Vui lòng đăng nhập lại."
                });
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new {
                    message = "Bạn đã đăng nhập nhưng không có quyền admin để truy cập chức năng này."
                });
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler(error => error.Run(async context =>
    {
        context.Response.StatusCode = 500;
        await context.Response.WriteAsJsonAsync(new { message = "Có lỗi máy chủ." });
    }));
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api"))
        context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

var seedDemo = app.Environment.IsDevelopment()
    && bool.TryParse(app.Configuration["SEED_DEMO"], out var seed) && seed;
await DatabaseSeeder.SeedAsync(app.Services, seedDemo);
app.Run();
