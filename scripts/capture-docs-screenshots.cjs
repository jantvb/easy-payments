/**
 * Capture real Easy Payments checkout screenshots from the local demo.
 * Requires: npx ng serve demo (http://localhost:4200)
 *
 * Usage: node scripts/capture-docs-screenshots.mjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'assets');
const BASE = 'http://localhost:4200';

fs.mkdirSync(OUT, { recursive: true });

const HIDE_CHROME = `
  .demo-header,
  aside.panel,
  .preview-meta,
  .event-log,
  .demo-mode-banner,
  .stripe-mode-banner { display: none !important; }
  .demo { padding: 32px 24px !important; background: #f4f6f8 !important; min-height: 100vh !important; }
  .demo-layout { display: block !important; max-width: none !important; }
  .checkout { margin: 0 auto !important; max-width: 720px !important; }
  .checkout-stage { padding: 24px !important; background: transparent !important; box-shadow: none !important; border: none !important; }
  .checkout-stage__surface { display: flex !important; justify-content: center !important; }
`;

async function ready(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('easy-payments', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: HIDE_CHROME });
  await page.waitForTimeout(200);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    const input = document.querySelector(`input[name="theme"][value="${t}"]`);
    if (input) {
      input.click();
    }
  }, theme);
  await page.waitForTimeout(400);
}

async function setAppearance(page, appearance) {
  await page.evaluate((a) => {
    const input = document.querySelector(`input[name="appearance"][value="${a}"]`);
    if (input) {
      input.click();
    }
  }, appearance);
  await page.waitForTimeout(400);
}

async function shot(page, name, opts = {}) {
  const el = page.locator('easy-payments').first();
  await el.waitFor({ state: 'visible' });
  const file = path.join(OUT, name);
  await el.screenshot({ path: file, type: 'png', ...opts });
  console.log('wrote', name);
}

async function reorderPayPalFirst(page) {
  // Click "Up" on PayPal until it is first among method rows (demo control).
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.method-list li'));
    const paypal = labels.find((li) => li.textContent?.includes('PayPal'));
    if (!paypal) return;
    const up = paypal.querySelector('button');
    // Move up several times.
    for (let i = 0; i < 6; i++) {
      const btn = paypal.querySelector('button[aria-label*="up" i], .reorder button:first-child');
      if (btn && !btn.disabled) btn.click();
    }
  });
  await page.waitForTimeout(500);
}

async function triggerMockSuccess(page) {
  await page.evaluate(() => {
    const success = document.querySelector('input[name="mock-outcome"][value="success"]');
    if (success) success.click();
  });
  await page.waitForTimeout(300);
  // Select card method tile if present, then click pay/mock button.
  const card = page.locator('button, [role="button"]').filter({ hasText: /card/i }).first();
  if (await card.count()) {
    await card.click().catch(() => {});
  }
  await page.waitForTimeout(400);
  // Mock panels usually have a Pay / Confirm button.
  const pay = page.getByRole('button', { name: /pay|confirm|complete|continue/i }).first();
  if (await pay.count()) {
    await pay.click();
  } else {
    // Fallback: click any primary action inside easy-payments
    await page.locator('easy-payments button').last().click().catch(() => {});
  }
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    colorScheme: 'light',
  });
  const page = await context.newPage();

  // Desktop
  await page.setViewportSize({ width: 1440, height: 1100 });
  await ready(page);
  await setTheme(page, 'light');
  await setAppearance(page, 'default');
  await shot(page, 'easy-payments-desktop.png');
  await shot(page, 'easy-payments-default.png');
  await shot(page, 'easy-payments-light.png');

  // Laptop
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, 'easy-payments-laptop.png');

  // Tablet
  await page.setViewportSize({ width: 834, height: 1100 });
  await page.waitForTimeout(300);
  await shot(page, 'easy-payments-tablet.png');

  // iPad viewport
  await page.setViewportSize({ width: 1024, height: 1200 });
  await page.waitForTimeout(300);
  await shot(page, 'easy-payments-ipad.png');

  // Mobile
  await page.setViewportSize({ width: 390, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, 'easy-payments-mobile.png');

  // Dark (desktop)
  await page.setViewportSize({ width: 1440, height: 1100 });
  await setTheme(page, 'dark');
  await page.evaluate(() => {
    document.querySelector('.demo')?.style.setProperty('background', '#12141a', 'important');
  });
  await shot(page, 'easy-payments-dark.png');

  // Transparent
  await setTheme(page, 'light');
  await setAppearance(page, 'transparent');
  await page.evaluate(() => {
    const light = document.querySelector('input[name="transparent-backdrop"][value="light"]');
    if (light) light.click();
    const demo = document.querySelector('.demo');
    if (demo) {
      demo.style.setProperty(
        'background',
        'linear-gradient(145deg, #e8f0fe 0%, #f8fafc 50%, #ede9fe 100%)',
        'important',
      );
    }
  });
  // Capture stage so transparent backdrop is visible
  await page.locator('.checkout-stage').first().screenshot({
    path: path.join(OUT, 'easy-payments-transparent.png'),
    type: 'png',
  });
  console.log('wrote easy-payments-transparent.png');

  // Method order: PayPal first
  await setAppearance(page, 'default');
  await setTheme(page, 'light');
  await page.evaluate(() => {
    document.querySelector('.demo')?.style.setProperty('background', '#f4f6f8', 'important');
  });
  // Unhide controls briefly to reorder, then rehide
  await page.addStyleTag({
    content: `aside.panel { display: block !important; position: fixed !important; left: -9999px !important; }`,
  });
  await reorderPayPalFirst(page);
  await shot(page, 'easy-payments-method-order.png');

  // Success state
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('easy-payments', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: HIDE_CHROME });
  await setTheme(page, 'light');
  await setAppearance(page, 'default');
  await page.addStyleTag({
    content: `aside.panel { display: block !important; position: fixed !important; left: -9999px !important; }`,
  });
  await triggerMockSuccess(page);
  // Wait for confirmation UI
  await page.waitForTimeout(1500);
  const outcome = page.locator('easy-payments');
  await outcome.screenshot({ path: path.join(OUT, 'easy-payments-success.png'), type: 'png' });
  console.log('wrote easy-payments-success.png');

  await browser.close();
  console.log('done');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
