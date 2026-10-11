# reaharness

A clean open-source **agent harness**: typed tools, MCP + CLI, multi-provider LLM loop, and idempotent setup for many agent hosts.

Inspired by patterns from [REA](https://github.com/morluto/rea), [OpenCode](https://opencode.ai/), [Goose](https://github.com/block/goose), and the [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) — without copying their code. Greenfield MIT. Not a reverse-engineering tool.

## Quick start

```bash
npm install
npm run build
node bin/reaharness.mjs doctor
node bin/reaharness.mjs setup --yes --clients=default
```

### Use as MCP tools (Cursor / Claude / OpenCode / …)

```bash
node bin/reaharness.mjs mcp
```

### Use as a standalone agent (any provider)

```bash
export ANTHROPIC_API_KEY=...
node bin/reaharness.mjs agent "List the top-level files and summarize the repo"

export OPENAI_API_KEY=...
node bin/reaharness.mjs agent --provider=openai --model=gpt-4.1 "Run doctor via tools"

# OpenAI-compatible gateways (OpenRouter, Groq, Ollama, Gemini compat, …)
node bin/reaharness.mjs agent --provider=openrouter --model=anthropic/claude-sonnet-4 "..."
node bin/reaharness.mjs agent --provider=ollama --model=llama3.2 "..."
```

## Providers

| Kind | Protocol | Default env key |
| --- | --- | --- |
| `openai` | OpenAI Chat Completions | `OPENAI_API_KEY` |
| `anthropic` | Anthropic Messages | `ANTHROPIC_API_KEY` |
| `openrouter` | OpenAI-compat | `OPENROUTER_API_KEY` |
| `groq` | OpenAI-compat | `GROQ_API_KEY` |
| `ollama` | OpenAI-compat | optional |
| `together` | OpenAI-compat | `TOGETHER_API_KEY` |
| `deepseek` | OpenAI-compat | `DEEPSEEK_API_KEY` |
| `fireworks` | OpenAI-compat | `FIREWORKS_API_KEY` |
| `gemini` | OpenAI-compat | `GOOGLE_API_KEY` |
| `xai` | OpenAI-compat | `XAI_API_KEY` |
| `openai_compat` | OpenAI-compat | `OPENAI_API_KEY` + `--base-url` |

```bash
node bin/reaharness.mjs providers
node bin/reaharness.mjs catalog --format=openai
node bin/reaharness.mjs catalog --format=anthropic
```

Overrides: `REAHARNESS_PROVIDER`, `REAHARNESS_MODEL`, `REAHARNESS_BASE_URL`, `REAHARNESS_API_KEY`.

## MCP hosts

`setup` registers stdio MCP for:

`cursor`, `claude`, `claude_desktop`, `codex`, `windsurf`, `vscode`, `cline`, `continue`, `gemini`, `opencode`, `goose`, `grok`, `copilot`

```bash
node bin/reaharness.mjs setup                 # plan only
node bin/reaharness.mjs setup --yes --clients=default
node bin/reaharness.mjs setup --yes --clients=all
node bin/reaharness.mjs setup --yes --clients=cursor,opencode,goose
```

## Tools

Every tool returns `{ ok, data, evidence, unknowns, limits }`.

| Tool | Purpose |
| --- | --- |
| `fs_read` / `fs_write` / `fs_list` | Workspace-rooted filesystem |
| `shell_run` | Owned process, no shell, budgets |
| `git_status` / `git_diff` / `git_commit` | Git (`confirm: true` to commit) |
| `session_note` / `session_recall` | Local JSONL memory (`.reaharness/`) |

## Architecture

```
cli / mcp  →  agent  →  providers
                ↓
           application  →  tools / process
                ↓
           contracts / domain
```

`npm run lint` enforces layer boundaries.

## Library API

```ts
import {
  runAgent,
  createProvider,
  resolveProviderConfig,
  toOpenAiTools,
} from "reaharness";
```

## Website

Marketing site (dark + light, interactive anatomy figures): [reaharness.vercel.app](https://reaharness.vercel.app)

```bash
npm run figures   # rebuild evidence-probe + tool-router (needs anatomy skill kit)
npm run site      # serve ./website on :4177
```

## Development

```bash
npm ci
npm run check
```

Node.js 22+.

## Non-goals

- Reverse-engineering / binary analysis engines
- Cloud-hosted multi-tenant runtime
- Multi-agent swarm orchestration (single clean loop first)

## License

MIT
