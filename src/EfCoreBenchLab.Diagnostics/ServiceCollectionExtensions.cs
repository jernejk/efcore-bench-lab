using EfCoreBenchLab.Diagnostics.AspNetCore;
using EfCoreBenchLab.Diagnostics.EntityFrameworkCore;
using EfCoreBenchLab.Diagnostics.Options;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace EfCoreBenchLab.Diagnostics;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddEfCoreBenchLabDiagnostics(
        this IServiceCollection services,
        Action<EfDiagnosticsOptions>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(services);

        if (configure is not null)
        {
            services.Configure(configure);
        }

        services.AddSingleton<EfDiagnosticsContextAccessor>();
        services.AddSingleton<EfDiagnosticsInterceptor>();

        return services;
    }

    public static DbContextOptionsBuilder UseEfCoreBenchLabDiagnostics(
        this DbContextOptionsBuilder options,
        IServiceProvider serviceProvider)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(serviceProvider);

        options.AddInterceptors(serviceProvider.GetRequiredService<EfDiagnosticsInterceptor>());
        return options;
    }

    public static IApplicationBuilder UseEfCoreBenchLabDiagnostics(this IApplicationBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        return app.UseMiddleware<EfDiagnosticsMiddleware>();
    }
}
