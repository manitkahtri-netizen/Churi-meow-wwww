// Renders index.html to an MP4, frame by frame, with the synthesized score.
//
//   node render.cjs [out.mp4]
//
// Needs Playwright (npm i playwright) and an ffmpeg with libx264 on PATH,
// or point FFMPEG at one. FPS defaults to 30; FROM/TO (seconds) render a slice.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(path.dirname(process.execPath), '../lib/node_modules/playwright'))); }

const FPS = +process.env.FPS || 30;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'khatriai-launch-film.mp4'));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(() => window.__film.renderMode());
  await page.evaluate(() => window.__film.ready());

  const dur = await page.evaluate(() => window.__film.duration);
  const from = +process.env.FROM || 0, to = Math.min(dur, +process.env.TO || dur);

  const wav = path.join(os.tmpdir(), `khatriai-score-${process.pid}.wav`);
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__film.renderAudio()), 'base64'));

  const ff = spawn(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-ss', String(from), '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exited ' + c))));

  const first = Math.round(from * FPS), last = Math.round(to * FPS);
  for (let i = first; i < last; i++) {
    await page.evaluate(x => window.__film.seek(x), i / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % FPS === 0) process.stdout.write(`\rframe ${i - first}/${last - first}`);
  }
  ff.stdin.end();
  await closed;
  await browser.close();
  fs.unlinkSync(wav);
  process.stdout.write(`\nwrote ${OUT}\n`);
})().catch(e => { console.error(e); process.exit(1); });
