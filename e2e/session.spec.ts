import { test, expect } from '@playwright/test';

test('parallel tabs rotate refresh cookies safely and sign out together', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await page.getByLabel('Email', { exact: true }).fill('multiple-tabs@example.com');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/onboarding$/);
  await page.getByLabel('Company name', { exact: true }).fill('Tabs Transport');
  await page.getByLabel('Number prefix', { exact: true }).fill('TB/');
  await page.getByRole('button', { name: 'Create company & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Bilty book', exact: true })).toBeVisible();
  const tabs = await Promise.all([context.newPage(), context.newPage()]);
  await Promise.all(tabs.map((tab) => tab.goto('/biltys')));
  await Promise.all(
    tabs.map((tab) =>
      expect(tab.getByRole('heading', { name: 'Bilty book', exact: true })).toBeVisible(),
    ),
  );
  const all = [page, ...tabs];
  await Promise.all(all.map((tab) => tab.reload()));
  await Promise.all(
    all.map((tab) =>
      expect(tab.getByRole('heading', { name: 'Bilty book', exact: true })).toBeVisible(),
    ),
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await Promise.all(all.map((tab) => expect(tab).toHaveURL(/\/login$/)));
  await Promise.all(
    all.map((tab) => expect(tab.getByRole('link', { name: 'Continue with Google' })).toBeVisible()),
  );
});
