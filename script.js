// Implements fixes:
// - Canonical repacking of tens frames after any tens-changing action
//   so 34 tens always displays as 10+10+10+4 (not 9/9/9/7).
// - Repacking is animated via existing FLIP (cube-level), so sticks slide instead of snapping.

const els = {
  numberInput: document.getElementById('numberInput'),
  buildBtn: document.getElementById('buildBtn'),
  composeBtn: document.getElementById('composeBtn'),
  decomposeBtn: document.getElementById('decomposeBtn'),
  lockBadge: document.getElementById('lockBadge'),
  valueText: document.getElementById('valueText'),
  helpText: document.getElementById('helpText'),
  onesFrames: document.getElementById('onesFrames'),
  tensFrames: document.getElementById('tensFrames'),
  hundredsArea: document.getElementById('hundredsArea'),
  animLayer: document.getElementById('animLayer'),
};

let mode = 'compose';
let locked = false;

const state = {
  nextCubeId: 1,
  nextStickId: 1,
  nextHundredId: 1,

  // Explicit frame structure:
  onesFrames: [],      // Cube[][]
  tensFrames: [],      // Stick[][]
  hundreds: [],        // {id, sticks: Stick[10]}[]
};

function setLocked(v){
  locked = v;
  els.lockBadge.classList.toggle('hidden', !locked);
  els.buildBtn.disabled = locked;
  els.numberInput.disabled = locked;
  els.composeBtn.disabled = locked;
  els.decomposeBtn.disabled = locked;
}

function setMode(m){
  mode = m;
  els.composeBtn.classList.toggle('active', mode === 'compose');
  els.decomposeBtn.classList.toggle('active', mode === 'decompose');
  els.helpText.textContent =
    mode === 'compose'
      ? 'Compose: click a full frame.'
      : 'Decompose: click a ten-stick or a hundred.';
}

els.composeBtn.addEventListener('click', () => { if(!locked) setMode('compose'); });
els.decomposeBtn.addEventListener('click', () => { if(!locked) setMode('decompose'); });

els.buildBtn.addEventListener('click', () => {
  if(locked) return;
  const n = clampInt(parseInt(els.numberInput.value || '0', 10), 0, 999);
  buildNumber(n);
});

// ---------- Types ----------
function makeCube(){
  const id = state.nextCubeId++;
  const el = document.createElement('div');
  el.className = 'cube';
  el.dataset.cubeId = String(id);
  return { id, el };
}

function makeStick(cubes){
  return { id: state.nextStickId++, cubes };
}

function makeHundred(sticks){
  return { id: state.nextHundredId++, sticks };
}

// ---------- Utils ----------
function clampInt(n, min, max){
  if(Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function chunk(arr, size){
  const out = [];
  for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size));
  if(out.length === 0) out.push([]);
  return out;
}

function clear(el){ el.innerHTML = ''; }

function flattenCubes(){
  const out = [];
  for(const frame of state.onesFrames) for(const c of frame) out.push(c);
  for(const tframe of state.tensFrames) for(const st of tframe) for(const c of st.cubes) out.push(c);
  for(const h of state.hundreds) for(const st of h.sticks) for(const c of st.cubes) out.push(c);
  return out;
}

function flattenTensSticks(){
  // Canonical order: frame order, then slot order
  const sticks = [];
  for(const frame of state.tensFrames){
    for(const st of frame) sticks.push(st);
  }
  return sticks;
}

function canonicalizeTensFrames(){
  // Treat frames as DISPLAY ONLY.
  // Pack sticks as full frames as possible: 10,10,10,4...
  const sticks = flattenTensSticks();
  state.tensFrames = chunk(sticks, 10);
  if(state.tensFrames.length === 0) state.tensFrames = [[]];
}

function countValue(){
  const hundreds = state.hundreds.length;
  const tens = state.tensFrames.reduce((a,f)=>a+f.length, 0);
  const ones = state.onesFrames.reduce((a,f)=>a+f.length, 0);
  return { hundreds, tens, ones };
}

function updateReadout(){
  const { hundreds, tens, ones } = countValue();
  els.valueText.textContent = `${hundreds} hundreds, ${tens} tens, ${ones} ones`;
}

// ---------- Build (no animation) ----------
function buildNumber(n){
  const current = flattenCubes().sort((a,b)=>a.id-b.id);

  if(current.length < n){
    const add = n - current.length;
    for(let i=0;i<add;i++) current.push(makeCube());
  } else if(current.length > n){
    const remove = current.length - n;
    for(let i=0;i<remove;i++){
      const c = current.pop();
      c.el.remove();
    }
  }

  state.onesFrames = [];
  state.tensFrames = [];
  state.hundreds = [];

  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;

  let idx = 0;

  // Hundreds
  for(let i=0;i<h;i++){
    const sticks = [];
    for(let s=0;s<10;s++){
      const cubes = current.slice(idx, idx+10);
      idx += 10;
      sticks.push(makeStick(cubes));
    }
    state.hundreds.push(makeHundred(sticks));
  }

  // Tens
  const tensSticks = [];
  for(let i=0;i<t;i++){
    const cubes = current.slice(idx, idx+10);
    idx += 10;
    tensSticks.push(makeStick(cubes));
  }
  state.tensFrames = chunk(tensSticks, 10);
  canonicalizeTensFrames();

  // Ones
  const onesCubes = current.slice(idx, idx+o);
  state.onesFrames = chunk(onesCubes, 10);
  if(state.onesFrames.length === 0) state.onesFrames = [[]];

  renderAll();
}

// ---------- Rendering ----------
function renderAll(){
  renderHundreds();
  renderTensFrames();
  renderOnesFrames();
  updateReadout();
}

function renderOnesFrames(){
  clear(els.onesFrames);
  if(state.onesFrames.length === 0) state.onesFrames.push([]);

  state.onesFrames.forEach((frameCubes, frameIndex) => {
    const frameEl = document.createElement('div');
    frameEl.className = 'frame ones';
    if(frameCubes.length === 10) frameEl.classList.add('full');

    const slots = [];
    for(let i=0;i<10;i++){
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.kind = 'one-slot';
      slot.dataset.frameIndex = String(frameIndex);
      slot.dataset.slotIndex = String(i);
      frameEl.appendChild(slot);
      slots.push(slot);
    }

    for(let i=0;i<frameCubes.length;i++){
      slots[i].appendChild(frameCubes[i].el);
    }

    frameEl.addEventListener('click', () => {
      if(locked) return;
      if(mode !== 'compose') return;
      if(frameCubes.length !== 10) return;
      composeOnesFrameToTen(frameIndex);
    });

    els.onesFrames.appendChild(frameEl);
  });
}

function renderTensFrames(){
  clear(els.tensFrames);
  if(state.tensFrames.length === 0) state.tensFrames.push([]);

  state.tensFrames.forEach((frameSticks, frameIndex) => {
    const frameEl = document.createElement('div');
    frameEl.className = 'frame tens';
    if(frameSticks.length === 10) frameEl.classList.add('full');

    const slots = [];
    for(let i=0;i<10;i++){
      const slot = document.createElement('div');
      slot.className = 'ten-slot';
      slot.dataset.kind = 'ten-slot';
      slot.dataset.frameIndex = String(frameIndex);
      slot.dataset.slotIndex = String(i);
      frameEl.appendChild(slot);
      slots.push(slot);
    }

    for(let i=0;i<frameSticks.length;i++){
      const stickEl = createTenStickElement(frameSticks[i], { inHundred: false });
      slots[i].appendChild(stickEl);
    }

    frameEl.addEventListener('click', () => {
      if(locked) return;
      if(mode !== 'compose') return;
      if(frameSticks.length !== 10) return;
      composeTensFrameToHundred(frameIndex);
    });

    els.tensFrames.appendChild(frameEl);
  });
}

function renderHundreds(){
  clear(els.hundredsArea);

  state.hundreds.forEach((hundred) => {
    const hundredEl = document.createElement('div');
    hundredEl.className = 'hundred';
    hundredEl.dataset.hundredId = String(hundred.id);

    for(const stick of hundred.sticks){
      const stickEl = createTenStickElement(stick, { inHundred: true });
      hundredEl.appendChild(stickEl);
    }

    hundredEl.addEventListener('click', () => {
      if(locked) return;
      if(mode !== 'decompose') return;
      decomposeHundredToTens(hundred.id);
    });

    els.hundredsArea.appendChild(hundredEl);
  });
}

function createTenStickElement(stick, { inHundred }){
  const stickEl = document.createElement('div');
  stickEl.className = 'ten-stick';
  stickEl.dataset.stickId = String(stick.id);
  stickEl.dataset.inHundred = inHundred ? 'true' : 'false';

  const slots = [];
  for(let i=0;i<10;i++){
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.kind = 'ten-cube-slot';
    slot.dataset.slotIndex = String(i);
    stickEl.appendChild(slot);
    slots.push(slot);
  }
  for(let i=0;i<10;i++){
    slots[i].appendChild(stick.cubes[i].el);
  }

  stickEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
    if(locked) return;
    if(mode !== 'decompose') return;
    if(stickEl.dataset.inHundred === 'true') return;
    decomposeTenToOnes(stick.id);
  });

  return stickEl;
}

// ---------- Animation helpers ----------
function rectOf(el){
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

function captureCubeRects(){
  const rects = new Map();
  for(const c of flattenCubes()){
    rects.set(c.id, rectOf(c.el));
  }
  return rects;
}

function playFlip(before, after, excludeIds = new Set(), durationMs = 260){
  const anims = [];

  for(const [id, b] of before.entries()){
    if(excludeIds.has(id)) continue;
    const a = after.get(id);
    if(!a) continue;

    const dx = b.left - a.left;
    const dy = b.top - a.top;
    if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

    const el = document.querySelector(`.cube[data-cube-id="${id}"]`);
    if(!el) continue;

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    anims.push(el);
  }

  if(anims.length === 0) return;

  requestAnimationFrame(() => {
    for(const el of anims){
      el.style.transition = `transform ${durationMs}ms ease`;
      el.style.transform = 'translate(0px, 0px)';
    }
    window.setTimeout(() => {
      for(const el of anims){
        el.style.transition = '';
        el.style.transform = '';
      }
    }, durationMs + 30);
  });
}

function moveToAnimLayer(cubeEl){
  const r = rectOf(cubeEl);
  els.animLayer.appendChild(cubeEl);
  cubeEl.style.position = 'fixed';
  cubeEl.style.left = `${r.left}px`;
  cubeEl.style.top = `${r.top}px`;
  cubeEl.style.width = `${r.width}px`;
  cubeEl.style.height = `${r.height}px`;
  cubeEl.style.transition = 'none';
  cubeEl.style.zIndex = '10000';
}

function cleanupAnimLayer(){
  const leftovers = Array.from(els.animLayer.querySelectorAll('.cube'));
  for(const el of leftovers){
    el.style.transition = '';
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    el.style.zIndex = '';
  }
  els.animLayer.innerHTML = '';
}

function animateCubesToSlots(cubes, targetSlots, durationMs = 450){
  return new Promise((resolve) => {
    const cubeEls = cubes.map(c => c.el);
    cubeEls.forEach(moveToAnimLayer);

    const targets = targetSlots.map(s => rectOf(s));

    requestAnimationFrame(() => {
      cubeEls.forEach((el, i) => {
        el.style.transition = `left ${durationMs}ms ease, top ${durationMs}ms ease`;
        el.style.left = `${targets[i].left}px`;
        el.style.top = `${targets[i].top}px`;
      });
      window.setTimeout(() => resolve(), durationMs + 30);
    });
  });
}

function attachCubesToSlots(cubes, slots){
  for(let i=0;i<cubes.length;i++){
    const el = cubes[i].el;
    el.style.transition = '';
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    el.style.zIndex = '';
    slots[i].appendChild(el);
  }
}

// ---------- Destination slot creation ----------
function createNewOnesFrameSlots(){
  const frameEl = document.createElement('div');
  frameEl.className = 'frame ones';
  const slots = [];
  for(let i=0;i<10;i++){
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.kind = 'one-slot';
    frameEl.appendChild(slot);
    slots.push(slot);
  }
  els.onesFrames.appendChild(frameEl);
  return slots;
}

function createNewTensFrameSlots(){
  const frameEl = document.createElement('div');
  frameEl.className = 'frame tens';
  const slots = [];
  for(let i=0;i<10;i++){
    const slot = document.createElement('div');
    slot.className = 'ten-slot';
    slot.dataset.kind = 'ten-slot';
    frameEl.appendChild(slot);
    slots.push(slot);
  }
  els.tensFrames.appendChild(frameEl);
  return slots;
}

function createDestinationTenStickSlotsInSpecificTenSlot(tenSlotEl){
  const stickEl = document.createElement('div');
  stickEl.className = 'ten-stick';

  const slots = [];
  for(let i=0;i<10;i++){
    const s = document.createElement('div');
    s.className = 'slot';
    stickEl.appendChild(s);
    slots.push(s);
  }
  tenSlotEl.appendChild(stickEl);
  return slots;
}

// ---------- Lookups ----------
function findStickById(stickId){
  for(let f=0; f<state.tensFrames.length; f++){
    for(let i=0; i<state.tensFrames[f].length; i++){
      const st = state.tensFrames[f][i];
      if(st.id === stickId) return { frameIndex: f, slotIndex: i, stick: st };
    }
  }
  return null;
}

function findHundredById(hundredId){
  const idx = state.hundreds.findIndex(h => h.id === hundredId);
  return idx === -1 ? null : { index: idx, hundred: state.hundreds[idx] };
}

// ---------- Actions ----------
async function composeOnesFrameToTen(frameIndex){
  const frameCubes = state.onesFrames[frameIndex];
  if(!frameCubes || frameCubes.length !== 10) return;

  setLocked(true);

  renderTensFrames();
  let tenSlots = Array.from(els.tensFrames.querySelectorAll('.ten-slot'));
  let emptyTenSlot = tenSlots.find(s => s.children.length === 0);

  if(!emptyTenSlot){
    createNewTensFrameSlots();
    tenSlots = Array.from(els.tensFrames.querySelectorAll('.ten-slot'));
    emptyTenSlot = tenSlots.find(s => s.children.length === 0);
  }

  const destSlots = createDestinationTenStickSlotsInSpecificTenSlot(emptyTenSlot);

  await animateCubesToSlots(frameCubes, destSlots);
  attachCubesToSlots(frameCubes, destSlots);

  // Update state
  state.onesFrames.splice(frameIndex, 1);
  if(state.onesFrames.length === 0) state.onesFrames.push([]);

  const newStick = makeStick(frameCubes.slice().sort((a,b)=>a.id-b.id));

  // Append stick (we'll canonicalize right after)
  if(state.tensFrames.length === 0) state.tensFrames.push([]);
  state.tensFrames[state.tensFrames.length - 1].push(newStick);
  canonicalizeTensFrames(); // ✅ NEW

  // Animate everything else sliding into canonical place
  const before = captureCubeRects();
  renderAll();
  const after = captureCubeRects();
  playFlip(before, after, new Set(frameCubes.map(c=>c.id)));

  cleanupAnimLayer();
  setLocked(false);
}

async function decomposeTenToOnes(stickId){
  const found = findStickById(stickId);
  if(!found) return;

  setLocked(true);

  const stick = found.stick;
  const cubes = stick.cubes.slice();

  renderOnesFrames();
  const destSlots = createNewOnesFrameSlots();

  await animateCubesToSlots(cubes, destSlots);
  attachCubesToSlots(cubes, destSlots);

  // Update tens: remove stick
  state.tensFrames[found.frameIndex].splice(found.slotIndex, 1);
  canonicalizeTensFrames(); // ✅ NEW: repack tens into full frames

  // Append new ones frame with these cubes
  state.onesFrames.push(cubes.slice().sort((a,b)=>a.id-b.id));
  if(state.onesFrames.length === 0) state.onesFrames = [[]];

  const before = captureCubeRects();
  renderAll();
  const after = captureCubeRects();
  playFlip(before, after, new Set(cubes.map(c=>c.id)));

  cleanupAnimLayer();
  setLocked(false);
}

async function composeTensFrameToHundred(frameIndex){
  const frameSticks = state.tensFrames[frameIndex];
  if(!frameSticks || frameSticks.length !== 10) return;

  setLocked(true);

  renderHundreds();
  const hundredEl = document.createElement('div');
  hundredEl.className = 'hundred active-outline';

  const targetSlots = [];
  for(let s=0;s<10;s++){
    const stickEl = document.createElement('div');
    stickEl.className = 'ten-stick';
    for(let i=0;i<10;i++){
      const slot = document.createElement('div');
      slot.className = 'slot';
      stickEl.appendChild(slot);
      targetSlots.push(slot);
    }
    hundredEl.appendChild(stickEl);
  }
  els.hundredsArea.appendChild(hundredEl);

  const cubes = [];
  for(const st of frameSticks){
    const sorted = st.cubes.slice().sort((a,b)=>a.id-b.id);
    cubes.push(...sorted);
  }

  await animateCubesToSlots(cubes, targetSlots);
  attachCubesToSlots(cubes, targetSlots);

  // Update state: remove that tens frame
  state.tensFrames.splice(frameIndex, 1);
  canonicalizeTensFrames(); // ✅ NEW: repack remaining tens

  state.hundreds.push(makeHundred(frameSticks));

  const before = captureCubeRects();
  renderAll();
  const after = captureCubeRects();
  playFlip(before, after, new Set(cubes.map(c=>c.id)));

  cleanupAnimLayer();
  setLocked(false);
}

async function decomposeHundredToTens(hundredId){
  const found = findHundredById(hundredId);
  if(!found) return;

  setLocked(true);

  const hundred = found.hundred;
  const sticks = hundred.sticks.slice(); // 10 sticks

  renderTensFrames();
  const tenSlots = createNewTensFrameSlots();

  const allTargetSlots = [];
  for(let i=0;i<10;i++){
    const stickSlots = createDestinationTenStickSlotsInSpecificTenSlot(tenSlots[i]);
    allTargetSlots.push(...stickSlots);
  }

  const cubes = [];
  for(const st of sticks){
    const sorted = st.cubes.slice().sort((a,b)=>a.id-b.id);
    cubes.push(...sorted);
  }

  await animateCubesToSlots(cubes, allTargetSlots);
  attachCubesToSlots(cubes, allTargetSlots);

  // Update: remove hundred, add its sticks to tens, then canonicalize
  state.hundreds.splice(found.index, 1);

  if(state.tensFrames.length === 0) state.tensFrames = [[]];
  state.tensFrames.push(sticks);
  canonicalizeTensFrames(); // ✅ NEW: this is the big one for your 579 torture test

  const before = captureCubeRects();
  renderAll();
  const after = captureCubeRects();
  playFlip(before, after, new Set(cubes.map(c=>c.id)));

  cleanupAnimLayer();
  setLocked(false);
}

// ---------- Boot ----------
setMode('compose');
buildNumber(0);
