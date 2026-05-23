using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;

namespace EfCoreBenchLab.Diagnostics.EntityFrameworkCore;

public static class QueryableTaggingExtensions
{
    public static IQueryable<T> TagWithContext<T>(
        this IQueryable<T> source,
        string context,
        [CallerFilePath] string sourceFilePath = "",
        [CallerMemberName] string memberName = "",
        [CallerLineNumber] int lineNumber = 0)
    {
        ArgumentNullException.ThrowIfNull(source);

        if (string.IsNullOrWhiteSpace(context))
        {
            throw new ArgumentException("Query context must not be empty.", nameof(context));
        }

        return source
            .TagWith($"efbench.context:{context}")
            .TagWith($"efbench.source:{SourceLocationFormatter.Format(sourceFilePath, memberName, lineNumber)}");
    }
}

internal static class SourceLocationFormatter
{
    public static string Format(string sourceFilePath, string memberName, int lineNumber)
    {
        var path = Normalize(sourceFilePath);
        return $"{path}:{memberName}:{lineNumber}";
    }

    private static string Normalize(string sourceFilePath)
    {
        if (string.IsNullOrWhiteSpace(sourceFilePath))
        {
            return "unknown";
        }

        var normalized = sourceFilePath.Replace('\\', '/');
        var fileName = normalized[(normalized.LastIndexOf('/') + 1)..];

        return Path.GetFileNameWithoutExtension(fileName) is { Length: > 0 } className
            ? className
            : "unknown";
    }
}
