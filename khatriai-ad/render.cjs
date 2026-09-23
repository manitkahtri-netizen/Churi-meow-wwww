// Renders index.html to an MP4, frame by frame, with the synthesized score.
//
//   node render.cjs [out.mp4]
//
// Needs Playwright (npm i playwright) and an ffmpeg with libx264 on PATH,
// or point FFMPEG at one. FPS defaults to 30; PAGES sets how many browser
// pages capture frames in parallel (default 4).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(path.dirname(process.execPath), '../lib/node_modules/playwright'))); }

const FPS = +process.env.FPS || 30;
const PAGES = +process.env.PAGES || 4;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'khatriai-sparrow-film.mp4'));

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  const [w, h] = await page.evaluate(() => window.__film.size);
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.__film.renderMode());
  await page.evaluate(() => window.__film.ready());
  return page;
}

(async () => {
  const browser = await chromium.launch();
  const pages = await Promise.all([...Array(PAGES)].map(() => openPage(browser)));
  const dur = await pages[0].evaluate(() => window.__film.duration);

  const wav = path.join(os.tmpdir(), `khatriai-score-${process.pid}.wav`);
  fs.writeFileSync(wav, Buffer.from(await pages[0].evaluate(() => window.__film.renderAudio()), 'base64'));

  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));

  const total = Math.round(dur * FPS);
  const grab = async (page, i) => { await page.evaluate(x => window.__film.seek(x), i / FPS); return page.screenshot({ type: 'png' }); };
  for (let i = 0; i < total; i += PAGES) {
    const batch = await Promise.all(pages.map((p, k) => i + k < total ? grab(p, i + k) : null));
    for (const png of batch) if (png && !ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    process.stdout.write(`\rframe ${Math.min(i + PAGES, total)}/${total}`);
  }
  ff.stdin.end();
  await closed;
  await browser.close();
  fs.unlinkSync(wav);
  process.stdout.write(`\nwrote ${OUT}\n`);
})().catch(e => { console.error(e); process.exit(1); });
