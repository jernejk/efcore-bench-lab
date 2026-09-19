# efinsights — tiny-model EF Core log insights

A minimal .NET CLI that reads Aspire / EF Core command logs, **locates the slow app queries deterministically**, and **explains each one with a tiny local LFM2.5 LoRA expert** — fully offline, $0, no API key.

It's a companion to `EfCoreBenchLab.Diagnostics`: that library tags queries with their source (`Class:Method:Line`) and captures execution plans; this tool turns the resulting logs into a ranked, explained report.

## The idea: code + fuzzy logic, per investigation
Each investigation is **deterministic code where the structure is known, plus a tiny LFM2.5 LoRA expert where judgement is needed**. Code parses, scans, groups and counts (facts you shouldn't guess); the 350M model adds the call that needs a bit of fuzziness (which smell, what fix). It's the "chain many tiny specialists + boring code" idea from the nano-fleet experiment, applied to real logs.

## Investigations
| command | deterministic part | tiny-model part |
|---|---|---|
| `slow` | locate slow app queries (duration + source, skip infra) | SQL-smell + fix hint per query |
| `nplusone` | group by request, normalize SQL, count repeats → N+1 | smell lens on the repeated query |
| `all` | run them all (default) | |

The split is deliberate: *source + duration + the N+1 count* are facts you parse; *smell + fix* is the judgement a tiny specialist is good at. Swap `--adapter` to change the lens.

## Backends
`--backend` picks who makes the judgement call; the deterministic facts are always printed either way.

| backend | what it is | needs |
|---|---|---|
| `none` (default) | deterministic facts only | nothing |
| `local` | the bundled 350M LFM2.5 `sql-smell` LoRA, offline, $0 | `--model <base.gguf>` |
| `jev` | hosted decision model (`typesafe/jev-1.13` via OpenRouter) | `OPENROUTER_API_KEY` |

Every backend degrades to bare facts and exits 0 when it is unavailable — missing key, missing model, API down, or spend cap reached. The `jev` backend caches each decision on disk under `.jev-cache/` and records spend in `jev-ledger.jsonl`, capped by `--spend-cap` (default $0.50). Answers below `--confidence` (default 0.75) are withheld rather than shown.

The API key is read **only** from the `OPENROUTER_API_KEY` environment variable and is never printed or written to disk.

## Run
```bash
# deterministic only (no model needed)
dotnet run -c Release -- all path/to/aspire.log

# hosted decision backend
export OPENROUTER_API_KEY=...
dotnet run -c Release -- all path/to/capture.json --backend jev --confidence 0.75

# with the tiny model + bundled sql-smell adapter
dotnet run -c Release -- all path/to/aspire.log --model path/to/LFM2.5-350M-Q4_K_M.gguf

# just one investigation
dotnet run -c Release -- nplusone path/to/aspire.log
```
The base GGUF is ~230 MB — grab it once from Hugging Face (`LiquidAI/LFM2.5-350M-GGUF`, file `LFM2.5-350M-Q4_K_M.gguf`) and pass it with `--model`. The `sql-smell.gguf` adapter ships in `models/` and is picked up automatically.

Options: `--adapter <file.gguf>` · `--slow-ms 200` (threshold) · `--top 5`.

## Example
```
🔴 #1     2,705 ms   OrderSearchRepository:SearchByOverFetchingAsync:79
       path: /scenarios/bad/over-fetching
       sql:  SELECT [o].*, [c].*, [p].* FROM [SalesOrders] AS [o] INNER JOIN ...
       🧠 {"smell":"missing_where","sargable":true,"severity":"medium","fix_hint":"add_filter"}

🟠 #2       812 ms   ProductRepository:SearchByNameAsync:42
       path: /products/search
       sql:  SELECT * FROM [Products] WHERE [Name] LIKE '%phone%'
       🧠 {"smell":"leading_wildcard","sargable":false,"severity":"high","fix_hint":"rewrite_predicate"}
```

## The adapter
`models/sql-smell.gguf` was trained in MLX (LoRA on LFM2.5-350M) and converted to a GGUF LoRA. It's part of the "nano-fleet" experiment — one shared base + many tiny task adapters. Swap in a different `--adapter` to get a different lens (e.g. a severity-only or index-advice expert). Notes on training/conversion: nano-fleet `orchestrator/mlx_lora_to_gguf.py`.
