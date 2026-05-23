using EfCoreBenchLab.Diagnostics.EntityFrameworkCore;

namespace EfCoreBenchLab.Diagnostics.Tests;

public sealed class QuerySourceLocationTests
{
    [Fact]
    public void Parse_extracts_path_member_and_line()
    {
        var source = QuerySourceLocation.Parse("src/EfCoreBenchLab.Api/Features/Orders/OrderSearchRepository.cs:SearchWithKnownPerformanceProblemAsync:24");

        Assert.NotNull(source);
        Assert.Equal("src/EfCoreBenchLab.Api/Features/Orders/OrderSearchRepository.cs", source.Path);
        Assert.Equal("SearchWithKnownPerformanceProblemAsync", source.Member);
        Assert.Equal(24, source.Line);
    }
}
