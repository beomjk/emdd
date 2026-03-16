import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Wrap a result value as MCP text content */
export function jsonResult(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap an error message as MCP error content */
export function errorResult(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

/** Execute an async operation, catching errors and returning MCP error content */
export async function withErrorHandling(
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (err) {
    return errorResult((err as Error).message);
  }
}
