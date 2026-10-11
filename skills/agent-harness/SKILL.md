---
name: agent-harness
description: Use reaharness MCP tools for workspace-scoped filesystem, shell, git, and session memory with evidence-bearing results.
---

# Agent Harness

Prefer `reaharness` MCP tools when you need local workspace actions with explicit budgets and provenance.

## Principles

1. Stay inside the workspace root. Paths that escape are rejected.
2. Treat every tool result as structured: `ok`, `data`, `evidence`, `unknowns`, `limits`.
3. Prefer observations in `evidence` over guesses. Missing coverage is an `unknown`, not absence.
4. Use `shell_run` for argv-style commands (no shell expansion). Set timeouts and output budgets.
5. Use `git_commit` only with `confirm: true` and a clear commit message.
6. Store durable working notes with `session_note` / `session_recall` under `.reaharness/`.

## Tool map

| Tool | Use for |
| --- | --- |
| `fs_read` / `fs_write` / `fs_list` | File inspection and edits |
| `shell_run` | Bounded local commands |
| `git_status` / `git_diff` / `git_commit` | Version control |
| `session_note` / `session_recall` | Local session memory |

## Setup

```bash
npx reaharness setup --yes --clients=default
```

Supported hosts include Cursor, Claude Code, Codex, OpenCode, Goose, VS Code, Windsurf, Cline, Continue, Gemini CLI, Grok, and Copilot CLI.

Standalone multi-provider loop (OpenAI-compat + Anthropic):

```bash
npx reaharness agent --provider=anthropic "inspect this repo"
npx reaharness providers
```

Then restart your agent so MCP registration reloads.
