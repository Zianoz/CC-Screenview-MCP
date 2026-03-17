import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "module";

// screenshot-desktop is CommonJS — use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const screenshotDesktop: (opts: { format: string }) => Promise<Buffer> =
  require("screenshot-desktop");

const server = new Server(
  { name: "cc-screenview-mcp", version: "1.0.0" },
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
    const imgBuffer = await screenshotDesktop({ format: "png" });
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

    const hint =
      process.platform === "linux"
        ? "\n\nOn Linux, ensure a screenshot backend is installed:\n  sudo apt install scrot\n  # or: sudo apt install imagemagick"
        : "";

    return {
      content: [
        {
          type: "text",
          text: `Failed to capture screenshot: ${message}${hint}`,
        },
      ],
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
