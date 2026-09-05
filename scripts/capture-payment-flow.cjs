const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'docs', 'assets');
const HIDE = `
  .demo-header, .preview-meta, .event-log, .demo-mode-banner, .stripe-mode-banner { display: none !important; }
  aside.panel { display: none !important; }
  .demo { padding: 32px 24px !important; background: #f4f6f8 !important; min-height: 100vh !important; }
  .demo-layout { display: block !important; }
  .checkout { margin: 0 auto !important; max-width: 720px !important; }
  .checkout-stage { padding: 24px !important; border: none !important; box-shadow: none !important; background: transparent !important; }
`;

async function prepare(page) {
  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.waitForSelector('easy-payments', { timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function selectCardAndPay(page) {
  const card = page.locator('easy-payments [role="radio"]').filter({ hasText: /Card/i }).first();
  await card.click();
  await page.waitForTimeout(400);
  const payBtn = page.locator('easy-payments button.ep-mock-panel__cta');
  await payBtn.waitFor({ state: 'visible', timeout: 15000 });
  await payBtn.click();
}

async function shot(page, name) {
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(200);
  await page.locator('easy-payments').screenshot({
    path: path.join(OUT, name),
    type: 'png',
  });
  console.log('wrote', name, fs.statSync(path.join(OUT, name)).size);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 1440, height: 1200 },
  });

  // PROCESSING
  await prepare(page);
  await page.locator('input[name="mock-outcome"][value="success"]').click();
  await selectCardAndPay(page);
  await page.waitForSelector('easy-payments .ep-outcome[data-state="processing"]', { timeout: 10000 });
  await shot(page, 'easy-payments-processing.png');
  await page.waitForSelector('easy-payments .ep-outcome[data-state="success"]', { timeout: 15000 });
  await shot(page, 'easy-payments-success.png');

  // ERROR
  await prepare(page);
  await page.locator('input[name="mock-outcome"][value="failed"]').click();
  await selectCardAndPay(page);
  await page.waitForSelector('easy-payments .ep-outcome[data-state="error"]', { timeout: 15000 });
  await shot(page, 'easy-payments-error.png');

  // CANCELLED
  await prepare(page);
  await page.locator('input[name="mock-outcome"][value="cancelled"]').click();
  await selectCardAndPay(page);
  await page.waitForSelector('easy-payments .ep-outcome[data-state="cancelled"]', { timeout: 15000 });
  await shot(page, 'easy-payments-cancelled.png');

  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
