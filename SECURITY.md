# Security

## Reporting

Open a private GitHub security advisory on this repository, or email the maintainer listed on the GitHub profile. Do not file public issues for vulnerabilities that could put users at risk.

## Scope

reaharness runs local tools (filesystem, shell, git) inside a workspace root. Treat the host agent as trusted for choosing when to call tools. Path admission and process budgets reduce accidents; they are not a multi-tenant sandbox.

## Hardening notes

- Paths must resolve inside the workspace root.
- `shell_run` does not invoke a shell and enforces timeouts/output budgets.
- `git_commit` requires an explicit `confirm: true`.
- Setup writes are additive, show a plan first, and backup existing files when updating.
