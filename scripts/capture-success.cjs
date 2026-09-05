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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    deviceScaleFactor: 2,
    viewport: { width: 1440, height: 1400 },
  });

  await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
  await page.waitForSelector('easy-payments', { timeout: 60000 });
  await page.waitForTimeout(1000);

  await page.locator('input[name="mock-outcome"][value="success"]').click();
  await page.waitForTimeout(200);

  // Dump available radios for debugging if needed
  const radios = await page.locator('easy-payments [role="radio"]').allTextContents();
  console.log('radios:', radios);

  const card = page.locator('easy-payments [role="radio"]').filter({ hasText: /Card/i }).first();
  await card.click();
  await page.waitForTimeout(600);

  const payBtn = page.locator('easy-payments button.ep-mock-panel__cta');
  await payBtn.waitFor({ state: 'visible', timeout: 15000 });
  console.log('pay text', await payBtn.textContent());
  await payBtn.click();
  await page.waitForTimeout(2000);

  const outcomeText = await page.locator('easy-payments').innerText();
  console.log('outcome snippet', outcomeText.slice(0, 200));

  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(300);
  await page.locator('easy-payments').screenshot({
    path: path.join(OUT, 'easy-payments-success.png'),
    type: 'png',
  });
  console.log('wrote success', fs.statSync(path.join(OUT, 'easy-payments-success.png')).size);

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
