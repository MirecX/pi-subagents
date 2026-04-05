# Minimal Subagents

A pi extension that registers a single `subagent` tool with three agents:

| Agent | Tools | Model | Purpose |
|-------|-------|-------|---------|
| **scout** | read, grep, find, ls | claude-haiku-4-5 | Fast codebase recon |
| **researcher** | web_search, web_fetch | claude-sonnet-4-6 | Web research |
| **worker** | read, write, edit, safe_bash | claude-sonnet-4-6 | Code changes |

## Usage

**Single mode:**
```json
{ "agent": "scout", "task": "Find all auth-related files in src/" }
```

**Parallel mode:**
```json
{ "tasks": [
  { "agent": "scout", "task": "Map the database layer" },
  { "agent": "researcher", "task": "Best practices for connection pooling" }
]}
```

Max 4 concurrent subagents (configurable). Each runs as an isolated `pi` process with no inherited context — all context must be in the task description.

## Config

Optional `config.json` next to `index.ts`:

```json
{ "maxConcurrency": 4 }
```

## UI

Default view shows medium detail (agent status, task preview, recent tools). Expand to see full task, all tool calls, complete output, and token usage.

## Structure

```
subagents/
├── index.ts           # Extension entry point
├── agents/            # Agent configs (frontmatter + system prompt)
└── tools/             # Extensions loaded into subagent processes
    ├── web-tools.ts   # web_search & web_fetch (wraps skill scripts)
    └── safe-bash.ts   # bash with dangerous command blocking
```
