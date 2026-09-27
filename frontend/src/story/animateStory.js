import { createTrashCan } from './trashCan.js';

// The entire fire, smoke, ash, and ember field is drawn with ASCII glyphs.
// The review cards and the receiving 3D trash can remain fully rendered.
// Starts the story inside `root` (the element holding #story); returns a stop function.
export function startTrashStory(root) {
const document = root;
const can = createTrashCan(document.querySelector('#can-back'), document.querySelector('#can-front'));
const burning = document.querySelector('#burning');
const burningWindow = document.querySelector('#burning-window');
const story = document.querySelector('#story');
const stage = document.querySelector('#scene');
const conversation = document.querySelector('#conversation');
const raving = document.querySelector('#raving');
const returning = document.querySelector('#returning');
const ending = document.querySelector('#ending');
const sign = document.querySelector('.lease-sign');
const canCaption = document.querySelector('#can-caption');
const chatCaption = document.querySelector('#chat-caption');
const signCaption = document.querySelector('#sign-caption');
const messages = [...document.querySelectorAll('.message')];
const messageTimes = messages.map(message => Number(message.dataset.at));
// Screens of scrolling through the story (#story is this many plus one screens tall).
// The original timeline plays over 4.4 screens, pausing where a caption needs reading
// time: once the can shuts, and once the "months later" chat is done. After a beat on
// the sign (with its own caption), the whole scene fades away to reveal what's pinned
// behind it (the homepage map).
const CAN_SHUT = .67, CAN_HOLD = .7;
const CHAT_DONE = 3.33, CHAT_HOLD = .6;
const CAN_PAUSE = CAN_SHUT; // where each pause starts, in screens scrolled
const CHAT_PAUSE = CHAT_DONE + CAN_HOLD;
const TIMELINE_SCREENS = 4.4 + CAN_HOLD + CHAT_HOLD;
const EXIT_START = TIMELINE_SCREENS + .7, EXIT_END = EXIT_START + .4;
const STORY_SCREENS = EXIT_START + .5;
// Where each "Continue" stops: the can's caption, the rave, months later, the sign, the map.
const CHECKPOINTS = [CAN_PAUSE + .18, 1.88 + CAN_HOLD, CHAT_PAUSE + .2, TIMELINE_SCREENS + .25, STORY_SCREENS];
// Screens scrolled -> screens of the original timeline, standing still during pauses.
function played(distance) {
  if (distance < CAN_PAUSE) return distance;
  if (distance < CAN_PAUSE + CAN_HOLD) return CAN_SHUT;
  if (distance < CHAT_PAUSE) return distance - CAN_HOLD;
  if (distance < CHAT_PAUSE + CHAT_HOLD) return CHAT_DONE;
  return distance - CAN_HOLD - CHAT_HOLD;
}
// Everything the frame loop needs from layout is measured here - on start, when the
// scene changes size, and once web fonts arrive - never mid-frame, where reading layout
// right after changing styles makes the browser redo it on every frame of a scroll.
const layout = { width: 0, height: 0, storyTop: 0, storyLength: 1, canCaption: 0, chatCaption: 0, signCaption: 0, returning: 0, sign: 0 };
function measure() {
  layout.width = stage.clientWidth;
  layout.height = stage.clientHeight;
  // Measured from where the story sits on the page, so content above it doesn't count.
  layout.storyTop = story.getBoundingClientRect().top + scrollY;
  layout.storyLength = Math.max(1, story.offsetHeight - layout.height);
  layout.canCaption = canCaption.offsetHeight;
  layout.chatCaption = chatCaption.offsetHeight;
  layout.signCaption = signCaption.offsetHeight;
  layout.returning = returning.offsetHeight;
  layout.sign = sign.offsetHeight;
  shownDistance = NaN; // redraw the scene with the new measurements
}
// A caption and what it's about (the can, the chat, the sign) are stacked as one
// group, centred in the space left between the nav and the Continue button.
const NAV_CLEARANCE = 92, CONTINUE_CLEARANCE = 64;
function stack(firstHeight, secondHeight) {
  const gap = layout.width <= 600 ? 32 : 48;
  const space = layout.height - NAV_CLEARANCE - CONTINUE_CLEARANCE;
  const top = NAV_CLEARANCE + Math.max(0, (space - firstHeight - gap - secondHeight) / 2);
  return [top, top + firstHeight + gap];
}
// Where the shut can is drawn inside the 840x780 composition (top of lid to base).
const CAN_TOP = 370, CAN_BOTTOM = 776;
const WIDE_SCREEN = 1100; // matches the side-by-side hero in styles.css
let compositionScale = 1;
// Style and attribute changes go through here and are skipped when the value is the
// same as last time, so a page that isn't moving costs next to nothing per frame.
const written = new WeakMap();
function write(element, property, value) {
  let last = written.get(element);
  if (!last) written.set(element, last = {});
  if (last[property] === value) return;
  last[property] = value;
  if (property === 'aria-hidden') element.setAttribute(property, value);
  else element.style.setProperty(property, value);
}
const px = value => `${value.toFixed(1)}px`;
const hide = (element, hidden) => write(element, 'aria-hidden', hidden ? 'true' : 'false');
// Fully faded layers are hidden outright: at opacity 0 a browser still draws them.
const showIf = (element, visible) => write(element, 'visibility', visible ? 'visible' : 'hidden');
function showCaption(element, visible) {
  write(element, 'opacity', visible.toFixed(3));
  write(element, 'transform', `translateY(${px((1 - visible) * 16)})`);
  hide(element, visible < .02);
  showIf(element, visible > .001);
}
let scrollTarget = 0, scrollProgress = 0, shownDistance = NaN, lastScrollAt = 0;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
function readScroll() {
  lastScrollAt = performance.now();
  const target = clamp((scrollY - layout.storyTop) / layout.storyLength);
  // A jump (Give feedback, the logo, dragging the scrollbar) lands straight on the new
  // spot instead of easing through everything in between.
  if (Math.abs(target - scrollTarget) * STORY_SCREENS > 1) scrollProgress = target;
  scrollTarget = target;
}
addEventListener('scroll', readScroll, { passive: true });

function scrollToScreen(screen, behavior) {
  scrollTo({ top: layout.storyTop + (screen / STORY_SCREENS) * layout.storyLength, behavior });
}
// data-story-goto="next" scrolls on to the next checkpoint; "end" jumps straight past the story.
// ("instant", not "auto": the site sets smooth scrolling in CSS, which "auto" follows.)
function onGoto(event) {
  const button = event.target.closest('[data-story-goto]');
  if (!button) return;
  if (button.dataset.storyGoto === 'end') {
    scrollToScreen(STORY_SCREENS, 'instant');
    return;
  }
  const here = scrollTarget * STORY_SCREENS;
  scrollToScreen(CHECKPOINTS.find(screen => screen > here + .05) ?? STORY_SCREENS, motion.matches ? 'instant' : 'smooth');
}
root.addEventListener('click', onGoto);
const composition = document.querySelector('#composition');
const back = document.querySelector('#fire');
const front = document.querySelector('#embers');
const ctx = back.getContext('2d');
const foreground = front.getContext('2d');
const width = 840, height = 780, center = 420, base = 636;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
// Drawn on the site's light background: deep red tips through to an amber core
// (pale yellows would disappear against it).
const palette = ['#8f2d1a', '#b23a1c', '#d1491f', '#e8602a', '#f27c2e', '#f79a2e', '#f5ad2f'];
const glyphs = ['.', ':', ';', '+', '*', '#', '%', '@'];
let compact = false;

// The fire's characters are drawn from small pre-rendered images: copying thousands of
// those a frame is far cheaper than having the browser set the same few characters as
// text, which kept phones busy enough to stutter while scrolling.
const SPRITE_WIDTH = 16, SPRITE_HEIGHT = 18;
const sprites = new Map();
let pixelRatio = 0;
function sprite(symbol, color) {
  const key = symbol + color;
  let image = sprites.get(key);
  if (!image) {
    image = window.document.createElement('canvas');
    image.width = Math.round(SPRITE_WIDTH * pixelRatio);
    image.height = Math.round(SPRITE_HEIGHT * pixelRatio);
    const context = image.getContext('2d');
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.font = 'bold 13px "Courier New", monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(symbol, SPRITE_WIDTH / 2, SPRITE_HEIGHT / 2);
    sprites.set(key, image);
  }
  return image;
}

let sceneWidth = -1, sceneHeight = -1;
function resize() {
  const dpr = Math.min(devicePixelRatio, 2);
  // Phones fire resize whenever their toolbars slide in or out mid-scroll. The scene is
  // sized in svh, so those leave it unchanged - and redoing the work below then is what
  // made scrolling stutter (resizing a canvas also wipes it, flickering the fire).
  if (stage.clientWidth === sceneWidth && stage.clientHeight === sceneHeight && dpr === pixelRatio) return;
  sceneWidth = stage.clientWidth;
  sceneHeight = stage.clientHeight;
  compact = sceneWidth <= 600;
  // Fit the artwork itself on phones, rather than shrinking the empty desktop canvas.
  const framingWidth = compact ? 420 : width;
  compositionScale = Math.min((sceneWidth - 20) / framingWidth, (sceneHeight - 24) / height, 1.2);
  composition.style.setProperty('--scale', compositionScale);
  // The canvases are a fixed size; they only need re-creating for a new pixel density.
  if (dpr !== pixelRatio) {
    pixelRatio = dpr;
    sprites.clear();
    for (const canvas of [back, front]) {
      canvas.width = width * dpr; canvas.height = height * dpr;
      const context = canvas.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.textAlign = 'center';
      context.textBaseline = 'middle';
    }
  }
  measure();
  readScroll();
}
addEventListener('resize', resize); resize();
let stopped = false;
// Captions are set in web fonts; measure again once they've loaded.
window.document.fonts?.ready.then(() => { if (!stopped) measure(); });

function noise(x, y, t) {
  return Math.sin(x * .065 + y * .035 - t * 2.9) * .35
    + Math.sin(x * .127 - y * .057 + t * 3.7) * .19
    + Math.sin(x * .027 + y * .095 - t * 5.1) * .15;
}
function plume(x, y, t, offset, tall, wide, phase) {
  const h = tall + Math.sin(t * 2 + phase) * 27 + Math.sin(t * 3.7 + phase) * 12;
  const v = y / h;
  if (v < 0 || v >= 1) return -2;
  const bend = Math.sin(v * 6.8 - t * 2.2 + phase) * (9 + v * 21) + Math.sin(v * 11 - t) * v * 12;
  const radius = wide * Math.pow(1 - v, .65) * (.82 + Math.sin(v * 7 + t * 2 + phase) * .13);
  return 1 - Math.abs(x - offset - bend) / Math.max(radius, 2) + noise(x, y, t) * (.32 + v * .52);
}

function drawFire(t) {
  // Stretched wider than the flame shapes are drawn, a bit less on phones where it
  // already nearly fills the screen; the columns reach far enough to hold the edges.
  const flameWidth = compact ? 1.42 : 1.52;
  const flameHeight = 1.04;
  const halfColumns = compact ? 31 : 33;
  for (let row = 0; row < (compact ? 58 : 51); row++) {
    const y = row * 9;
    for (let col = -halfColumns; col <= halfColumns; col++) {
      const x = col * 8;
      const flameX = x / flameWidth, flameY = y / flameHeight;
      const power = Math.max(
        plume(flameX, flameY, t, -58, compact ? 280 : 239, 72, 2.3),
        plume(flameX, flameY, t, 4, compact ? 425 : 363, 84, .1),
        plume(flameX, flameY, t, 65, compact ? 325 : 284, 60, 4.7)
      );
      if (power < .11) continue;
      const flicker = Math.sin(col * 15.71 + row * 31.21 + Math.floor(t * 10) * 2.3);
      if (power < .3 && flicker < -.25) continue;
      const heat = Math.max(0, Math.min(.999, power * .56 + (1 - y / 400) * .25 + flicker * .06));
      const symbol = glyphs[Math.min(7, Math.floor(heat * 8))];
      const py = base - y;
      const glyph = sprite(symbol, palette[Math.floor(heat * palette.length)]);
      const left = center + x - SPRITE_WIDTH / 2, top = py - SPRITE_HEIGHT / 2;
      ctx.globalAlpha = Math.min(1, power * 1.3);
      ctx.drawImage(glyph, left, top, SPRITE_WIDTH, SPRITE_HEIGHT);
      // Flame tongues lick in front of the cards, using only visible characters.
      const inFront = compact
        ? py > 430 && py < 470 && (Math.abs(x) < 38 || power > 1.05)
        : py > 518 && (Math.abs(x) < 58 || power > .9);
      if (inFront) {
        foreground.globalAlpha = Math.min(1, power * 1.2);
        foreground.drawImage(glyph, left, top, SPRITE_WIDTH, SPRITE_HEIGHT);
      }
    }
  }
  ctx.globalAlpha = 1; foreground.globalAlpha = 1;
}

const driftWords = ['amazing', '*', 'never again', '*', 'loved it', '*', 'disappointing', '*', 'five stars', '*', 'not worth it', '*'];
function drawSmoke(t) {
  ctx.font = '12px "Courier New", monospace';
  const smokeGlyphs = ['.', '.', ':', ',', '~', "'", ';'];
  for (let i = 0; i < 83; i++) {
    const life = (t * .041 + i / 83) % 1;
    const sway = Math.sin(life * 6 + i * 2.39) * (15 + life * 66);
    const x = center + sway + Math.sin(life * 3) * 38;
    const y = 357 - life * 290;
    ctx.globalAlpha = Math.sin(life * Math.PI) * .32;
    ctx.fillStyle = '#919293';
    ctx.fillText(smokeGlyphs[i % smokeGlyphs.length], x, y);
  }
  driftWords.forEach((word, i) => {
    const life = (t * .038 + i / driftWords.length) % 1;
    const x = center + Math.sin(life * 5 + i * 2.4) * (25 + life * 72) + life * 25;
    const y = 422 - life * 355;
    ctx.globalAlpha = Math.pow(Math.sin(life * Math.PI), 1.7) * (word === '*' ? .78 : compact ? .76 : .52);
    ctx.fillStyle = life < .35 ? '#c98b53' : '#8b8883';
    ctx.font = `${word === '*' ? 17 : compact ? 16 : 11}px "Courier New", monospace`;
    ctx.fillText(word, x, y);
  });
  ctx.globalAlpha = 1;
}

function drawEmbers(t) {
  foreground.font = '13px "Courier New", monospace';
  for (let i = 0; i < 43; i++) {
    const speed = .065 + (i % 5) * .009;
    const life = (t * speed + i / 43) % 1;
    const x = center + Math.sin(i * 2.39 + life * 6) * (35 + life * 102);
    const y = 638 - life * (300 + (i % 4) * 52);
    foreground.globalAlpha = Math.sin(life * Math.PI) * .83;
    foreground.fillStyle = i % 4 === 0 ? '#f59e0b' : '#d9622b';
    foreground.fillText(i % 3 === 0 ? '*' : i % 3 === 1 ? '+' : '.', x, y);
  }
  // A small bed of typographic coals below the paper fuel.
  for (let i = 0; i < 31; i++) {
    const x = center - 131 + i * 8.7;
    const y = 672 + Math.sin(i * 1.78) * 9;
    foreground.globalAlpha = .35 + .23 * Math.sin(t * 2.1 + i * 2.4);
    foreground.fillStyle = '#e38b49';
    foreground.fillText(i % 3 === 0 ? '*' : ':', x, y);
  }
  foreground.globalAlpha = 1;
}

// Positions every part of the story for how far through it the reader is.
let disposal = 0;
function showScene(distance) {
  const position = played(distance);
  const timeline = Math.min(1, position <= .95
    ? (position / .95) * .385
    : .385 + ((position - .95) / 3.45) * .615);
  // Each pause moves its subject aside and fades its caption into the space.
  // On wide screens the fire starts right of centre, beside the page's intro text,
  // and slides back to the middle as the story gets going.
  const fireShift = layout.width >= WIDE_SCREEN ? layout.width * .2 * (1 - smooth(distance / .45)) : 0;
  const canPaused = smooth((distance - (CAN_PAUSE - .07)) / .15);
  let canShift = 0;
  if (canPaused > 0) {
    const [captionTop, canTop] = stack(layout.canCaption, (CAN_BOTTOM - CAN_TOP) * compositionScale);
    const restingCanTop = layout.height / 2 + (CAN_TOP - height / 2) * compositionScale;
    write(canCaption, 'top', px(captionTop));
    canShift = canPaused * (canTop - restingCanTop);
  }
  write(composition, 'translate', `${px(fireShift)} ${px(canShift)}`);
  showCaption(canCaption, canPaused * (1 - smooth((distance - (CAN_PAUSE + CAN_HOLD - .15)) / .15)));
  const chatPaused = smooth((distance - (CHAT_PAUSE - .05)) / .15);
  if (chatPaused > 0) {
    const [chatTop, captionTop] = stack(layout.returning, layout.chatCaption);
    const restingChatTop = (layout.height - layout.returning) / 2;
    write(chatCaption, 'top', px(captionTop));
    write(returning, 'translate', `0 ${px(chatPaused * (chatTop - restingChatTop))}`);
  } else write(returning, 'translate', 'none');
  showCaption(chatCaption, chatPaused * (1 - smooth((distance - (CHAT_PAUSE + CHAT_HOLD - .15)) / .15)));
  showCaption(signCaption, smooth((distance - (TIMELINE_SCREENS - .1)) / .2));
  const exit = smooth((distance - EXIT_START) / (EXIT_END - EXIT_START));
  write(stage, 'opacity', (1 - exit).toFixed(3));
  write(stage, 'visibility', exit > .99 ? 'hidden' : 'visible');
  disposal = clamp(timeline / .32);
  const gather = smooth(disposal / .28);
  const drop = smooth((disposal - .25) / .44);
  const size = 1 - gather * .52 - drop * .30;
  const descent = -210 * gather + 250 * drop;
  write(burning, 'transform', `translateY(${px(descent)}) scale(${size.toFixed(4)})`);
  write(burning, 'opacity', (1 - smooth((disposal - .64) / .075)).toFixed(3));
  write(burningWindow, 'clip-path', disposal > .18 ? 'inset(0 0 80px 0)' : 'none');
  hide(burning, disposal > .715);
  can.render(disposal);
  const canExit = smooth((timeline - .30) / .07);
  write(composition, 'opacity', (1 - canExit).toFixed(3));
  hide(composition, canExit > .99);
  showIf(composition, canExit < .999);

  const chatExit = smooth((timeline - .845) / .10);
  const chatVisible = smooth((timeline - .365) / .025) * (1 - chatExit);
  write(conversation, 'opacity', chatVisible.toFixed(3));
  hide(conversation, chatVisible < .02);
  showIf(conversation, chatVisible > .001);
  const raveExit = smooth((timeline - .575) / .06);
  write(raving, 'opacity', (1 - raveExit).toFixed(3));
  write(raving, 'transform', `translate(-50%, calc(-50% - ${px(raveExit * 38)}))`);
  hide(raving, timeline < .375 || raveExit > .98);
  const returnEnter = smooth((timeline - .635) / .025);
  write(returning, 'opacity', returnEnter.toFixed(3));
  hide(returning, returnEnter < .02 || chatExit > .98);
  messages.forEach((message, index) => {
    const reveal = smooth((timeline - messageTimes[index]) / .026);
    write(message, 'opacity', reveal.toFixed(3));
    write(message, 'transform', `translateY(${px((1 - reveal) * 24)}) scale(${(.96 + reveal * .04).toFixed(4)})`);
    hide(message, reveal < .02);
  });
  const closed = smooth((timeline - .93) / .055);
  write(ending, 'opacity', closed.toFixed(3));
  hide(ending, closed < .02);
  showIf(ending, closed > .001);
  write(sign, 'transform', motion.matches ? 'none' : `translateY(${px((1 - closed) * 36)})`);
  if (closed > 0) {
    const [captionTop, signTop] = stack(layout.signCaption, layout.sign);
    write(signCaption, 'top', px(captionTop));
    write(sign, 'top', px(signTop));
  }
}

let time = 3, previous = 0, lastFrame = 0, frame = 0, fireOnCanvas = false;
function animate(now) {
  frame = requestAnimationFrame(animate);
  if (window.document.hidden) { previous = now; return; }
  // Ease toward the scroll position, then land on it exactly so a still page stops changing.
  const gap = scrollTarget - scrollProgress;
  scrollProgress = motion.matches || Math.abs(gap) < 1e-4 ? scrollTarget : scrollProgress + gap * .14;
  // Compress fire-to-chat into less than one screen of scrolling;
  // keep the reading time for the conversations and ending unchanged.
  const distance = scrollProgress * STORY_SCREENS;
  if (distance !== shownDistance) {
    shownDistance = distance;
    showScene(distance);
  }
  // The fire flickers on its own clock, 20 times a second, and only while it's burning.
  if (now - lastFrame < 50) return;
  const delta = previous ? Math.min((now - previous) / 1000, .1) : 0;
  previous = now; lastFrame = now;
  if (!motion.matches) time += delta;
  const burningNow = disposal < .72;
  if (!burningNow && !fireOnCanvas) return;
  // Hold the flicker still while the page is being scrolled: redrawing these big
  // canvases is the heaviest thing on the page, and phones stutter doing it mid-scroll.
  // (The fire still moves with the scroll; only its flicker waits.)
  if (burningNow && fireOnCanvas && now - lastScrollAt < 150) return;
  ctx.clearRect(0, 0, width, height);
  foreground.clearRect(0, 0, width, height);
  fireOnCanvas = burningNow;
  if (burningNow) { drawSmoke(time); drawFire(time); drawEmbers(time); }
}
frame = requestAnimationFrame(animate);

return () => {
  stopped = true;
  cancelAnimationFrame(frame);
  removeEventListener('scroll', readScroll);
  removeEventListener('resize', resize);
  root.removeEventListener('click', onGoto);
  can.dispose();
};
}
