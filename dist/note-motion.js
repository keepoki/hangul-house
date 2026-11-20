const noteEase = [0.22, 1, 0.36, 1];
const detailScale = 'scale(1.16)';

export function watchNoteMotion() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet();
  let motionModule;
  let disable;

  async function applyPreference() {
    if (reduced.matches) {
      disable?.();
      disable = undefined;
      return;
    }
    const { animate } = await (motionModule ??= import('./assets/motion-mini.js'));
    if (!reduced.matches && !disable) disable = animateNotes(animate, seen);
  }

  const update = () => { applyPreference().catch(() => {}); };
  reduced.addEventListener('change', update);
  update();
}

function animateNotes(animate, seen) {
  const arrivals = new Map();
  const entrance = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const plate = entry.target;
      entrance.unobserve(plate);
      seen.add(plate);
      const animation = animate(plate, { clipPath: ['inset(0 0 12% 0)', 'inset(0)'], opacity: [0.76, 1] }, {
        duration: 0.58, ease: noteEase,
      });
      arrivals.set(plate, animation);
      animation.then(() => {
        plate.style.removeProperty('clip-path');
        plate.style.removeProperty('opacity');
        arrivals.delete(plate);
      });
    }
  }, { threshold: 0.15 });

  const cleanups = [...document.querySelectorAll('.text-room')].map(room => {
    const plate = room.querySelector('.note-plate');
    const photo = plate.querySelector('img');
    const marker = plate.querySelector('.note-marker');
    const detail = room.querySelector('.note-observation');
    let zoom;
    let accent;
    if (detail.open) photo.style.transform = detailScale;
    if (!detail.open && !seen.has(plate)) entrance.observe(plate);

    function focusDetail() {
      const previous = getComputedStyle(photo).transform;
      zoom?.cancel();
      accent?.cancel();
      zoom = animate(photo, { transform: [previous, detail.open ? detailScale : 'none'] }, {
        duration: detail.open ? 0.56 : 0.38, ease: noteEase,
      });
      if (detail.open) accent = animate(marker, { scale: [1.75, 1] }, { duration: 0.46, ease: noteEase });
    }

    detail.addEventListener('toggle', focusDetail);
    return () => {
      detail.removeEventListener('toggle', focusDetail);
      zoom?.cancel();
      accent?.cancel();
      photo.style.removeProperty('transform');
      marker.style.removeProperty('scale');
    };
  });

  return () => {
    entrance.disconnect();
    for (const [plate, animation] of arrivals) {
      animation.cancel();
      plate.style.removeProperty('clip-path');
      plate.style.removeProperty('opacity');
    }
    arrivals.clear();
    cleanups.forEach(cleanup => cleanup());
  };
}
