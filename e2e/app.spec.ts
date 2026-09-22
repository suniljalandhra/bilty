import { test, expect, type Page } from '@playwright/test';
async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Test Google provider' })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL(/\/(onboarding|biltys)$/);
}
async function setup(page: Page, name: string, prefix: string) {
  await page.getByLabel('Company name', { exact: true }).fill(name);
  await page.getByLabel('Number prefix', { exact: true }).fill(prefix);
  await page.getByLabel('Company address', { exact: true }).fill('Transport Nagar, Delhi');
  await page.getByRole('button', { name: 'Create company & continue' }).click();
  await expect(page.getByRole('heading', { name: 'Bilty book', exact: true })).toBeVisible();
}
test('complete bilty journey with multiple references, audit, PDF and revocable sharing', async ({
  page,
}, testInfo) => {
  await signIn(page, 'owner@example.com');
  await setup(page, 'Delhi Transport', 'DT/');
  await page.getByRole('link', { name: 'New bilty', exact: false }).click();
  await page.getByLabel('Consignor name', { exact: true }).fill('Sunrise Traders');
  await page.getByLabel('Consignee name', { exact: true }).fill('Westside Stores');
  await page.getByLabel('From location', { exact: true }).fill('Delhi');
  await page.getByLabel('To location', { exact: true }).fill('Mumbai');
  await page.getByLabel('Goods description', { exact: true }).fill('Electronic equipment');
  await page.getByLabel('Actual weight', { exact: true }).fill('313.200');
  await page.getByLabel('Vehicle number', { exact: true }).fill('DL 01 AB 1234');
  await page.getByLabel('Freight type', { exact: true }).selectOption('billed');
  await page.getByLabel('Freight', { exact: true }).fill('1500.25');
  for (const [index, value] of ['441774284887', '431754769905', '461754771222'].entries()) {
    await page.getByRole('button', { name: /Add e-way bill/ }).click();
    await page.getByLabel(`E-way bill ${index + 1}`, { exact: true }).fill(value);
  }
  for (let i = 1; i <= 2; i++) {
    await page.getByRole('button', { name: /Add invoice/ }).click();
    await page.getByLabel(`Invoice ${i} number`, { exact: true }).fill(`INV-${i}`);
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.waitForURL(/\/biltys\/[a-f0-9-]+$/);
  await page.getByRole('button', { name: 'Issue bilty', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm & issue' }).click();
  await expect(page.getByRole('heading', { name: 'DT/0001', exact: true })).toBeVisible();
  await expect(page.getByText('461754771222', { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('issued-desktop.png'), fullPage: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toContain('DT-0001');
  await page.getByRole('button', { name: 'Create share link' }).click();
  const link = page.getByLabel('Private PDF share link');
  await expect(link).toHaveValue(/\/shared\//);
  const url = await link.inputValue();
  expect((await page.request.get(url)).status()).toBe(200);
  await page.getByLabel('Document copy', { exact: true }).selectOption('driver');
  await expect(page.getByRole('link', { name: 'Open WhatsApp' })).toHaveAttribute(
    'href',
    /Consignor%20copy/,
  );
  await page.getByRole('link', { name: 'Edit bilty', exact: true }).click();
  await page.getByLabel('Consignee address', { exact: true }).fill('Updated delivery address');
  await page
    .getByLabel('Reason for editing (required)', { exact: true })
    .fill('Correct delivery address');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL(/\/biltys\/[a-f0-9-]+$/);
  await page.getByRole('tab', { name: 'Audit history' }).click();
  await expect(page.getByText('Correct delivery address', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Document', exact: true }).click();
  const revoked = page.waitForResponse(
    (response) => response.request().method() === 'DELETE' && response.url().includes('/shares/'),
  );
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click();
  expect((await revoked).ok()).toBe(true);
  expect((await page.request.get(url)).status()).toBe(404);
  await page.getByRole('button', { name: 'Cancel bilty', exact: true }).click();
  await page.getByLabel('Reason for cancellation').fill('Customer cancelled');
  await page.getByRole('button', { name: 'Confirm cancellation' }).click();
  await expect(page.getByText(/and is read-only/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit bilty', exact: true })).toHaveCount(0);
});
test('mobile layout supports setup and address book without horizontal overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'mobile@example.com');
  await setup(page, 'Mobile Transport', 'MB/');
  await expect(page.getByRole('heading', { name: 'Bilty book', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-bilty-book.png'), fullPage: true });
  await page.getByRole('link', { name: 'New bilty', exact: false }).click();
  await expect(page.getByLabel('Consignor name', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-bilty-form.png'), fullPage: true });
});
test('address book and employee invitations enforce administrator access', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin-flow@example.com');
  await setup(page, 'Team Transport', 'TM/');
  await page.getByRole('link', { name: 'Address book', exact: false }).click();
  await page.getByRole('button', { name: /Add contact/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Contact name').fill('Trusted Sender');
  await dialog.getByLabel('Address', { exact: true }).fill('Delhi depot');
  await dialog.getByRole('button', { name: 'Add contact', exact: true }).click();
  await expect(page.getByText('Trusted Sender', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Team & access', exact: false }).click();
  await page.getByLabel('Invite email address').fill('worker-flow@example.com');
  await page.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const invitation = page.getByLabel('Private invitation link');
  await expect(invitation).toHaveValue(/token=/);
  const url = await invitation.inputValue();
  const context = await browser.newContext();
  const employee = await context.newPage();
  try {
    await employee.goto(url);
    await employee.getByRole('link', { name: /Google/ }).click();
    await employee.getByLabel('Email', { exact: true }).fill('worker-flow@example.com');
    await employee.getByRole('button', { name: 'Continue', exact: true }).click();
    await employee.waitForURL(/\/biltys$/);
    await expect(employee.getByRole('link', { name: 'Team & access', exact: false })).toHaveCount(
      0,
    );
    await employee.goto('http://localhost:3101/settings');
    await expect(employee.getByText('Your administrator can update these settings.')).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('row').filter({ hasText: 'worker-flow@example.com' }).first(),
    ).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('row')
      .filter({ hasText: 'worker-flow@example.com' })
      .filter({ has: page.getByRole('button', { name: 'Revoke access' }) })
      .getByRole('button', { name: 'Revoke access' })
      .click();
    await employee.reload();
    await employee.waitForURL(/\/login/);
  } finally {
    await context.close();
  }
});
