import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('la aplicación carga y muestra el nombre del negocio y el panel de inicio', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('ZAMMIR');
  await expect(page.getByRole('link', { name: 'ZAMMIR, ir al panel de inicio' })).toHaveText(
    'ZAMMIR',
  );
  await expect(page.getByRole('heading', { name: 'Panel de inicio' })).toBeVisible();
});

test('se puede navegar entre secciones con el menú', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Secciones del trabajo' });
  await menu.getByRole('link', { name: /Cotizador/ }).click();
  await expect(page).toHaveURL(/\/cotizador$/);
  await expect(page.getByRole('heading', { name: 'Cotizador' })).toBeVisible();
});

test('abrir directo una sección funciona al recargar', async ({ page }) => {
  await page.goto('/cotizador');
  await expect(page.getByRole('heading', { name: 'Cotizador' })).toBeVisible();
});

test('una sección de administradores pide entrar y no muestra su contenido', async ({ page }) => {
  await page.goto('/reportes');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reportes' })).toHaveCount(0);
  await expect(page.getByLabel('Correo')).toBeVisible();
  await expect(page.getByLabel('Contraseña')).toBeVisible();
});

test('no tiene violaciones graves de accesibilidad', async ({ page }) => {
  await page.goto('/');
  const resultado = await new AxeBuilder({ page }).analyze();
  const graves = resultado.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(graves).toEqual([]);
});
