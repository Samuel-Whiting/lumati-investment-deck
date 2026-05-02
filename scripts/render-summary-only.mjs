import puppeteer from 'puppeteer';
import { execSync } from 'child_process';
const SRC = '/Users/swhiting89/lumati-exec-dashboard/figma/investment-deck/index.html';
const OUT = '/Users/swhiting89/LumatiOS/Investor_Updates/2026-05-02_lumati_series_a_summary_deck.pdf';
const TMP = '/tmp/sum-render';
execSync(`rm -rf ${TMP} && mkdir -p ${TMP}`);
// + Lumati Home (idx 10), - Data Room (idx 28) — 16 slides total
const SUMMARY = new Set([0,1,2,3,4,7,9,10,11,12,14,15,23,24,27,29]);
const browser = await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--disable-gpu']});
const page = await browser.newPage();
await page.setViewport({width:1440,height:810,deviceScaleFactor:2});
await page.goto('file://'+SRC,{waitUntil:'load'});
await page.evaluate(()=>{const l=document.getElementById('landing');if(l)l.style.display='none';if(typeof window.unlockDeck==='function'){try{window.unlockDeck()}catch(e){}}document.querySelectorAll('img[loading="lazy"]').forEach(img=>img.loading='eager')});
await page.evaluate(async()=>{await document.fonts.ready});
await new Promise(r=>setTimeout(r,2000));
await page.addStyleTag({content:`.anim,.anim.d1,.anim.d2,.anim.d3,.anim.d4,.anim.d5,.anim.d6{opacity:1!important;transform:none!important;animation-name:none!important}`});
const total = await page.evaluate(()=>document.querySelectorAll('.slide').length);
let cap = 1;
for(let i=0;i<total;i++){
  await page.evaluate(t=>{if(typeof window.goSlide==='function')window.goSlide(t)},i);
  await new Promise(r=>setTimeout(r,3200));
  await page.evaluate(async()=>{await document.fonts.ready});
  if(!SUMMARY.has(i))continue;
  await page.screenshot({path:`${TMP}/p${String(cap).padStart(2,'0')}.png`});
  cap++;
}
await browser.close();
execSync(`cd ${TMP} && python3 -c "
from PIL import Image
import glob
files=sorted(glob.glob('p*.png'))
imgs=[Image.open(f).convert('RGB') for f in files]
imgs[0].save('${OUT}',save_all=True,append_images=imgs[1:],resolution=144,quality=92)
"`);
console.log('Done:',OUT);
