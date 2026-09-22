import { test, expect } from '@playwright/test';

test('dirty forms preserve input on rejected Back, Forward and Escape without adding history entries', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await page.getByLabel('Email', { exact: true }).fill('dirty-navigation@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.getByLabel('Company name', { exact: true }).fill('Navigation Transport');
  await page.getByLabel('Number prefix', { exact: true }).fill('NV/');
  await page.getByRole('button', { name: 'Create company & continue' }).click();
  await page.waitForURL(/\/biltys$/);
  await page.getByRole('link', { name: 'New bilty', exact: false }).click();
  const field = page.getByLabel('Consignor name', { exact: true });
  await field.fill('Unsaved sender');
  const length = await page.evaluate(() => history.length);
  const backPrompt = page.waitForEvent('dialog', { timeout: 5000 });
  await page.evaluate(() => history.back());
  await (await backPrompt).dismiss();
  await expect(page).toHaveURL(/\/biltys\/new$/);
  await expect(field).toHaveValue('Unsaved sender');
  await expect.poll(() => page.evaluate(() => history.length)).toBe(length);
  page.once('dialog', (dialog) => dialog.accept());
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/biltys$/);
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/biltys\/new$/);
  await expect(field).toBeVisible();
  // Create a real forward destination without rewriting or extending history.
  await page.getByRole('link', { name: 'Address book', exact: false }).click();
  await expect(page).toHaveURL(/\/parties$/);
  await expect(page.getByRole('heading', { name: 'Address book', exact: true })).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/biltys\/new$/);
  await field.fill('Keep on forward');
  const forwardLength = await page.evaluate(() => history.length);
  const forwardPrompt = page.waitForEvent('dialog', { timeout: 5000 });
  await page.evaluate(() => history.forward());
  await (await forwardPrompt).dismiss();
  await expect(page).toHaveURL(/\/biltys\/new$/);
  await expect(field).toHaveValue('Keep on forward');
  await expect.poll(() => page.evaluate(() => history.length)).toBe(forwardLength);
  page.once('dialog', (dialog) => dialog.accept());
  await page.goForward();
  await expect(page).toHaveURL(/\/parties$/);
  await page.getByRole('button', { name: /Add contact/ }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Contact name').fill('Unsaved contact');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('Contact name')).toHaveValue('Unsaved contact');
  page.once('dialog', (dialog) => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(modal).toHaveCount(0);
});
