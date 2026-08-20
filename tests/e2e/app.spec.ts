import { test, expect, Page } from '@playwright/test';

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('dashboard renders seeded KPIs and navigation', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  await expect(page.getByText('Total Experiments')).toBeVisible();
  await expect(page.getByText(/quantum advantage/i).first()).toBeVisible();
  await expect(page.getByText('Models Compared')).toBeVisible();
  await expect(page.getByText('Best Model').first()).toBeVisible();
  await expect(page.getByText('Job Offer — Sequential Evidence').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('all navigation sections are routable', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/');
  const sections = [
    ['New Experiment', '/experiments/new'],
    ['Experiments', '/experiments'],
    ['Datasets', '/datasets'],
    ['Benchmarks', '/benchmarks'],
    ['Insights', '/insights'],
    ['Reports', '/reports'],
    ['About', '/about'],
    ['Settings', '/settings'],
  ];
  const width = page.viewportSize()?.width ?? 1440;
  for (const [label, path] of sections) {
    if (width <= 1024) {
      await page.getByRole('button', { name: /toggle navigation/i }).click();
      await expect(page.locator('.sidebar.open')).toBeVisible();
    }
    await page.getByRole('link', { name: new RegExp(label, 'i') }).first().click();
    if (width <= 1024) {
      await page.getByRole('button', { name: /toggle navigation/i }).click();
    }
    await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/') + '$'));
    await expect(page.locator('main')).toBeVisible();
    await page.goto('/');
  }
  expect(errors).toEqual([]);
});

test('experiment detail shows full results', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/');
  await page.locator('table.data tbody tr', { hasText: 'Travel Choice — Order Effect' }).click();
  await expect(page).toHaveURL(/\/experiments\/exp_/);
  await expect(page.getByText(/Research Question/i)).toBeVisible();
  await expect(page.getByText(/Quantum Advantage Indicator/i).first()).toBeVisible();
  await expect(page.getByText('Classical').first()).toBeVisible();
  await expect(page.getByText('Bayesian').first()).toBeVisible();
  await expect(page.getByText('Quantum-Inspired').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('create experiment end-to-end through the wizard', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/experiments/new');
  await page.getByLabel(/Experiment name/i).fill('E2E Test Experiment');
  await page.getByLabel(/Research question/i).fill('Which choice is best?');
  await page.getByLabel(/Decision question/i).fill('Pick one option');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /add evidence/i }).click();
  await page.getByLabel('Name *').fill('Signal A');
  await page.getByLabel('Value *').fill('Present');
  await page.getByRole('dialog', { name: 'Add Evidence' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Signal A')).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Classical Configuration')).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByRole('button', { name: /run models/i }).first()).toBeVisible();
  await page.locator('.wizard-actions').getByRole('button', { name: /run models/i }).click();
  await expect(page.getByText(/Quantum Advantage Indicator/i).first()).toBeVisible();
  await page.getByRole('button', { name: /open experiment detail/i }).click();
  await expect(page).toHaveURL(/\/experiments\/exp_/);
  expect(errors).toEqual([]);
});

test('experiments list allows search and filter', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/experiments');
  await expect(page.getByText('Job Offer — Sequential Evidence').first()).toBeVisible();
  await page.getByPlaceholder(/search/i).fill('Travel');
  await expect(page.getByText('Travel Choice — Order Effect')).toBeVisible();
  await expect(page.getByText('Job Offer — Sequential Evidence')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('benchmarks page runs a benchmark', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');
  const panel = page.locator('.panel', { hasText: 'Order Effects Benchmark' }).first();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /^Run$/ }).click();
  await expect(panel.getByText(/QAI \d+\.\d+/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('reports page generates a report', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/reports');
  await expect(page.getByText('Job Offer — Sequential Evidence').first()).toBeVisible();
  await expect(page.getByText('Report Preview')).toBeVisible();
  await expect(page.getByText(/Report sections:/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('about and settings render', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/about');
  await expect(page.getByText(/Q-Compare/i).first()).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByText(/Quantum Advantage Indicator — Weights/i)).toBeVisible();
  expect(errors).toEqual([]);
});