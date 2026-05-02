// Clean screenshot-based renderer for both summary + master decks.
// Trades clickable PDF links for guaranteed visual fidelity.
import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

const SRC = '/Users/swhiting89/lumati-exec-dashboard/figma/investment-deck/index.html';
const OUT_SUMMARY = '/Users/swhiting89/LumatiOS/Investor_Updates/2026-05-02_lumati_series_a_summary_deck.pdf';
const OUT_MASTER = '/Users/swhiting89/LumatiOS/Investor_Updates/2026-05-02_lumati_series_a_deck.pdf';

// 16-slide curated set (DOM indices)
const SUMMARY_INDICES = new Set([0, 1, 2, 3, 4, 7, 9, 11, 12, 14, 15, 23, 24, 27, 28, 29]);

async function captureDeck(outPath, indicesFilter, label, viewport) {
  const TMP = `/tmp/clean-render-${label}`;
  execSync(`rm -rf ${TMP} && mkdir -p ${TMP}`);

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto('file://' + SRC, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    const l = document.getElementById('landing'); if (l) l.style.display='none';
    if (typeof window.unlockDeck === 'function') { try { window.unlockDeck(); } catch(e){} }
    document.querySelectorAll('img[loading="lazy"]').forEach(img => img.loading='eager');
  });
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 2000));

  // Force fade-in animations to end-state ONLY (NOT layout-positioning animations like orbital rotation).
  await page.addStyleTag({ content: `
    .anim, .anim.d1, .anim.d2, .anim.d3, .anim.d4, .anim.d5, .anim.d6 {
      opacity: 1 !important;
      transform: none !important;
      animation-name: none !important;
    }
  ` });

  const total = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log(`[${label}] Total slides ${total}, capturing ${indicesFilter ? indicesFilter.size : total}`);

  let captureNum = 1;
  for (let i = 0; i < total; i++) {
    await page.evaluate(t => { if (typeof window.goSlide === 'function') window.goSlide(t); }, i);
    // Long wait — let .anim animations + chart builders fully settle
    await new Promise(r => setTimeout(r, 3200));
    await page.evaluate(async () => { await document.fonts.ready; });

    if (indicesFilter && !indicesFilter.has(i)) continue;

    const out = `${TMP}/p${String(captureNum).padStart(2,'0')}.png`;
    await page.screenshot({ path: out });
    process.stdout.write(`  [${label}] ${captureNum}/${indicesFilter ? indicesFilter.size : total}\r`);
    captureNum++;
  }
  console.log();
  await browser.close();

  execSync(`cd ${TMP} && python3 -c "
from PIL import Image
import glob
files = sorted(glob.glob('p*.png'))
imgs = [Image.open(f).convert('RGB') for f in files]
imgs[0].save('${outPath}', save_all=True, append_images=imgs[1:], resolution=144, quality=92)
"`);
  console.log(`[${label}] PDF: ${outPath}`);
}

console.log('Rendering summary deck (1440x810, big readable text)...');
await captureDeck(OUT_SUMMARY, SUMMARY_INDICES, 'summary', { width: 1440, height: 810, deviceScaleFactor: 2 });
console.log('\nRendering master deck (1920x1080)...');
await captureDeck(OUT_MASTER, null, 'master', { width: 1920, height: 1080, deviceScaleFactor: 1.5 });

execSync(`pdfinfo "${OUT_SUMMARY}" | grep -E "Pages|size"`, {stdio:'inherit'});
execSync(`pdfinfo "${OUT_MASTER}" | grep -E "Pages|size"`, {stdio:'inherit'});
