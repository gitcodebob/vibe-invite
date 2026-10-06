// Alle beweging op de pagina. Wie in het systeem minder beweging heeft ingesteld, krijgt overal
// meteen de eindtoestand. Niets beweegt langer dan 5 seconden achter elkaar (WCAG 2.2.2).
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Secties verschijnen bij het scrollen ----------
const revealItems = document.querySelectorAll('.reveal');
if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  for (const el of revealItems) el.classList.add('is-visible');
} else {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  for (const el of revealItems) observer.observe(el);
}

// ---------- Demo: een prompt wordt een live app ----------
const demo = document.getElementById('demo-figuur');
const typed = demo.querySelector('.demo__typed');
const steps = [...demo.querySelectorAll('.demo__steps li')];
const replay = document.getElementById('demo-replay');
const PROMPT = typed.textContent;
let run = 0;

function showFinal() {
  run++;
  demo.classList.remove('is-armed', 'is-typing', 'is-live');
  typed.textContent = PROMPT;
}

async function play() {
  const id = ++run;
  const cancelled = () => id !== run;
  demo.classList.add('is-armed', 'is-typing');
  demo.classList.remove('is-live');
  for (const step of steps) step.classList.remove('is-done');

  for (let i = 1; i <= PROMPT.length; i++) {
    typed.textContent = PROMPT.slice(0, i);
    await sleep(22);
    if (cancelled()) return;
  }
  demo.classList.remove('is-typing');
  for (const step of steps) {
    await sleep(380);
    if (cancelled()) return;
    step.classList.add('is-done');
  }
  await sleep(200);
  if (!cancelled()) demo.classList.add('is-live');
}

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  // Klaarzetten in de begintoestand en afspelen zodra de demo goed in beeld is.
  demo.classList.add('is-armed');
  typed.textContent = '';
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    play();
  }, { threshold: 0.5 });
  observer.observe(demo);
  replay.hidden = false;
  replay.addEventListener('click', play);
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    showFinal();
    replay.hidden = true;
  }
});

// ---------- Confetti bij een geactiveerde code ----------
const COLORS = ['#f8e800', '#ff9774', '#ffffff', '#c9d1d8', '#242f36'];

export function celebrate(fromElement) {
  if (reducedMotion.matches || !Element.prototype.animate) return;
  const layer = document.getElementById('confetti');
  const box = fromElement.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + 60;

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('span');
    const size = 6 + Math.random() * 8;
    piece.style.width = `${size}px`;
    piece.style.height = `${size * (0.4 + Math.random() * 0.6)}px`;
    piece.style.background = COLORS[i % COLORS.length];
    layer.append(piece);

    const angle = Math.random() * Math.PI * 2;
    const speed = 120 + Math.random() * 260;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 160;
    piece.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${x + dx}px, ${y + dy}px) rotate(${Math.random() * 720 - 360}deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${x + dx * 1.2}px, ${y + dy + 420}px) rotate(${Math.random() * 1080}deg)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2, .6, .4, 1)', fill: 'forwards' })
      .finished.then(() => piece.remove());
  }
}
