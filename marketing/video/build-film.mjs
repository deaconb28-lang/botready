/**
 * The edit. ffmpeg, driven from Node, in the same shape as
 * marketing/assets/build.mjs: the shot list is data at the top, one function
 * renders it, and running it twice gives you the same film.
 *
 * It never invents a frame. Every segment is either a recording made by
 * tools/capture-footage.mjs or a card drawn by marketing/video/titles.mjs, and
 * the beat order and narration come from marketing/video/script.mjs.
 *
 * Beat length is measured from the narration rather than guessed: each beat
 * runs for as long as its line takes to say, plus a lead-in and a tail. Source
 * footage shorter than its beat is looped; longer is trimmed.
 *
 * Usage:
 *   node marketing/video/build-film.mjs
 *   node marketing/video/build-film.mjs --only master,30
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const from = (rel) => pathToFileURL(join(HERE, rel)).href;
const ffmpeg = (await import('ffmpeg-static')
  .catch(() => import(from('../../tools/node_modules/ffmpeg-static/index.js')))).default;
const { BEATS, CUTDOWNS, REELS } = await import(from('./script.mjs'));

const args = new Map();
{
  const tokens = argv.slice(2).filter((t) => t !== '--');
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (!t?.startsWith('--')) continue;
    const next = tokens[i + 1];
    if (next && !next.startsWith('--')) { args.set(t.slice(2), next); i += 1; }
    else args.set(t.slice(2), 'true');
  }
}
const ONLY = args.get('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;

const FOOTAGE = join(HERE, 'footage');
const TITLES = join(HERE, 'titles');
const VO = join(HERE, 'vo');
const OUT = join(HERE, 'out');
const WORK = join(OUT, '.work');
const FONTS = join(REPO, 'apps', 'web', 'assets', 'fonts');

const FPS = 30;
/** From apps/web/app/tokens.css. The film's letterbox is the site's own ground. */
const CANVAS = '0xEDEBFB';

/** A beat opens a beat before the line starts and holds a beat after it ends,
 *  so the cut never lands on the first or last syllable. */
const LEAD_IN = 0.25;
const TAIL = 0.35;
/** A beat with no narration — the score counting up wants a moment of quiet. */
const SILENT_BEAT = 2.6;

const run = (a) => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'ignore', 'pipe'] });

/** ffprobe is not shipped with ffmpeg-static, so the duration is read off the
 *  banner ffmpeg prints when it opens a file with no output. */
function durationOf(file) {
  let out = '';
  try { execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) { out = String(e.stderr ?? ''); }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`could not read a duration from ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** A reel has no caption band to leave room for, so it is centred. */
function fitFilterReel(w, h, inset) {
  return `crop='min(iw,ih*5/4)':ih:(iw-out_w)/2:0,`
       + `scale=${w - inset * 2}:${h - inset * 2}:force_original_aspect_ratio=decrease:flags=lanczos,`
       + `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${CANVAS},fps=${FPS},setsar=1`;
}

function naturalLength(beat, silent) {
  const voFile = join(VO, `${beat.id}.mp3`);
  if (silent || !existsSync(voFile)) return SILENT_BEAT;
  return LEAD_IN + durationOf(voFile) + TAIL;
}

function sourceFor(beat) {
  const dir = beat.source.kind === 'title' ? TITLES : FOOTAGE;
  const file = join(dir, `${beat.source.name}.mp4`);
  if (!existsSync(file)) {
    throw new Error(`missing ${beat.source.kind} "${beat.source.name}" — run `
      + (beat.source.kind === 'title'
        ? 'marketing/video/titles.mjs'
        : 'tools/capture-footage.mjs') + ' first');
  }
  return file;
}

/** Fit a shot onto the canvas without cropping it. The crops that
 *  capture-footage.mjs applied are the framing decision; this only places them. */
function fitFilter(w, h, inset, vertical) {
  const boxW = w - inset * 2;
  const boxH = h - inset * 2;
  const place = `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${CANVAS},fps=${FPS},setsar=1`;
  if (!vertical) {
    return `scale=${boxW}:${boxH}:force_original_aspect_ratio=decrease:flags=lanczos,${place}`;
  }
  // On a phone, fitting a 16:9 capture inside a 1080-wide frame leaves the UI
  // too small to read and two thirds of the frame empty. So a wide source is
  // cropped to 5:4 around its centre first, which is the widest crop that keeps
  // the result legible, and the picture sits above the caption band rather than
  // in the middle of the frame.
  const CAPTION_BAND = 460;
  const stageH = h - CAPTION_BAND;
  return `crop='min(iw,ih*5/4)':ih:(iw-out_w)/2:0,`
       + `scale=${boxW}:${stageH - inset * 2}:force_original_aspect_ratio=decrease:flags=lanczos,`
       + `pad=${w}:${h}:(ow-iw)/2:(${stageH}-ih)/2:color=${CANVAS},fps=${FPS},setsar=1`;
}

/** One beat, normalised: exact duration, canvas-sized picture, one audio track. */
function renderBeat(beat, { width, height, inset }, override = {}) {
  const src = sourceFor(beat);
  // Two beats in a row on one shot must continue it, not restart it. Without
  // this the film cuts from the middle of the agent race back to its first
  // frame, which reads as a mistake because it is one.
  const seek = override.startAt ?? 0;
  const voFile = join(VO, `${beat.id}.mp3`);
  const hasVo = existsSync(voFile) && !override.silent;
  const voLen = hasVo ? durationOf(voFile) : 0;
  const natural = hasVo ? LEAD_IN + voLen + TAIL : SILENT_BEAT;
  const dur = Number((override.seconds ?? natural).toFixed(3));
  const dest = join(WORK, `${width}-${beat.id}-${dur}-${seek}.mp4`);

  const a = ['-stream_loop', '-1'];
  if (seek > 0) a.push('-ss', String(Number(seek.toFixed(3))));
  a.push('-i', src);
  if (hasVo) a.push('-i', voFile);
  else a.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');

  // The line is delayed by LEAD_IN and the track padded with silence to the
  // beat's length, so concatenation cannot drift the narration off its picture.
  const audio = hasVo
    ? `[1:a]adelay=${Math.round(LEAD_IN * 1000)}|${Math.round(LEAD_IN * 1000)},apad,atrim=0:${dur},asetpts=N/SR/TB[a]`
    : `[1:a]atrim=0:${dur},asetpts=N/SR/TB[a]`;

  run([
    ...a,
    '-filter_complex', `[0:v]${fitFilter(width, height, inset, height > width)},trim=0:${dur},setpts=N/${FPS}/TB[v];${audio}`,
    '-map', '[v]', '-map', '[a]',
    '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', dest,
  ]);
  return { file: dest, dur, beat };
}

function concat(parts, dest) {
  const list = join(WORK, `list-${Math.random().toString(36).slice(2)}.txt`);
  writeFileSync(list, parts.map((p) => `file '${p.file.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', dest]);
  rmSync(list, { force: true });
}

// ------------------------------------------------------------------ captions

const ASS_HEAD = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Public Sans,66,&H00181311,&H00FBEBED,&H00181311,0,0,0,0,100,100,0,0,1,5,0,2,80,80,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

const stamp = (t) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
};

/** Captions are authored from the script, not transcribed: the VO was generated
 *  a line at a time, so the text and its timing are already exact. */
function writeCaptions(parts, w, h) {
  let t = 0;
  const lines = [];
  for (const p of parts) {
    if (p.beat.vo) {
      // Text is the last field of a Dialogue line, so commas inside it are
      // literal. Escaping them prints the backslash.
      const text = p.beat.vo.replace(/\s+/g, ' ').trim();
      lines.push(`Dialogue: 0,${stamp(t + LEAD_IN)},${stamp(t + p.dur - 0.1)},Cap,,0,0,0,,${text}`);
    }
    t += p.dur;
  }
  const file = join(WORK, `captions-${w}x${h}.ass`);
  writeFileSync(file, ASS_HEAD(w, h) + lines.join('\n') + '\n');
  return file;
}

// ------------------------------------------------------------------ outputs

const TARGETS = [
  { name: 'launch-film-16x9', ids: null, width: 1920, height: 1080, inset: 0, captions: false },
  ...CUTDOWNS.map((c) => ({
    name: c.name, ids: c.beats, target: c.target, silent: c.silent,
    width: 1920, height: 1080, inset: 0, captions: false,
  })),
  // Laid out at 9:16 rather than reframed from the master: a reframe would crop
  // the five-row stack that is the whole point of the opening shot.
  { name: 'launch-film-9x16', ids: null, width: 1080, height: 1920, inset: 40, captions: true },
];

const wanted = ONLY
  ? TARGETS.filter((t) => ONLY.some((o) => t.name === o || t.name.includes(o)))
  : TARGETS;
const wantsReels = !ONLY || ONLY.includes('reels');
if (!wanted.length && !wantsReels) {
  console.error(`No target matched --only ${args.get('only')}`);
  exit(1);
}

mkdirSync(OUT, { recursive: true });
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const summary = [];
for (const target of wanted) {
  const beats = target.ids ? target.ids.map((id) => {
    const b = BEATS.find((x) => x.id === id);
    if (!b) throw new Error(`cutdown names a beat that is not in the script: ${id}`);
    return b;
  }) : BEATS;

  // A slot is a slot. Measure the beats at their natural length, then hold the
  // last one to land exactly on target — and refuse rather than rush if the
  // beats already overrun, because the fix is to drop one, not to speed up.
  let overrides = beats.map(() => ({ silent: target.silent }));
  if (target.target) {
    const natural = beats.map((b) => naturalLength(b, target.silent));
    const sum = natural.reduce((n, d) => n + d, 0);
    if (sum > target.target + 0.05) {
      throw new Error(
        `${target.name}: its beats run ${sum.toFixed(2)}s against a ${target.target}s target. `
        + `Drop a beat from CUTDOWNS in marketing/video/script.mjs.`,
      );
    }
    // Spread the slack across the beats in proportion to their length rather
    // than dumping it all on the last one. On a short cut that otherwise leaves
    // the end card holding for two thirds of the slot.
    const scale = target.target / sum;
    let spent = 0;
    overrides = natural.map((d, i) => {
      const last = i === natural.length - 1;
      const seconds = last ? target.target - spent : Number((d * scale).toFixed(3));
      spent += seconds;
      return { silent: target.silent, seconds };
    });
  }

  // Walk the beats so a run on one source plays through continuously.
  let carry = 0;
  let carrySource = null;
  const parts = beats.map((b, i) => {
    const key = `${b.source.kind}:${b.source.name}`;
    const startAt = b.startAt ?? (key === carrySource ? carry : 0);
    const part = renderBeat(b, target, { ...overrides[i], startAt });
    carry = startAt + part.dur;
    carrySource = key;
    return part;
  });
  const total = parts.reduce((n, p) => n + p.dur, 0);
  const dest = join(OUT, `${target.name}.mp4`);

  if (target.captions) {
    const staged = join(WORK, `${target.name}-nosub.mp4`);
    concat(parts, staged);
    const ass = writeCaptions(parts, target.width, target.height).replace(/([:\\])/g, '\\$1');
    run([
      '-i', staged,
      '-vf', `subtitles='${ass}':fontsdir='${FONTS}'`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'copy', '-movflags', '+faststart', dest,
    ]);
  } else {
    concat(parts, dest);
  }

  summary.push({ name: target.name, seconds: Number(total.toFixed(2)), beats: beats.length });
  console.log(`  cut  ${target.name.padEnd(20)} ${total.toFixed(2)}s  ${beats.length} beats`);
}

// Family B. No narration, no titles, no speed change — just the recording,
// reframed. Built here rather than by hand so "real time" stays checkable.
if (wantsReels) {
  mkdirSync(WORK, { recursive: true });
  for (const reel of REELS) {
    const src = join(FOOTAGE, `${reel.shot}.mp4`);
    if (!existsSync(src)) { console.error(`  skip  ${reel.name} (no ${reel.shot}.mp4)`); continue; }
    const dest = join(OUT, `${reel.name}.mp4`);
    run([
      '-i', src,
      '-vf', fitFilterReel(1080, 1920, 40),
      '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', dest,
    ]);
    console.log(`  cut  ${reel.name.padEnd(20)} ${durationOf(dest).toFixed(2)}s  silent, real time`);
    summary.push({ name: reel.name, seconds: Number(durationOf(dest).toFixed(2)), beats: 0 });
  }
}

// A poster pulled from the real cut, rather than an image model's idea of it.
const master = join(OUT, 'launch-film-16x9.mp4');
if (existsSync(master)) {
  run(['-ss', '12', '-i', master, '-frames:v', '1', join(OUT, 'launch-cover.png')]);
  console.log('  cut  launch-cover.png       poster frame at 12s');
}

rmSync(WORK, { recursive: true, force: true });
writeFileSync(join(OUT, 'renders.json'), JSON.stringify({ fps: FPS, renders: summary }, null, 2) + '\n');
console.log(`\n${summary.length} render(s) -> ${OUT}`);
