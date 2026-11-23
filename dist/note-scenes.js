const clampRoomProgress = value => Math.min(1, Math.max(0, value));
const roomInterval = (value, start, end) => clampRoomProgress((value - start) / (end - start));

export function noteScrollProgress(top, height) {
  return height > 0 ? clampRoomProgress((0.8 * height - top) / (0.62 * height)) : 0;
}

export function strokeSpritePosition(progress, columns = 4, loop = false) {
  const poses = columns * columns;
  const frame = Math.round(clampRoomProgress(progress) * poses);
  if (frame === 0 || (loop && frame === poses)) return null;
  const tile = frame - 1;
  const step = columns - 1;
  return (tile % columns * 100 / step) + '% ' + (Math.floor(tile / columns) * 100 / step) + '%';
}

const roomEffects = {
  stone(p) {
    return {
      '--post': roomInterval(p, 0, .52),
      '--eave': roomInterval(p, .21, .93),
      '--joined': roomInterval(p, .68, 1),
      '--joint': Math.sin(p * Math.PI) * .9
    };
  },
  water(p) {
    const opening = roomInterval(p, .05, .49);
    const expansion = roomInterval(p, .54, 1);
    return {
      '--round-width': (10.4 * opening + 69.6 * expansion) + '%',
      '--round-height': (18.1 * opening + 81.9 * expansion) + '%',
      '--round-shift': (-17 * (1 - expansion)) + '%',
      '--round-scale': 1 + .09 * (1 - expansion)
    };
  },
  wood(p) {
    return {
      '--opening': roomInterval(p, .16, .94),
      '--entry-scale': 1.35 - .35 * p
    };
  },
  light(p) {
    return {
      '--light-gap': roomInterval(p, .07, .46),
      '--light-brass': roomInterval(p, .56, 1)
    };
  }
};

async function prepareNoteArt(art) {
  const layers = [...art.querySelectorAll('[data-src], [data-note-sprite]')];
  await Promise.all(layers.map(async layer => {
    const src = layer.dataset.src ?? layer.dataset.noteSprite;
    const image = new Image();
    image.src = src;
    await image.decode();
    layer.style.backgroundImage = 'url("' + src + '")';
  }));
}

export function watchNoteScenes() {
  const preference = matchMedia('(prefers-reduced-motion: no-preference)');
  const plates = new Map([...document.querySelectorAll('[data-note-scene]')].map(plate => {
    const sprite = plate.querySelector('[data-note-sprite]');
    const columns = Number(sprite?.dataset.noteColumns ?? 4);
    if (sprite && columns !== 4) sprite.style.backgroundSize = (columns * 100) + '% ' + (columns * 100) + '%';
    return [plate, {
      art: plate.querySelector('.note-motion-art'),
      sprite,
      columns,
      loop: sprite?.hasAttribute('data-note-loop'),
      scene: plate.dataset.noteScene,
      previous: -1
    }];
  }));
  const nearby = new Set();
  let frame = 0;

  function draw() {
    frame = 0;
    const height = document.documentElement.clientHeight;
    for (const plate of nearby) {
      const state = plates.get(plate);
      if (!state.ready) continue;
      const progress = noteScrollProgress(plate.getBoundingClientRect().top, height);
      if (progress === state.previous) continue;
      state.previous = progress;
      if (state.sprite) {
        const position = strokeSpritePosition(progress, state.columns, state.loop);
        state.sprite.hidden = position === null;
        if (position !== null) state.sprite.style.backgroundPosition = position;
      } else {
        const properties = roomEffects[state.scene](progress);
        for (const [name, value] of Object.entries(properties)) state.art.style.setProperty(name, value);
      }
      plate.dataset.noteReady = '';
    }
  }

  function queue() {
    if (nearby.size && !frame) frame = requestAnimationFrame(draw);
  }

  const observer = new IntersectionObserver(entries => {
    if (!preference.matches) return;
    for (const entry of entries) {
      const plate = entry.target;
      if (!entry.isIntersecting) {
        nearby.delete(plate);
        continue;
      }
      nearby.add(plate);
      const state = plates.get(plate);
      state.pending ??= prepareNoteArt(state.art).then(() => {
        state.ready = true;
        queue();
      }).catch(() => {
        // Keep the original responsive photograph if an effect asset fails.
      });
    }
    queue();
  }, { rootMargin: '360px 0px' });

  function sync() {
    if (preference.matches) {
      plates.forEach((_, plate) => observer.observe(plate));
      addEventListener('scroll', queue, { passive: true });
      addEventListener('resize', queue);
    } else {
      observer.disconnect();
      nearby.clear();
      cancelAnimationFrame(frame);
      frame = 0;
      plates.forEach((state, plate) => {
        state.previous = -1;
        delete plate.dataset.noteReady;
      });
      removeEventListener('scroll', queue);
      removeEventListener('resize', queue);
    }
  }

  preference.addEventListener('change', sync);
  sync();
}
