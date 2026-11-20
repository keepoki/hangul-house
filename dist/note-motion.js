const traceWindows = {
  roof: [0.08, 0.46],
  frame: [0.19, 0.58],
  eaves: [0.27, 0.67],
  window: [0.38, 0.78],
};
const clampNoteProgress = value => Math.max(0, Math.min(1, value));

export function watchNoteMotion() {
  const preference = matchMedia('(prefers-reduced-motion: no-preference) and (min-height: 480px)');
  const root = document.documentElement;
  const runway = document.querySelector('.notes-transition');
  const eligible = () => preference.matches && ['3d', 'images'].includes(root.dataset.view);
  let motionModule;
  let disable;

  async function sync() {
    if (!eligible()) {
      disable?.();
      disable = undefined;
      return;
    }
    const { animate } = await (motionModule ??= import('./assets/motion-mini.js'));
    if (eligible() && !disable) disable = animateNotes(animate, runway);
  }

  const update = () => { sync().catch(() => {}); };
  preference.addEventListener('change', update);
  new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-view'] });
  update();
}

function animateNotes(animate, runway) {
  const scene = runway.querySelector('.notes-scene');
  const tracks = [];
  function track(selector, keyframes, from, to) {
    const elements = [...runway.querySelectorAll(selector)];
    const motion = animate(elements, keyframes, { autoplay: false, duration: 1, ease: 'linear' });
    tracks.push({ motion, from, to });
  }

  track('.notes-art', { transform: ['scale(1.13)', 'scale(1)'] }, 0, 0.85);
  track('.notes-house', { opacity: [1, 0.07] }, 0.21, 0.81);
  track('.notes-grid', { opacity: [0, 0.44] }, 0.29, 0.87);
  for (const [part, [from, to]] of Object.entries(traceWindows)) {
    const selector = '[data-trace="' + part + '"]';
    track(selector, { strokeDashoffset: [1, 0] }, from, to);
  }
  track('.notes-labels', { opacity: [0, 1] }, 0.57, 0.87);

  let frame = 0;
  let previous = -1;
  function draw() {
    frame = 0;
    const sceneHeight = scene.clientHeight;
    const lead = sceneHeight * 0.36;
    const hold = runway.clientHeight - sceneHeight;
    const progress = clampNoteProgress((lead - runway.getBoundingClientRect().top) / (lead + hold));
    if (progress === previous) return;
    previous = progress;
    for (const { motion, from, to } of tracks) {
      motion.time = clampNoteProgress((progress - from) / (to - from)) * motion.duration;
    }
  }

  function queueDraw() {
    if (!frame) frame = requestAnimationFrame(draw);
  }

  runway.dataset.notesMotion = '';
  draw();
  addEventListener('scroll', queueDraw, { passive: true });
  addEventListener('resize', queueDraw);

  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('scroll', queueDraw);
    removeEventListener('resize', queueDraw);
    tracks.forEach(({ motion }) => motion.cancel());
    delete runway.dataset.notesMotion;
  };
}
