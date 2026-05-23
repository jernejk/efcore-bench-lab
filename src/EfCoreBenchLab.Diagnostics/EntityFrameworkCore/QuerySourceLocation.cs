namespace EfCoreBenchLab.Diagnostics.EntityFrameworkCore;

public sealed record QuerySourceLocation(string ClassName, string Member, int Line)
{
    public override string ToString() => $"{ClassName}:{Member}:{Line}";

    public static QuerySourceLocation? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var lastSeparator = value.LastIndexOf(':');
        if (lastSeparator < 0 || !int.TryParse(value[(lastSeparator + 1)..], out var line))
        {
            return null;
        }

        var withoutLine = value[..lastSeparator];
        var memberSeparator = withoutLine.LastIndexOf(':');
        if (memberSeparator < 0)
        {
            return null;
        }

        return new QuerySourceLocation(
            withoutLine[..memberSeparator],
            withoutLine[(memberSeparator + 1)..],
            line);
    }
}
