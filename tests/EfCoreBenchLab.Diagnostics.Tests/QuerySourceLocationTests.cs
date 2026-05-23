using EfCoreBenchLab.Diagnostics.EntityFrameworkCore;

namespace EfCoreBenchLab.Diagnostics.Tests;

public sealed class QuerySourceLocationTests
{
    [Fact]
    public void Parse_extracts_class_member_and_line()
    {
        var source = QuerySourceLocation.Parse("OrderSearchRepository:SearchWithKnownPerformanceProblemAsync:24");

        Assert.NotNull(source);
        Assert.Equal("OrderSearchRepository", source.ClassName);
        Assert.Equal("SearchWithKnownPerformanceProblemAsync", source.Member);
        Assert.Equal(24, source.Line);
    }

    [Fact]
    public void Format_uses_class_name_without_absolute_path()
    {
        var source = SourceLocationFormatter.Format(
            "/Users/jk/Developer/personal/git/efcore-bench-lab/samples/EfCoreBenchLab.Api/Features/Orders/OrderSearchRepository.cs",
            "SearchWithKnownPerformanceProblemAsync",
            44);

        Assert.Equal("OrderSearchRepository:SearchWithKnownPerformanceProblemAsync:44", source);
    }

    [Fact]
    public void Format_uses_class_name_from_windows_paths()
    {
        var source = SourceLocationFormatter.Format(
            @"C:\agent\_work\1\s\src\MyApp\Orders\OrderSearchRepository.cs",
            "SearchAsync",
            12);

        Assert.Equal("OrderSearchRepository:SearchAsync:12", source);
    }
}
