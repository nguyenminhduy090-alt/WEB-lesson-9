using JwtDemo.Models;
using Microsoft.EntityFrameworkCore;

namespace JwtDemo.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasIndex(user => user.Username).IsUnique();
        modelBuilder.Entity<AppUser>().ToTable("Users", table =>
            table.HasCheckConstraint("CK_Users_Role", "Role IN ('user', 'admin')"));
    }
}
