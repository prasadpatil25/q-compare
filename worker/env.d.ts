/**
 * Minimal ambient types so the Worker file type-checks standalone.
 * When deployed, `wrangler` provides the real Cloudflare Workers types.
 */
declare const crypto: { randomUUID(): string };

interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all(): Promise<{ results: unknown[] }>;
  first(): Promise<Record<string, unknown> | null>;
  run(): Promise<unknown>;
}

declare interface Request {
  method: string;
  url: string;
  json(): Promise<unknown>;
}
declare interface Response {
  status: number;
}
declare const Request: {
  new (url: string, init?: { method?: string }): Request;
};
declare const Response: {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): Response;
};
declare const URL: {
  new (url: string, base?: string): {
    pathname: string;
  };
};
declare const Headers: {
  new (init?: Record<string, string>): unknown;
};