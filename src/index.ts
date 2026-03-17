import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink } from "fs/promises";

const execFileAsync = promisify(execFile);

// ── Windows: PowerShell + System.Windows.Forms (no external deps) ──────────

async function captureWindows(): Promise<Buffer> {
  const tmpFile = join(tmpdir(), `cc_screenshot_${Date.now()}.png`);

  // Use a PowerShell script to capture the primary screen
  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$screen  = [System.Windows.Forms.Screen]::PrimaryScreen
$bounds  = $screen.Bounds
$bitmap  = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$gfx     = [System.Drawing.Graphics]::FromImage($bitmap)
$gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${tmpFile.replace(/\\/g, "\\\\")}')
$gfx.Dispose()
$bitmap.Dispose()
`.trim();

  // Encode as UTF-16LE base64 to avoid quoting/escaping issues
  const encoded = Buffer.from(script, "utf16le").toString("base64");

  await execFileAsync("powershell", [
    "-NonInteractive",
    "-EncodedCommand",
    encoded,
  ]);

  const buffer = await readFile(tmpFile);
  await unlink(tmpFile).catch(() => {});
  return buffer;
}

// ── Linux: try scrot → import (ImageMagick) → gnome-screenshot ────────────

async function captureLinux(): Promise<Buffer> {
  const tmpFile = join(tmpdir(), `cc_screenshot_${Date.now()}.png`);
  const errors: string[] = [];

  const backends: Array<{ cmd: string; args: string[] }> = [
    { cmd: "scrot", args: [tmpFile] },
    { cmd: "import", args: ["-window", "root", tmpFile] },
    { cmd: "gnome-screenshot", args: ["-f", tmpFile] },
  ];

  for (const { cmd, args } of backends) {
    try {
      await execFileAsync(cmd, args);
      const buffer = await readFile(tmpFile);
      await unlink(tmpFile).catch(() => {});
      return buffer;
    } catch (e) {
      errors.push(`  ${cmd}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(
    `No screenshot backend found. Tried:\n${errors.join("\n")}\n\n` +
      `Install one with:\n  sudo apt install scrot\n  # or: sudo apt install imagemagick`
  );
}

// ── Dispatcher ─────────────────────────────────────────────────────────────

async function captureScreen(): Promise<Buffer> {
  if (process.platform === "win32") {
    return captureWindows();
  }
  return captureLinux();
}

// ── MCP Server ─────────────────────────────────────────────────────────────

const server = new Server(
  { name: "cc-screenview-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

const TOOL_DESCRIPTION = `
Captures a screenshot of the primary monitor and returns it as a PNG image for visual analysis.

WHEN TO CALL THIS TOOL — call it automatically when the user says anything like:
  - "check the screen" / "look at my screen" / "what's on screen"
  - "take a screenshot" / "show me the screen" / "screenshot"
  - "what do you see" / "can you see my screen" / "show me what you see"
  - "verify visually" / "check the result" / "does it look right"
  - After completing a UI, visual, or browser task when visual verification is useful

The returned image can be read and analyzed directly — describe what you see.
`.trim();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "take_screenshot",
      description: TOOL_DESCRIPTION,
      inputSchema: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            description: "Optional: brief reason for taking the screenshot",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "take_screenshot") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  try {
    const imgBuffer = await captureScreen();
    const base64 = imgBuffer.toString("base64");

    return {
      content: [
        {
          type: "image",
          data: base64,
          mimeType: "image/png",
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Screenshot failed:\n\n${message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
