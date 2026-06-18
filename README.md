# jaringan-mcp

**MCP (Model Context Protocol) server for the Jaringan (JRG) protocol.** Lets AI agents fetch, inspect, search, and manage Jaringan pages through structured tool calls.

## Install

```bash
npm install jaringan-mcp
```

## Usage

### Standalone

```bash
npm install jaringan-mcp

# Connect to a JRG server on localhost:7080
npx jaringan-mcp --jrg-port 7080

# Read from local .jrg files instead
npx jaringan-mcp --file-root ~/wiki

# Custom host/port with browser binary
npx jaringan-mcp --jrg-host 10.0.0.1 --jrg-port 7070 --browser /usr/bin/jaringan-browser
```

### With Hermes Agent

Add to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  jaringan:
    command: "npx"
    args: ["-y", "jaringan-mcp", "--jrg-port", "7080"]
```

Or for local file access:

```yaml
mcp_servers:
  jaringan:
    command: "npx"
    args: ["-y", "jaringan-mcp", "--file-root", "/home/user/wiki"]
```

Restart Hermes to auto-discover the tools.

### With Claude Code / Copilot / Any MCP Host

```json
{
  "mcpServers": {
    "jaringan": {
      "command": "npx",
      "args": ["-y", "jaringan-mcp", "--jrg-port", "7080"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `jrg_fetch` | Fetch a JRG page → structured content (title, body, tags, links) |
| `jrg_fetch_raw` | Fetch raw JRG protocol response (status, headers, body) |
| `jrg_inspect` | Inspect a page → JSON manifest of interactive elements |
| `jrg_search` | Search local `.jrg` pages under a root directory |
| `jrg_auth_list` | List all stored Jaringan authentication tokens |
| `jrg_view` | Render a page as formatted plain text |
| `jrg_list` | List all available Jaringan pages (slug + title) |

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--jrg-host` | `localhost` | JRG TCP server hostname |
| `--jrg-port` | `7070` | JRG TCP server port |
| `--file-root` | — | Read from local `.jrg` files (instead of TCP) |
| `--browser` | `jaringan-browser` | Path to `jaringan-browser` binary |
| `--tcp-timeout` | `5000` | TCP connection timeout in ms |

## Architecture

```
AI Agent (Hermes, Claude Code, etc.)
        │
        │ MCP protocol (JSON-RPC over stdio)
        ▼
┌─────────────────────────────┐
│     jaringan-mcp server     │
│                             │
│  ┌───────────────────────┐  │
│  │  jrg-client (lib)     │──│── TCP → JRG server (port 7070/7080)
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  jaringan-browser CLI │──│── inspect / search / auth
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │  Local file reader    │──│── .jrg files on disk
│  └───────────────────────┘  │
└─────────────────────────────┘
```

## Publishing

```bash
npm run build
npm publish --access public
```

## License

MIT
