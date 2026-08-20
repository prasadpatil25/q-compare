/**
 * Q-Compare Worker API — optional server-side persistence on Cloudflare D1.
 *
 * The v1 frontend is fully functional without this Worker (localStorage mode).
 * This API mirrors the storage actions so experiments/datasets/reports can be
 * persisted server-side when deployed. Model calculations always run in the
 * browser — this Worker never performs probability or QAI math.
 *
 * Endpoints:
 *   GET    /api/experiments          list experiments
 *   POST   /api/experiments          create/update experiment
 *   GET    /api/experiments/:id      fetch one experiment
 *   DELETE /api/experiments/:id      delete experiment
 *   POST   /api/datasets             upsert dataset
 *   GET    /api/datasets             list datasets
 *   DELETE /api/datasets/:id         delete dataset
 *   GET    /api/benchmarks/runs      list benchmark runs
 *   GET    /api/insights             summary statistics across experiments
 *   POST   /api/reports              store a generated report
 */

export interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
  });
}

function notFound(message = 'Not found'): Response {
  return json({ error: message }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' } });
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] !== 'api') return json({ error: 'Not an API route' }, 404);

    try {
      // ---- experiments ----
      if (parts[1] === 'experiments' && request.method === 'GET' && parts.length === 2) {
        const { results } = await env.DB.prepare(
          'SELECT id, status, category, qai, recommended_model, created_at, updated_at FROM experiments ORDER BY updated_at DESC',
        ).all();
        return json(results);
      }

      if (parts[1] === 'experiments' && request.method === 'POST' && parts.length === 2) {
        const payload = (await request.json()) as Record<string, unknown>;
        const id = String(payload.id ?? '');
        if (!id) return json({ error: 'experiment id is required' }, 400);
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO experiments (id, payload, status, category, qai, recommended_model, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, COALESCE(?7, ?8), ?8)
           ON CONFLICT(id) DO UPDATE SET payload = ?2, status = ?3, category = ?4, qai = ?5, recommended_model = ?6, updated_at = ?8`,
        )
          .bind(
            id,
            JSON.stringify(payload),
            String(payload.status ?? 'draft'),
            String(payload.category ?? null),
            Number(payload.qai ?? null),
            String(payload.recommendedModel ?? null),
            String(payload.createdAt ?? null),
            now,
          )
          .run();
        return json({ ok: true, id }, 201);
      }

      if (parts[1] === 'experiments' && request.method === 'GET' && parts.length === 3) {
        const row = await env.DB.prepare('SELECT payload FROM experiments WHERE id = ?1').bind(parts[2]).first();
        if (!row) return notFound('Experiment not found');
        return json(JSON.parse(String(row.payload)));
      }

      if (parts[1] === 'experiments' && request.method === 'DELETE' && parts.length === 3) {
        await env.DB.prepare('DELETE FROM experiments WHERE id = ?1').bind(parts[2]).run();
        return json({ ok: true });
      }

      // ---- datasets ----
      if (parts[1] === 'datasets' && request.method === 'GET' && parts.length === 2) {
        const { results } = await env.DB.prepare('SELECT id, name, created_at FROM datasets ORDER BY created_at DESC').all();
        return json(results);
      }

      if (parts[1] === 'datasets' && request.method === 'POST' && parts.length === 2) {
        const payload = (await request.json()) as Record<string, unknown>;
        const id = String(payload.id ?? '');
        if (!id) return json({ error: 'dataset id is required' }, 400);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO datasets (id, name, payload, created_at) VALUES (?1, ?2, ?3, ?4)',
        )
          .bind(id, String(payload.name ?? ''), JSON.stringify(payload), String(payload.createdAt ?? new Date().toISOString()))
          .run();
        return json({ ok: true, id }, 201);
      }

      if (parts[1] === 'datasets' && request.method === 'DELETE' && parts.length === 3) {
        await env.DB.prepare('DELETE FROM datasets WHERE id = ?1').bind(parts[2]).run();
        return json({ ok: true });
      }

      // ---- benchmark runs ----
      if (parts[1] === 'benchmarks' && parts[2] === 'runs' && request.method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM benchmark_runs ORDER BY ran_at DESC').all();
        return json(results);
      }

      // ---- insights ----
      if (parts[1] === 'insights' && request.method === 'GET') {
        const summary = await env.DB.prepare(
          `SELECT COUNT(*) AS total, AVG(qai) AS avg_qai,
                  recommended_model AS best FROM experiments WHERE qai IS NOT NULL GROUP BY recommended_model ORDER BY total DESC`,
        ).all();
        return json(summary.results);
      }

      // ---- reports ----
      if (parts[1] === 'reports' && request.method === 'POST') {
        const payload = (await request.json()) as Record<string, unknown>;
        const id = String(payload.id ?? crypto.randomUUID());
        await env.DB.prepare(
          'INSERT OR REPLACE INTO reports (id, experiment_id, format, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
        )
          .bind(id, String(payload.experimentId ?? ''), String(payload.format ?? 'json'), String(payload.content ?? ''), new Date().toISOString())
          .run();
        return json({ ok: true, id }, 201);
      }

      return notFound('Unknown API route');
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
    }
  },
};