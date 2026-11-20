import test from 'node:test';
import assert from 'node:assert/strict';
import {createImageTour} from '../dist/image-tour.js';
import {fixture} from './dom-fixture.mjs';

function setup(){
  const f=fixture();Object.assign(f.window,{innerHeight:800,scrollY:0,scrollTo({top}){this.scrollY=top;}});f.document.documentElement.scrollHeight=8000;f.document.documentElement.dataset.view='images';
  f.document.baseURI='https://example.test/';
  f.$('gallery-image-mobile').media='(orientation: portrait)';
  f.window.matchMedia=()=>({matches:true});
  const tour=createImageTour({document:f.document,window:f.window});tour.resume();return{f,tour};
}
test('image navigation shows the same water room and matching portrait asset',()=>{
  const {f,tour}=setup();tour.goTo(.26);
  assert.equal(f.$('gallery-image').src,'./assets/gallery/water.jpg');assert.equal(f.$('gallery-image-mobile').srcset,'./assets/gallery/water-mobile.jpg');
  assert.match(f.$('gallery-image').alt,/자연석/);assert.match(f.$('view-label').textContent,/^물의 뜰/);assert.equal(tour.getProgress(),.26);
  assert.equal(f.window.scrollY,1872);
});
test('the final stop selects a separate frontal still and retains the workshop entry',()=>{
  const {f,tour}=setup();
  assert.equal(f.$('gallery-image').src,'./assets/gallery/house.jpg');
  assert.equal(f.$('story-start').hidden,false);
  tour.goTo(1);
  assert.equal(f.$('story-start').hidden,true);
  assert.equal(f.$('gallery-image').src,'./assets/gallery/finale.jpg');
  assert.equal(f.$('gallery-image-mobile').srcset,'./assets/gallery/finale-mobile.jpg');
  assert.match(f.$('gallery-image').alt,/정면/);
  assert.equal(f.$('story-action').hidden,false);
});
test('pausing image viewing prevents its scroll handler from overwriting 3D captions',()=>{
  const {f,tour}=setup();tour.goTo(.26);tour.pause();f.window.scrollY=6000;f.fire(f.window,'scroll');
  assert.match(f.$('view-label').textContent,/^물의 뜰/);assert.equal(tour.getProgress(),.26);
});
test('image zoom has bounded controls and navigation restores the unzoomed scene',()=>{
  const {f,tour}=setup();tour.setZoom(5);assert.equal(f.$('zoom-in').disabled,true);assert.equal(f.$('gallery-image').style.transform,'scale(1.8)');
  tour.goTo(.39);assert.equal(f.$('zoom-value').textContent,'100%');assert.equal(f.$('zoom-in').disabled,false);
});
test('image navigation brings the current stop into a clipped strip',()=>{
  const {f,tour}=setup(),button=f.groups['[data-stop]'][7];
  const nav={clientWidth:270,scrollWidth:390,scrollLeft:0,clientLeft:0,getBoundingClientRect:()=>({left:16})};
  button.parentElement=nav;
  button.getBoundingClientRect=()=>({left:345,right:389});
  tour.goTo(1);
  assert.equal(button.attrs['aria-current'],'step');
  assert.ok(nav.scrollLeft>0);
});
test('retrying the portrait image keeps the landscape source and survives a resize',()=>{
  const {f,tour}=setup(),image=f.$('gallery-image'),source=f.$('gallery-image-mobile');
  tour.goTo(.26);
  f.fire(image,'error');
  f.fire(f.$('retry-image'),'click');
  assert.match(source.srcset,/water-mobile\.jpg\?retry=\d+/);
  assert.equal(image.src,'./assets/gallery/water.jpg');
  const retried=source.srcset;
  f.fire(f.window,'resize');
  assert.equal(source.srcset,retried);
});
test('retrying a landscape image keeps the portrait source for rotation',()=>{
  const {f,tour}=setup(),image=f.$('gallery-image'),source=f.$('gallery-image-mobile');
  f.window.matchMedia=()=>({matches:false});
  tour.goTo(.26);
  f.fire(image,'error');
  f.fire(f.$('retry-image'),'click');
  assert.match(image.src,/water\.jpg\?retry=\d+/);
  assert.equal(source.srcset,'./assets/gallery/water-mobile.jpg');
});
