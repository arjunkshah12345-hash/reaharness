# Repository guidelines

reaharness is a local agent harness: MCP tools, CLI, multi-provider LLM loop.

## Architecture

Layers (inward):

- `domain` / `contracts`
- `tools` / `process`
- `application` / `composition`
- `providers` / `agent`
- `setup` / `mcp` / `cli`

Rules:

- Tool results preserve `evidence`, `unknowns`, and `limits`.
- Path admission before filesystem or cwd use.
- Providers speak OpenAI-compat or Anthropic Messages only — no SDK lock-in.
- Setup is plan → approve → backup → write.

## Commands

- `npm run check`
- `node bin/reaharness.mjs providers`
- `node bin/reaharness.mjs setup --clients=default`
- `node bin/reaharness.mjs agent "…"` (needs provider API key)

## Do not

- Add reverse-engineering or exploit tooling.
- Bypass workspace path admission.
- Commit secrets or `.reaharness/` session files.
