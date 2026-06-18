#!/usr/bin/env node

/**
 * jaringan-mcp — MCP server for Jaringan (JRG) protocol.
 *
 * Implements the Model Context Protocol over stdio.
 * Provides tools for AI agents to fetch, inspect, search, and manage
 * Jaringan pages via the JRG protocol or local filesystem.
 *
 * Usage:
 *   jaringan-mcp                           # Defaults: localhost:7070 TCP
 *   jaringan-mcp --jrg-host 10.0.0.1       # Custom host
 *   jaringan-mcp --file-root ~/wiki         # Read from local .jrg files
 *   jaringan-mcp --browser /usr/bin/jaringan-browser
 */

import { createInterface } from 'node:readline';
import { TOOL_DEFINITIONS, type RpcMessage } from './protocol.js';
import {
  handleJrgFetch,
  handleJrgFetchRaw,
  handleJrgInspect,
  handleJrgSearch,
  handleJrgAuthList,
  handleJrgView,
  type McpConfig,
} from './handlers.js';

// ── CLI Argument Parsing ──────────────────────────────────────────────

function parseArgs(): McpConfig {
  const args = process.argv.slice(2);
  const config: McpConfig = {
    jrgHost: 'localhost',
    jrgPort: 7070,
    browserPath: 'jaringan-browser',
    tcpTimeout: 5000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--jrg-host':
        config.jrgHost = args[++i];
        break;
      case '--jrg-port':
        config.jrgPort = Number(args[++i]);
        break;
      case '--file-root':
        config.fileRoot = args[++i];
        break;
      case '--browser':
        config.browserPath = args[++i];
        break;
      case '--tcp-timeout':
        config.tcpTimeout = Number(args[++i]);
        break;
      case '--help':
      case '-h':
        console.error(`jaringan-mcp — MCP server for Jaringan JRG protocol

Usage:
  jaringan-mcp [options]

Options:
  --jrg-host <host>      JRG TCP host (default: localhost)
  --jrg-port <port>      JRG TCP port (default: 7070)
  --file-root <path>     Read from local .jrg files instead of TCP
  --browser <path>       Path to jaringan-browser binary (default: jaringan-browser)
  --tcp-timeout <ms>     TCP connection timeout (default: 5000)
  --help, -h             Show this help

Tools provided:
${TOOL_DEFINITIONS.map(t => `  ${t.name} — ${t.description}`).join('\n')}
`);
        process.exit(0);
    }
  }

  return config;
}

// ── Tool Dispatch ─────────────────────────────────────────────────────

type ToolHandler = (config: McpConfig, args: Record<string, unknown>) => Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  jrg_fetch: handleJrgFetch,
  jrg_fetch_raw: handleJrgFetchRaw,
  jrg_inspect: handleJrgInspect,
  jrg_search: handleJrgSearch,
  jrg_auth_list: handleJrgAuthList,
  jrg_view: handleJrgView,
};

// ── Response Helpers ──────────────────────────────────────────────────

function rpcResult(id: string | number | null, result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n';
}

function rpcError(id: string | number | null, code: number, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n';
}

function rpcLog(level: string, message: string): string {
  return JSON.stringify({ jsonrpc: '2.0', method: 'log', params: { level, message } }) + '\n';
}

// ── Main MCP Server Loop ──────────────────────────────────────────────

async function main() {
  const config = parseArgs();

  // Log startup info to stderr (so it's not mixed with stdio JSON)
  const transports = config.fileRoot
    ? `file:${config.fileRoot}`
    : `tcp://${config.jrgHost}:${config.jrgPort}`;
  console.error(`[jaringan-mcp] started — transport: ${transports}`);

  const rl = createInterface({ input: process.stdin });

  for await (const line of rl) {
    if (!line.trim()) continue;

    let msg: RpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stderr.write(rpcLog('error', `Invalid JSON: ${line.slice(0, 100)}`));
      continue;
    }

    const msgId = msg.id ?? null;

    // ── Handshake ──────────────────────────────────────────────────
    if (msg.method === 'initialize') {
      const params = msg.params as any;
      const clientName = params?.clientInfo?.name ?? 'unknown';
      console.error(`[jaringan-mcp] client connected: ${clientName} v${params?.clientInfo?.version ?? '?'}`);

      process.stdout.write(rpcResult(msgId, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          logging: {},
        },
        serverInfo: {
          name: 'jaringan-mcp',
          version: '0.1.0',
        },
      }));
      continue;
    }

    // ── Initialized notification ──────────────────────────────────
    if (msg.method === 'notifications/initialized') {
      console.error('[jaringan-mcp] initialized');
      continue;
    }

    // ── Tool list ──────────────────────────────────────────────────
    if (msg.method === 'tools/list') {
      process.stdout.write(rpcResult(msgId, { tools: TOOL_DEFINITIONS }));
      continue;
    }

    // ── Tool call ──────────────────────────────────────────────────
    if (msg.method === 'tools/call') {
      const params = msg.params as any;
      const toolName: string = params?.name ?? '';
      const toolArgs: Record<string, unknown> = (params?.arguments as any) ?? {};

      const handler = TOOL_HANDLERS[toolName];
      if (!handler) {
        process.stdout.write(rpcError(msgId, -32601, `Unknown tool: ${toolName}`));
        continue;
      }

      try {
        const result = await handler(config, toolArgs);
        process.stdout.write(rpcResult(msgId, result));
      } catch (err: any) {
        process.stdout.write(rpcError(msgId, -32603, err.message ?? 'Internal error'));
      }
      continue;
    }

    // ── Ping / Unknown ─────────────────────────────────────────────
    if (msg.method === 'ping') {
      process.stdout.write(rpcResult(msgId, {}));
      continue;
    }

    // Unknown method — log and ignore
    console.error(`[jaringan-mcp] unhandled method: ${msg.method}`);
  }
}

main().catch((err) => {
  console.error(`[jaringan-mcp] fatal: ${err.message}`);
  process.exit(1);
});
