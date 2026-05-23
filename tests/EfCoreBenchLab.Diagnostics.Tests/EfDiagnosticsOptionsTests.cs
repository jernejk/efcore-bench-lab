using EfCoreBenchLab.Diagnostics.Options;

namespace EfCoreBenchLab.Diagnostics.Tests;

public sealed class EfDiagnosticsOptionsTests
{
    [Theory]
    [InlineData("true")]
    [InlineData("1")]
    [InlineData("actual")]
    [InlineData("include-execution-plan")]
    public void IsExecutionPlanRequest_accepts_supported_header_values(string value)
    {
        var options = new EfDiagnosticsOptions();

        Assert.True(options.IsExecutionPlanRequest(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("false")]
    [InlineData("no")]
    public void IsExecutionPlanRequest_rejects_missing_or_unsupported_values(string? value)
    {
        var options = new EfDiagnosticsOptions();

        Assert.False(options.IsExecutionPlanRequest(value));
    }
}
