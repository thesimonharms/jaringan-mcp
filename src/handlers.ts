import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { JrgClient } from 'jrg-client';

export interface McpConfig {
  /** JRG TCP host (optional, default: localhost) */
  jrgHost?: string;
  /** JRG TCP port (optional, default: 7070) */
  jrgPort?: number;
  /** Local file root for file-based transport (optional) */
  fileRoot?: string;
  /** Path to jaringan-browser binary */
  browserPath?: string;
  /** TCP timeout in ms */
  tcpTimeout?: number;
}

/** Result format for MCP tool response. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

/**
 * Get a JRG client based on the configured transport.
 */
function getClient(config: McpConfig, specificRoot?: string): JrgClient {
  if (specificRoot && existsSync(specificRoot)) {
    return new JrgClient({
      transport: { type: 'file', root: specificRoot },
    });
  }
  if (config.fileRoot && existsSync(config.fileRoot)) {
    return new JrgClient({
      transport: { type: 'file', root: config.fileRoot },
    });
  }
  // Default: TCP
  return new JrgClient({
    transport: {
      type: 'tcp',
      host: config.jrgHost ?? 'localhost',
      port: config.jrgPort ?? 7070,
      timeout: config.tcpTimeout ?? 5000,
    },
  });
}

/**
 * Run a jaringan-browser command and return stdout.
 */
function runBrowser(config: McpConfig, args: string[]): string {
  const browser = config.browserPath ?? 'jaringan-browser';
  try {
    return execSync([browser, ...args].join(' '), {
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 1024 * 1024, // 1MB
    }).trim();
  } catch (err: any) {
    const msg = err.stderr?.trim() || err.stdout?.trim() || err.message;
    throw new Error(`jaringan-browser failed: ${msg}`);
  }
}

// ── Tool Handlers ────────────────────────────────────────────────────

export async function handleJrgFetch(config: McpConfig, args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url ?? '');
  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  try {
    const client = getClient(config);
    const page = await client.fetchPage(url);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          title: page.title,
          tags: page.tags,
          links: page.links,
          body: page.body,
        }, null, 2),
      }],
    };
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
}

export async function handleJrgFetchRaw(config: McpConfig, args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url ?? '');
  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  try {
    const client = getClient(config);

    // For raw, try to use jaringan-browser raw if available
    try {
      const raw = runBrowser(config, ['raw', url]);
      return { content: [{ type: 'text', text: raw }] };
    } catch {
      // Fall back to jrg-client
      const response = await client.fetchResponse(url);
      const raw = `JRG/${response.version} ${response.status} ${response.statusText}\n${
        Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\n')
      }\n\n${response.body}`;
      return { content: [{ type: 'text', text: raw }] };
    }
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
}

export async function handleJrgInspect(config: McpConfig, args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url ?? '');
  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  try {
    const json = runBrowser(config, ['inspect', url]);
    return { content: [{ type: 'text', text: json }] };
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
}

export async function handleJrgSearch(config: McpConfig, args: Record<string, unknown>): Promise<ToolResult> {
  const root = String(args.root ?? '');
  const query = String(args.query ?? '');

  if (!root) {
    return { content: [{ type: 'text', text: 'Error: root is required' }], isError: true };
  }
  if (!query) {
    return { content: [{ type: 'text', text: 'Error: query is required' }], isError: true };
  }

  try {
    const output = runBrowser(config, ['search', root, query]);
    return { content: [{ type: 'text', text: output }] };
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
}

export async function handleJrgAuthList(config: McpConfig, _args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const output = runBrowser(config, ['auth', 'list']);
    return { content: [{ type: 'text', text: output }] };
  } catch (err: any) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
}

export async function handleJrgView(config: McpConfig, args: Record<string, unknown>): Promise<ToolResult> {
  const url = String(args.url ?? '');
  if (!url) {
    return { content: [{ type: 'text', text: 'Error: url is required' }], isError: true };
  }

  try {
    const output = runBrowser(config, ['view', url]);
    return { content: [{ type: 'text', text: output }] };
  } catch (err: any) {
    // Fallback: use jrg-client and format the page
    try {
      const client = getClient(config);
      const page = await client.fetchPage(url);
      const text = `# ${page.title}\n\n${page.body}`;
      return { content: [{ type: 'text', text }] };
    } catch (err2: any) {
      return { content: [{ type: 'text', text: `Error: ${err2.message}` }], isError: true };
    }
  }
}
