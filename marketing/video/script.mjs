/**
 * The locked script. One source of truth for the narration and the edit.
 *
 * Every line is either quoted from the product (apps/web/lib/copy.ts,
 * packages/core/checks.json) or from the cleared slots in
 * marketing/taglines.md. Nothing here is newly-written marketing language,
 * and no line states a number that is not on screen in the shot beside it.
 *
 * `source` is the footage this beat runs over: a shot name from
 * tools/capture-footage.mjs, or a card name from marketing/video/titles.mjs.
 */

/** The narration voice.
 *
 *  Recorded here because regenerating one line has to match the other ten, and
 *  until this constant existed the choice lived nowhere but the shell history
 *  of whoever ran it last.
 *
 *  `text2speech_v2` picks its engine with `variant`; ElevenLabs is the least
 *  synthetic of the five it offers, and the engine matters more than the
 *  casting for that. It is also cheaper per line than the seed_audio the first
 *  cut used (0.3 credits against 0.5) and reads about 20% faster.
 *
 *  To change the voice: swap `voice_id` for one from `list_voices`, regenerate
 *  the ten narrated beats, and re-run build-film.mjs. The edit re-times itself
 *  off the new durations. To use a human read instead, ignore this entirely and
 *  drop takes into vo/ as <beat-id>.mp3.
 */
export const VOICE = {
  model: 'text2speech_v2',
  variant: 'elevenlabs',
  voice_type: 'preset',
  voice_id: '3c7d32be-0182-5c5e-aa6a-663409bfbb26',
  name: 'Emmett',
};

export const BEATS = [
  {
    id: 'open',
    source: { kind: 'shot', name: 'split' },
    vo: 'One request. Sent five times, one second apart, from one address.',
    note: 'The AgentRace panel, which labels itself an example on screen.',
  },
  {
    id: 'codes-chrome',
    // Measured, not reasoned about. Sampling the ClaudeBot status chip across
    // footage/split.mp4 every 200ms puts its 403 on screen during 4.0-7.0s and
    // 8.8-12.8s, and pending the rest: the rows land over five 620ms steps,
    // rest for two, then the whole set resets.
    //
    // The line this replaced ran 4.83s against a 4.0s window, so its last
    // second — the word "four-oh-three" itself — played over rows reading
    // pending. Splitting it in two lets each half sit wholly inside a window.
    // The cut between them lands where the animation resets anyway, so it
    // reads as the loop rather than as an edit.
    //
    // Re-measure if either line is re-recorded at a different length:
    //   for t in $(seq 0 0.2 14); do ffmpeg -ss $t -i split.mp4 -frames:v 1 \
    //     -vf "crop=40:20:182:168,scale=1:1" -f rawvideo -pix_fmt rgb24 -; done
    startAt: 4.0,
    source: { kind: 'shot', name: 'split' },
    vo: 'Chrome got two hundred.',
    note: 'The 200 is in frame for the whole line.',
  },
  {
    id: 'codes-claude',
    startAt: 8.55,
    source: { kind: 'shot', name: 'split' },
    vo: 'Claude got four-oh-three.',
    note: 'The 403 is in frame for the whole line. See codes-chrome for the measurement.',
  },
  {
    id: 'statement',
    source: { kind: 'title', name: 'split-statement' },
    vo: 'Same URL. Same second. Nobody decided that.',
    note: 'marketing/README.md, the one sentence the campaign turns on.',
  },
  {
    id: 'invisible',
    source: { kind: 'title', name: 'analytics' },
    vo: 'You will not find this in your analytics. A request that was refused never became a session.',
    note: 'copy.ts whyPoints[0].',
  },
  {
    id: 'scan',
    source: { kind: 'shot', name: 'live-open' },
    vo: 'So we ask. Five clients, one second apart, then one headless render.',
    note: 'The five stages are the scanner\'s real method, quoted off the live page.',
  },
  {
    id: 'grade',
    source: { kind: 'shot', name: 'score' },
    // Deliberately silent. The score counting up to 50 and the six category
    // bars filling are doing the talking, and the narration was 87s with this
    // line in it. A held beat is cheaper than a rushed read.
    vo: null,
    note: 'Silent. The count-up to 50 and grade D are the beat.',
  },
  {
    id: 'finding',
    source: { kind: 'shot', name: 'clients' },
    vo: 'Same URL, same second. Four of the five clients got nothing readable.',
    note: 'Four, because the panel in frame shows four 403s. The landing-page example shows three; '
      + 'the number said is always the number visible.',
  },
  {
    id: 'weights',
    source: { kind: 'title', name: 'published' },
    vo: 'Every weight is published, so you can argue with the score instead of believing it.',
    note: 'The moat. marketing/README.md.',
  },
  {
    id: 'refusal',
    source: { kind: 'shot', name: 'blocked' },
    vo: 'And if your site refuses us, the page says so. We never work around a block.',
    note: 'The other half of the moat, over the real refusal screen.',
  },
  {
    id: 'offer',
    source: { kind: 'shot', name: 'fixpack' },
    vo: 'The diagnosis is free. The fix files are fifteen dollars, written from your own scan.',
    note: 'taglines.md, cleared sub-line.',
  },
  {
    id: 'close',
    source: { kind: 'title', name: 'endcard' },
    vo: 'Are you BotReady? botready dot dev.',
    note: 'The house line, and a URL box. Every asset in the campaign ends here.',
  },
];

/** The cutdowns are re-cuts of the same beats, never a trim of the master — a
 *  trim lands mid-sentence and mid-animation.
 *
 *  `target` is a hard duration, because a thirty-second slot is thirty seconds.
 *  build-film.mjs spreads whatever slack is left across the beats in proportion
 *  to their length, and refuses to build a cutdown whose beats already overrun:
 *  the fix for that is to drop a beat here, not to speed the read up.
 *
 *  The six-second bumper carries no narration. It is watched sound-off in a
 *  feed, and the two status codes do not need saying out loud.
 */
export const CUTDOWNS = [
  { name: 'launch-30-16x9', target: 30, beats: ['codes-claude', 'statement', 'finding', 'offer', 'close'] },
  { name: 'launch-15-16x9', target: 15, beats: ['statement', 'close'] },
  { name: 'launch-06-16x9', target: 6,  beats: ['statement'], silent: true },
];

/** Family B: the assets marketing/schedule.md asks for at T-9, and
 *  marketing/product-hunt.md and marketing/instagram.md constrain hard —
 *  "No music, no captions, real time". So these carry no narration, no
 *  titles and no speed change: they are the recordings, reframed to 9:16
 *  and nothing else. They are not cutdowns of the film and must not be
 *  swapped for one.
 *
 *  reel-2 (the scan, real time) and the 30-second Product Hunt demo are
 *  missing on purpose — see marketing/video/README.md, "The one gap".
 */
export const REELS = [
  { name: 'reel-1-split',   shot: 'split',   note: 'The five agents landing. Reel 1 in instagram.md.' },
  { name: 'reel-3-fixpack', shot: 'fixpack', note: 'The generated files. Reel 3 in instagram.md.' },
];
