import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { noteScrollProgress, strokeSpritePosition } from '../dist/note-scenes.js';

test('scroll progresses and rewinds within the visible note image', () => {
  assert.deepEqual([900, 640, 392, 144, -220].map(top => noteScrollProgress(top, 800)), [0, 0, .5, 1, 1]);
  assert.equal(noteScrollProgress(320, 0), 0);
});

test('stroke poses seek the correct tile including the edge-on and finished views', () => {
  assert.equal(strokeSpritePosition(0), null);
  assert.equal(strokeSpritePosition(1 / 16), '0% 0%');
  assert.equal(strokeSpritePosition(.5), '100% 33.333333333333336%');
  assert.equal(strokeSpritePosition(1), '100% 100%');
});

test('each note has a readable still and self-hosted scroll art, with no extra controls', async () => {
  const root = new URL('../dist/', import.meta.url);
  const html = await readFile(new URL('index.html', root), 'utf8');
  const figures = [...html.matchAll(/<figure class="note-plate" data-note-scene="(\w+)">([\s\S]*?)<\/figure>/g)];
  assert.deepEqual(figures.map(([, room]) => room), ['stone','water','wood','light','garden','quiet']);
  for (const [, room, figure] of figures) {
    assert.match(figure, /<picture>[\s\S]*?loading="lazy"[\s\S]*?alt="[^"]+"/, room);
    assert.match(figure, /<div class="note-motion-art" aria-hidden="true">/, room);
    assert.doesNotMatch(figure, /<(input|button|video)\b/, room);
    const assets = [...figure.matchAll(/data-(?:src|note-sprite)="\.\/(assets\/[^"]+)"/g)];
    assert.ok(assets.length >= 2, room);
    for (const [, file] of assets) {
      await access(new URL(file, root));
    }
  }
});
