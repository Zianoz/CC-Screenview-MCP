# CC-Screenview-MCP

An MCP server for Claude Code that lets Claude capture and analyze a screenshot of your primary monitor — on demand or when you ask it to look at the screen.

---

## How it works

The server exposes a single MCP tool: **`take_screenshot`**.

Claude calls it automatically when it detects phrases like:
- "check the screen" / "look at my screen" / "take a screenshot"
- "what do you see" / "show me the screen" / "verify visually"
- After completing a UI or browser task to verify the result visually

The screenshot is returned as a PNG image directly to Claude, which then describes and analyzes what it sees.

---

## Prerequisites

### Node.js

Node.js **18 or later** is required on both platforms.
Download: https://nodejs.org

### Linux — screenshot backend

`screenshot-desktop` needs one of the following installed:

```bash
# Option 1 — scrot (recommended, lightweight)
sudo apt install scrot

# Option 2 — ImageMagick
sudo apt install imagemagick
```

> **Wayland users:** `scrot` works on X11/XWayland. If you're on a pure Wayland session, use `gnome-screenshot`:
> ```bash
> sudo apt install gnome-screenshot
> ```

### Windows

No extra dependencies needed. `screenshot-desktop` uses a bundled native binary on Windows.

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/Zianoz/CC-Screenview-MCP.git
cd CC-Screenview-MCP
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build

```bash
npm run build
```

This compiles TypeScript to `dist/index.js`.

---

## Add to Claude Code

Open (or create) your Claude Code settings file and add the `screenview` MCP server.

**Settings file locations:**

| Scope | Path |
|---|---|
| Per-project | `<your-project>/.claude/settings.json` |
| Global (all projects) | `~/.claude/settings.json` (Linux/macOS) or `%APPDATA%\Claude\settings.json` (Windows) |

**Linux / macOS:**

```json
{
  "mcpServers": {
    "screenview": {
      "command": "node",
      "args": ["/absolute/path/to/CC-Screenview-MCP/dist/index.js"]
    }
  }
}
```

**Windows:**

```json
{
  "mcpServers": {
    "screenview": {
      "command": "node",
      "args": ["C:\\path\\to\\CC-Screenview-MCP\\dist\\index.js"]
    }
  }
}
```

> Replace the path with the actual location where you cloned the repo.

After saving, restart Claude Code (or run `/mcp` to reload servers).

---

## Usage

Once installed, just talk to Claude naturally:

```
You: check the screen
Claude: [captures screenshot and describes what it sees]

You: does my UI look right?
Claude: [takes a screenshot and reviews it]

You: take a screenshot
Claude: [captures and shows you what it sees]
```

You can also prompt Claude explicitly:

```
You: use take_screenshot to see what's on my screen
```

---

## Troubleshooting

### Linux: "Could not take screenshot"

Ensure a screenshot backend is installed:

```bash
which scrot || which import || which gnome-screenshot
# install whichever is missing, e.g.:
sudo apt install scrot
```

### Windows: screenshot is blank or fails

- Make sure Node.js 18+ is installed and `node` is in your PATH.
- Run `node dist/index.js` directly in a terminal to see raw error output.

### MCP server not showing up in Claude Code

- Verify the path in `settings.json` is absolute and the file exists.
- Run `node /path/to/dist/index.js` manually to confirm no startup errors.
- In Claude Code, run `/mcp` to see the status of all MCP servers.

---

## Development

```bash
# Watch mode — recompiles on file changes
npm run dev

# Run the built server directly
npm start
```

---

## License

MIT
