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
// A caption and what it's about (the can, the chat, the sign) are stacked as one
// group, centred in the space left between the nav and the Continue button.
const NAV_CLEARANCE = 92, CONTINUE_CLEARANCE = 64;
function stack(firstHeight, secondHeight) {
  const gap = stage.clientWidth <= 600 ? 32 : 48;
  const space = stage.clientHeight - NAV_CLEARANCE - CONTINUE_CLEARANCE;
  const top = NAV_CLEARANCE + Math.max(0, (space - firstHeight - gap - secondHeight) / 2);
  return [top, top + firstHeight + gap];
}
// Where the shut can is drawn inside the 840x780 composition (top of lid to base).
const CAN_TOP = 370, CAN_BOTTOM = 776;
const WIDE_SCREEN = 1100; // matches the side-by-side hero in styles.css
let compositionScale = 1;
function showCaption(element, visible) {
  element.style.opacity = visible;
  element.style.transform = `translateY(${(1 - visible) * 16}px)`;
  element.setAttribute('aria-hidden', visible < .02 ? 'true' : 'false');
}
let scrollTarget = 0, scrollProgress = 0;
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
// Measured from where the story sits on the page, so content above it (the site header) doesn't count.
function readScroll() {
  const target = clamp(-story.getBoundingClientRect().top / Math.max(1, story.offsetHeight - document.querySelector('#scene').clientHeight));
  // A jump (Give feedback, the logo, dragging the scrollbar) lands straight on the new
  // spot instead of easing through everything in between.
  if (Math.abs(target - scrollTarget) * STORY_SCREENS > 1) scrollProgress = target;
  scrollTarget = target;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

function scrollToScreen(screen, behavior) {
  const start = story.getBoundingClientRect().top + scrollY;
  const length = story.offsetHeight - stage.clientHeight;
  scrollTo({ top: start + (screen / STORY_SCREENS) * length, behavior });
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

function resize() {
  const viewport = document.querySelector('#scene');
  const availableWidth = viewport.clientWidth;
  const availableHeight = viewport.clientHeight;
  compact = availableWidth <= 600;
  // Fit the artwork itself on phones, rather than shrinking the empty desktop canvas.
  const framingWidth = compact ? 420 : width;
  const scale = Math.min((availableWidth - 20) / framingWidth, (availableHeight - 24) / height, 1.2);
  composition.style.setProperty('--scale', scale);
  compositionScale = scale;
  readScroll();
  const dpr = Math.min(devicePixelRatio, 2);
  for (const canvas of [back, front]) {
    canvas.width = width * dpr; canvas.height = height * dpr;
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
  }
}
addEventListener('resize', resize); resize();

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
  ctx.font = 'bold 13px "Courier New", monospace';
  foreground.font = 'bold 13px "Courier New", monospace';
  const flameWidth = 1.32;
  const flameHeight = 1.04;
  for (let row = 0; row < (compact ? 58 : 51); row++) {
    const y = row * 9;
    for (let col = -29; col <= 29; col++) {
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
      const px = center + x, py = base - y;
      ctx.fillStyle = palette[Math.floor(heat * palette.length)];
      ctx.globalAlpha = Math.min(1, power * 1.3);
      ctx.fillText(symbol, px, py);
      // Flame tongues lick in front of the cards, using only visible characters.
      const inFront = compact
        ? py > 430 && py < 470 && (Math.abs(x) < 38 || power > 1.05)
        : py > 518 && (Math.abs(x) < 58 || power > .9);
      if (inFront) {
        foreground.fillStyle = ctx.fillStyle;
        foreground.globalAlpha = Math.min(1, power * 1.2);
        foreground.fillText(symbol, px, py);
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

let time = 3, previous = 0, lastFrame = 0, frame = 0;
function animate(now) {
  frame = requestAnimationFrame(animate);
  if (window.document.hidden) { previous = now; return; }
  scrollProgress = motion.matches ? scrollTarget : scrollProgress + (scrollTarget - scrollProgress) * .14;
  // Compress fire-to-chat into less than one screen of scrolling;
  // keep the reading time for the conversations and ending unchanged.
  const distance = scrollProgress * STORY_SCREENS;
  const position = played(distance);
  const timeline = Math.min(1, position <= .95
    ? (position / .95) * .385
    : .385 + ((position - .95) / 3.45) * .615);
  // Each pause moves its subject aside and fades its caption into the space.
  // On wide screens the fire starts right of centre, beside the page's intro text,
  // and slides back to the middle as the story gets going.
  const fireShift = stage.clientWidth >= WIDE_SCREEN ? stage.clientWidth * .2 * (1 - smooth(distance / .45)) : 0;
  const canPaused = smooth((distance - (CAN_PAUSE - .07)) / .15);
  let canShift = 0;
  if (canPaused > 0) {
    const [captionTop, canTop] = stack(canCaption.offsetHeight, (CAN_BOTTOM - CAN_TOP) * compositionScale);
    const restingCanTop = stage.clientHeight / 2 + (CAN_TOP - height / 2) * compositionScale;
    canCaption.style.top = `${captionTop}px`;
    canShift = canPaused * (canTop - restingCanTop);
  }
  composition.style.translate = `${fireShift}px ${canShift}px`;
  showCaption(canCaption, canPaused * (1 - smooth((distance - (CAN_PAUSE + CAN_HOLD - .15)) / .15)));
  const chatPaused = smooth((distance - (CHAT_PAUSE - .05)) / .15);
  if (chatPaused > 0) {
    const [chatTop, captionTop] = stack(returning.offsetHeight, chatCaption.offsetHeight);
    const restingChatTop = (stage.clientHeight - returning.offsetHeight) / 2;
    chatCaption.style.top = `${captionTop}px`;
    returning.style.translate = `0 ${chatPaused * (chatTop - restingChatTop)}px`;
  } else returning.style.translate = '';
  showCaption(chatCaption, chatPaused * (1 - smooth((distance - (CHAT_PAUSE + CHAT_HOLD - .15)) / .15)));
  showCaption(signCaption, smooth((distance - (TIMELINE_SCREENS - .1)) / .2));
  const exit = smooth((distance - EXIT_START) / (EXIT_END - EXIT_START));
  stage.style.opacity = 1 - exit;
  stage.style.visibility = exit > .99 ? 'hidden' : 'visible';
  const disposal = clamp(timeline / .32);
  const gather = smooth(disposal / .28);
  const drop = smooth((disposal - .25) / .44);
  const size = 1 - gather * .52 - drop * .30;
  const descent = -210 * gather + 250 * drop;
  burning.style.transform = `translateY(${descent}px) scale(${size})`;
  burning.style.opacity = 1 - smooth((disposal - .64) / .075);
  burningWindow.style.clipPath = disposal > .18 ? 'inset(0 0 80px 0)' : 'none';
  burning.setAttribute('aria-hidden', disposal > .715 ? 'true' : 'false');
  can.render(disposal);
  const canExit = smooth((timeline - .30) / .07);
  composition.style.opacity = 1 - canExit;
  composition.setAttribute('aria-hidden', canExit > .99 ? 'true' : 'false');

  const chatExit = smooth((timeline - .845) / .10);
  const chatVisible = smooth((timeline - .365) / .025) * (1 - chatExit);
  conversation.style.opacity = chatVisible;
  conversation.setAttribute('aria-hidden', chatVisible < .02 ? 'true' : 'false');
  const raveExit = smooth((timeline - .575) / .06);
  raving.style.opacity = 1 - raveExit;
  raving.style.transform = `translate(-50%, calc(-50% - ${raveExit * 38}px))`;
  raving.setAttribute('aria-hidden', timeline < .375 || raveExit > .98 ? 'true' : 'false');
  const returnEnter = smooth((timeline - .635) / .025);
  returning.style.opacity = returnEnter;
  returning.setAttribute('aria-hidden', returnEnter < .02 || chatExit > .98 ? 'true' : 'false');
  messages.forEach(message => {
    const reveal = smooth((timeline - Number(message.dataset.at)) / .026);
    message.style.opacity = reveal;
    message.style.transform = `translateY(${(1 - reveal) * 24}px) scale(${.96 + reveal * .04})`;
    message.setAttribute('aria-hidden', reveal < .02 ? 'true' : 'false');
  });
  const closed = smooth((timeline - .93) / .055);
  ending.style.opacity = closed;
  ending.setAttribute('aria-hidden', closed < .02 ? 'true' : 'false');
  sign.style.transform = motion.matches ? 'none' : `translateY(${(1 - closed) * 36}px)`;
  if (closed > 0) {
    const [captionTop, signTop] = stack(signCaption.offsetHeight, sign.offsetHeight);
    signCaption.style.top = `${captionTop}px`;
    sign.style.top = `${signTop}px`;
  }
  if (now - lastFrame < 50) return;
  const delta = previous ? Math.min((now - previous) / 1000, .1) : 0;
  previous = now; lastFrame = now;
  if (!motion.matches) time += delta;
  ctx.clearRect(0, 0, width, height);
  foreground.clearRect(0, 0, width, height);
  if (disposal < .72) { drawSmoke(time); drawFire(time); drawEmbers(time); }
}
frame = requestAnimationFrame(animate);

return () => {
  cancelAnimationFrame(frame);
  removeEventListener('scroll', readScroll);
  removeEventListener('resize', resize);
  root.removeEventListener('click', onGoto);
  can.dispose();
};
}
