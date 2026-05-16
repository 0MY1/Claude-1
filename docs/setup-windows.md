# TradingView MCP Setup — Windows

This guide walks you through connecting TradingView to Claude Code on Windows.

## Prerequisites
- Claude Code installed (claude.ai/code or VS Code extension)
- Node.js 18+ installed (nodejs.org)
- TradingView account

## Step 1 — Install the TradingView MCP package

Open PowerShell or Command Prompt and run:

```powershell
npm install -g tradingview-mcp
```

## Step 2 — Add TradingView MCP to Claude Code config

Open your Claude Code settings file. On Windows it's at:

```
%APPDATA%\Claude\claude_desktop_config.json
```

Add the following to the `mcpServers` section:

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

If the file doesn't exist yet, create it with that content.

## Step 3 — Restart Claude Code

Close and reopen Claude Code completely.

## Step 4 — Verify the connection

In Claude Code, type:

```
tv_health_check
```

You should see `cdp_connected: true` in the response.

## Troubleshooting

**tv_health_check not found:**
- Make sure you restarted Claude Code after editing the config
- Check the config file path — Windows paths are case-sensitive in JSON

**Connection failed:**
- Make sure `tradingview-mcp` installed globally: `npm list -g tradingview-mcp`
- Try running `tradingview-mcp` directly in PowerShell to see any errors

**Firewall issues:**
- The MCP server uses localhost only — no inbound firewall rules needed
- If your antivirus blocks Node.js, add an exception for `node.exe`
