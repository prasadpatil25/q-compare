import { test, expect, Page } from '@playwright/test';

async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

function card(page: Page, name: string) {
  return page.locator('.panel', { hasText: name }).first();
}

test('disjunction literature benchmark runs and reproduces the published fit', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');

  const gambling = card(page, 'Two-Stage Gambling');
  await expect(gambling).toBeVisible();
  await expect(gambling.getByText('Observed take/defect rates: 0.69 / 0.59 / 0.36')).toBeVisible();

  await gambling.getByRole('button', { name: /^Run$/ }).click();

  await expect(gambling.getByText(/Quantum fit: μ = 0\.59 · γ = 2\.47 · predicted 0\.68 \/ 0\.58 \/ 0\.37/)).toBeVisible();
  await expect(gambling.getByText('best RMSD: quantum disjunction')).toBeVisible();
  await expect(gambling.getByText(/interference -0\.280/)).toBeVisible();
  await expect(gambling.getByText(/Last run/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('disjunction run details modal shows the model comparison and bootstrap CIs', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');
  const gambling = card(page, 'Two-Stage Gambling');
  await gambling.getByRole('button', { name: /^Run$/ }).click();
  await gambling.getByRole('button', { name: /Details/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Two-Stage Gambling' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Conclusion:/)).toBeVisible();
  await expect(dialog.getByText(/Quantum-Inspired \(Pothos & Busemeyer 2009\)/)).toBeVisible();
  await expect(dialog.getByText(/Markov mixture \(sure-thing constraint\)/)).toBeVisible();
  await expect(dialog.getByText(/Dephased ablation \(γ = 0, no interference\)/)).toBeVisible();
  await expect(dialog.getByText(/Sure-thing mixture prediction: 0\.640/)).toBeVisible();
  await expect(dialog.getByText(/Bootstrap 95% CIs/)).toBeVisible();
  await expect(dialog.getByText(/The dephased ablation \(γ = 0\) cannot mix/)).toBeVisible();

  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('question-order benchmark shows the QQ equality test result', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');

  const clintGore = card(page, 'Clint–Gore (consistency)');
  await clintGore.getByRole('button', { name: /^Run$/ }).click();

  await expect(clintGore.getByText(/QQ test: q = -0\.0030 · z = -0\.11 · χ²\(1\) = 0\.01/)).toBeVisible();
  await expect(clintGore.getByText('consistent with QQ equality')).toBeVisible();
  await expect(clintGore.getByText(/h = 0\.8410/)).toBeVisible();
  await expect(clintGore.getByText('BIC: quantum qq')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Rose–Jackson benchmark reproduces the QQ model failure case', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');

  const roseJackson = card(page, 'Rose–Jackson Hall of Fame (subtractive)');
  await roseJackson.getByRole('button', { name: /^Run$/ }).click();

  await expect(roseJackson.getByText(/QQ test: q = 0\.1514 · z = 5\.43/)).toBeVisible();
  await expect(roseJackson.getByText('QQ equality rejected')).toBeVisible();
  await expect(roseJackson.getByText('BIC: markov qq')).toBeVisible();

  await roseJackson.getByRole('button', { name: /Details/i }).click();
  const dialog = page.getByRole('dialog', { name: /Rose–Jackson/ });
  await expect(dialog.getByText(/Quantum Question Order \(Wang & Busemeyer 2013\)/)).toBeVisible();
  await expect(dialog.getByText(/Markov \/ classical \(unconstrained multinomial\)/)).toBeVisible();
  await expect(dialog.getByRole('cell', { name: '28.563' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Close' }).click();
  expect(errors).toEqual([]);
});

test('empirical benchmark runs persist across reload', async ({ page }) => {
  const errors = await collectConsoleErrors(page);
  await page.goto('/benchmarks');

  const gambling = card(page, 'Two-Stage Gambling');
  await gambling.getByRole('button', { name: /^Run$/ }).click();
  await expect(gambling.getByText(/Last run/)).toBeVisible();

  await page.reload();
  await expect(page.getByText('Literature benchmarks — disjunction effect')).toBeVisible();
  const after = card(page, 'Two-Stage Gambling');
  await expect(after.getByText(/Quantum fit: μ = 0\.59/)).toBeVisible();
  await expect(after.getByText(/Last run/)).toBeVisible();
  expect(errors).toEqual([]);
});