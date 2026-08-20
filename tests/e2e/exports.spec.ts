import { test, expect } from '@playwright/test';

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}


test('report exports download real content', async ({ page }) => {
  await page.goto('/reports');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /markdown/i }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const c of stream) chunks.push(c as Uint8Array);
  const content = new TextDecoder().decode(concatBytes(chunks));
  expect(content).toContain('# ');
  expect(content).toContain('Quantum-Inspired');
  expect(content).toContain('mathematical simulation');
  expect(content).toContain('QAI');
});

test('json export contains the experiment payload', async ({ page }) => {
  await page.goto('/reports');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /json/i }).first().click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Uint8Array[] = [];
  for await (const c of stream) chunks.push(c as Uint8Array);
  const data = JSON.parse(new TextDecoder().decode(concatBytes(chunks)));
  expect(data.experiment.name).toBeTruthy();
  expect(data.experiment.results.qai.value).toBeGreaterThanOrEqual(0);
  expect(data.experiment.reproducibility).toBeDefined();
  expect(data.generatedAt).toBeTruthy();
});
