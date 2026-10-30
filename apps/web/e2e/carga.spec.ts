import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('la aplicación carga y muestra el nombre del negocio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toHaveText('ZAMMIR');
  await expect(page).toHaveTitle('ZAMMIR');
});

test('no tiene violaciones graves de accesibilidad', async ({ page }) => {
  await page.goto('/');
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(graves).toEqual([]);
});
