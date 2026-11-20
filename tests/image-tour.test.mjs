import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageTour} from '../dist/image-tour.js';
import {fixture} from './dom-fixture.mjs';

function setup(){
  const f=fixture();Object.assign(f.window,{innerHeight:800,scrollY:0,scrollTo({top}){this.scrollY=top;}});f.document.documentElement.scrollHeight=8000;f.document.documentElement.dataset.view='images';
  const tour=createImageTour({document:f.document,window:f.window});tour.resume();return{f,tour};
}
test('image navigation shows the same water room and matching portrait asset',()=>{
  const {f,tour}=setup();tour.goTo(.26);
  assert.equal(f.$('gallery-image').src,'./assets/gallery/water.jpg');assert.equal(f.$('gallery-image-mobile').srcset,'./assets/gallery/water-mobile.jpg');
  assert.match(f.$('gallery-image').alt,/자연석/);assert.match(f.$('view-label').textContent,/^물의 뜰/);assert.equal(tour.getProgress(),.26);
  assert.equal(f.window.scrollY,1872);
});
test('pausing image viewing prevents its scroll handler from overwriting 3D captions',()=>{
  const {f,tour}=setup();tour.goTo(.26);tour.pause();f.window.scrollY=6000;f.fire(f.window,'scroll');
  assert.match(f.$('view-label').textContent,/^물의 뜰/);assert.equal(tour.getProgress(),.26);
});
test('image zoom has bounded controls and navigation restores the unzoomed scene',()=>{
  const {f,tour}=setup();tour.setZoom(5);assert.equal(f.$('zoom-in').disabled,true);assert.equal(f.$('gallery-image').style.transform,'scale(1.8)');
  tour.goTo(.39);assert.equal(f.$('zoom-value').textContent,'100%');assert.equal(f.$('zoom-in').disabled,false);
});
