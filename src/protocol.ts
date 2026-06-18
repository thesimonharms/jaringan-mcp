/**
 * MCP (Model Context Protocol) types for JSON-RPC over stdio.
 *
 * Implements the subset of MCP used by Hermes, Claude Code, Copilot, etc.
 */

/** A JSON-RPC message sent over stdio (one per line, JSON). */
export interface RpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** MCP tool definition — describes a tool to the host. */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Initialize request from client. */
export interface InitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: { name: string; version: string };
}

/** The tool list the server advertises. */
export const TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: 'jrg_fetch',
    description: 'Fetch a Jaringan (JRG) page and return structured content (title, body, tags, links). Uses TCP to a JRG server by default, or a local file root. URL can be jrg://host:port/path or just a path like "welcome" or "/port-map".',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Page URL or path (e.g. "jrg://localhost:7080/welcome", "welcome", "/port-map")',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'jrg_fetch_raw',
    description: 'Fetch a JRG page and return the raw protocol response (status line, headers, body).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Page URL or path',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'jrg_inspect',
    description: 'Inspect a JRG page and return a JSON manifest of interactive elements (headings, links, paragraphs, inputs, buttons).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The jrg:// URL to inspect',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'jrg_search',
    description: 'Search local .jrg pages under a root directory. Returns matching page paths with snippets.',
    inputSchema: {
      type: 'object',
      properties: {
        root: {
          type: 'string',
          description: 'Root directory to search (e.g. /home/user/wiki)',
        },
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['root', 'query'],
    },
  },
  {
    name: 'jrg_auth_list',
    description: 'List all stored Jaringan authentication tokens.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'jrg_view',
    description: 'Render a JRG page as formatted plain text (human-readable).',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The jrg:// URL or file path to view',
        },
      },
      required: ['url'],
    },
  },
];
