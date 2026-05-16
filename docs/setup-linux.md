# TradingView MCP Setup — Linux

This guide walks you through connecting TradingView to Claude Code on Linux.

## Prerequisites
- Claude Code installed (claude.ai/code or VS Code extension)
- Node.js 18+ installed
- TradingView account

## Step 1 — Install the TradingView MCP package

```bash
npm install -g tradingview-mcp
```

## Step 2 — Add TradingView MCP to Claude Code config

Open your Claude Code settings file:

```bash
nano ~/.config/Claude/claude_desktop_config.json
```

Add the following:

```json
{
  "mcpServers": {
    "tradingview": {
      "command": "tradingview-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

Find the full path to tradingview-mcp first:

```bash
which tradingview-mcp
```

Use the full path in the config if needed (e.g. `/usr/local/bin/tradingview-mcp`).

## Step 3 — Restart Claude Code

```bash
pkill -f "claude" && claude  # or restart your IDE
```

## Step 4 — Verify the connection

In Claude Code, type:

```
tv_health_check
```

You should see `cdp_connected: true`.

## Troubleshooting

**Permission denied running tradingview-mcp:**
```bash
chmod +x $(which tradingview-mcp)
```

**Module not found:**
```bash
npm install -g tradingview-mcp --force
node -e "require('tradingview-mcp')"
```

**Config file not found:**
The config location varies by distribution. Try:
- `~/.config/Claude/claude_desktop_config.json`
- `~/.claude/claude_desktop_config.json`

Check Claude Code's logs for the exact path it's using.
