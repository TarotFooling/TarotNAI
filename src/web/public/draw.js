
const CORE_RGB = 'rgb(100, 100, 200)';
const CORE_ALPHA = 0.5;

const RIM_RGB = 'rgb(86, 86, 173)';
const RIM_ALPHA = 0.745;

const RIM_CELLS = 1;

const COMPOSITE_DILATE_CELLS = 4;
const COMPOSITE_BLUR_RADIUS = 20;
const COMPOSITE_BLUR_PASSES = 2;

const MASK_INK = 'rgb(255, 255, 255)';

const MASK_THRESHOLD = 128;

const MASK_PREVIEW_ALPHA = 0.7;

const MASK_DIM_RGB = 'rgb(0, 0, 0)';
const MASK_DIM_ALPHA = 0.2;

const DRAW_INK = 'rgb(0, 0, 0)';

const MIN_SIZE = 4;

const PX_PER_SLIDER_UNIT = 8;

const MASK_CELL = 8;

const MASK_MAX_SIDE = 2560;

const SOFT_CORE_STOP = 0.25;

const BLUR_PX_PER_UNIT = 1;

const BLUR_PASSES = 3;

const BLUR_EDGE_FEATHER = 0.6;


const FOCUS_CONTEXT_MIN = 32;
const FOCUS_CONTEXT_MAX = 96;
const FOCUS_CONTEXT_STEP = 8;
const FOCUS_CONTEXT_DEFAULT = 96;

const FOCUS_CONTEXT_RGB = 'rgb(87, 30, 18)';
const FOCUS_CONTEXT_ALPHA = 0.4;

const FOCUS_EDGE_RGB = 'rgb(18, 0, 0)';
const FOCUS_EDGE_ALPHA = 0.685;

const FOCUS_GRIP_RGB = 'rgb(0, 0, 0)';
const FOCUS_GRIP_ALPHA = 0.4;
const FOCUS_GRIP_SIZE = 28;

const FOCUS_GRIP_HIT_SCALE = 1.6;

const FOCUS_PREVIEW_DIM_RGB = 'rgb(0, 0, 0)';
const FOCUS_PREVIEW_DIM_ALPHA = 0.5;
const FOCUS_PREVIEW_FILL_RGB = 'rgb(255, 255, 255)';
const FOCUS_PREVIEW_FILL_ALPHA = 0.5;
const FOCUS_PREVIEW_EDGE_RGB = 'rgb(34, 37, 63)';
const FOCUS_PREVIEW_EDGE_ALPHA = 1;

const FOCUS_TARGET_AREA = 1024 * 1024;
const FOCUS_GRID = 64;

const FOCUS_MIN_DIMENSION = 512;
const FOCUS_MAX_DIMENSION = 1920;

const FOCUS_MIN_SIDE = FOCUS_GRID;

const FOCUS_MAX_AREA = 579738;

const EXPAND_SNAP = 8;


const EXPAND_GHOST_INSET = 2;

const EXPAND_LABEL_GAP = 22;

const EXPAND_MIN_SIDE = FOCUS_MIN_DIMENSION;
const EXPAND_MAX_SIDE = 3072;
const EXPAND_MAX_AREA = 3 * 1024 * 1024;

const HISTORY_LIMIT = 24;

const DRAW_HISTORY_LIMIT = 8;

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 32;

const ZOOM_STEP = 1.15;

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export class MaskEditor {
  #stage;
  #composite;
  #mask;
  #cursor;
  #image = null;
  #blank = null;
  #mode = 'mask';
  #tool = 'pen';
  #size = MIN_SIZE;
  #shape = 'round';
  #drawInk = DRAW_INK;
  #stroke = null;
  #undo = [];
  #redo = [];
  #onHistoryChange = () => {};
  #onPick = () => {};
  #onToolChange = () => {};
  #cloneOrigin = null;
  #focus = null;
  #contextArea = FOCUS_CONTEXT_DEFAULT;
  #onFocusChange = () => {};
  #zoom = 1;
  #pan = { x: 0, y: 0 };
  #panning = null;
  #onZoomChange = () => {};
  #frame = null;
  #tint = null;
  #stampBuffer = null;
  #inkProbe = null;
  #hsvSource = null;
  #outset;
  #canvas = null;
  #handleBox = null;
  #outline = null;
  #drag = null;
  #ghost = null;
  #ghostLabel = null;
  static #HANDLE_SIDES = ['n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'];
  #origin = { x: 0, y: 0 };
  #anchor = { x: 0, y: 0 };
  #layers = [];
  #union = null;
  #active = 0;
  #nextLayerId = 1;
  #onLayersChange = () => {};

  constructor(stage) {
    this.#stage = stage;

    this.#composite = document.createElement('canvas');
    this.#composite.className = 'draw-layer draw-layer--composite';
    this.#cursor = document.createElement('canvas');
    this.#cursor.className = 'draw-layer draw-layer--cursor';
    this.#mask = document.createElement('canvas');
    this.#outset = document.createElement('canvas');
    this.#layers = [{ id: this.#nextLayerId++, canvas: this.#mask, visible: true, base: true }];
    this.#active = 0;

    stage.append(this.#composite, this.#cursor);

    this.#buildHandles();
    this.#bindPointer();
  }

  #buildHandles() {
    this.#handleBox = document.createElement('div');
    this.#handleBox.className = 'draw-handles';
    this.#handleBox.hidden = true;

    this.#outline = document.createElement('div');
    this.#outline.className = 'draw-surface-outline';
    this.#outline.hidden = true;

    this.#ghost = document.createElement('div');
    this.#ghost.className = 'draw-ghost';
    this.#ghost.hidden = true;

    this.#ghostLabel = document.createElement('div');
    this.#ghostLabel.className = 'draw-ghost__label';
    this.#ghostLabel.hidden = true;

    for (const side of MaskEditor.#HANDLE_SIDES) {
      const el = document.createElement('div');
      el.className = `draw-handle draw-handle--${side}`;
      el.dataset.side = side;
      this.#handleBox.append(el);
    }
    this.#stage.append(this.#outline, this.#ghost, this.#ghostLabel, this.#handleBox);
    this.#bindHandles();
  }

  #showGhost(drag, by) {
    const snap = (v) => Math.round((v || 0) / EXPAND_SNAP) * EXPAND_SNAP;
    const left = snap(by.left);
    const right = snap(by.right);
    const top = snap(by.top);
    const bottom = snap(by.bottom);

    const target = MaskEditor.clampSurface({
      width: drag.base.width + left + right,
      height: drag.base.height + top + bottom,
    });

    const base = this.#offset;
    const scale = this.#fitScale * this.#zoom || 1;
    const grewW = target.width - drag.base.width;
    const grewH = target.height - drag.base.height;
    const shareX = left + right === 0 ? 0 : (right - left) / (left + right);
    const shareY = top + bottom === 0 ? 0 : (bottom - top) / (top + bottom);
    const shiftX = ((grewW * shareX) / 2) * scale;
    const shiftY = ((grewH * shareY) / 2) * scale;

    const inset = EXPAND_GHOST_INSET;
    const ghostW = Math.round(target.width * scale) + inset * 2;
    const ghostH = Math.round(target.height * scale) + inset * 2;

    Object.assign(this.#ghost.style, {
      width: `${ghostW}px`,
      height: `${ghostH}px`,
      transform:
        `translate(calc(-50% + ${base.x + shiftX}px),` +
        ` calc(-50% + ${base.y + shiftY}px))`,
    });
    this.#ghost.hidden = false;

    this.#outline.hidden = false;

    const parts = [];
    const say = (name, v) => { if (v) parts.push(`${name}: ${v > 0 ? '+' : ''}${v}px`); };
    say('left', left);
    say('right', right);
    say('top', top);
    say('bottom', bottom);
    this.#ghostLabel.textContent = parts.join('  ') || `${target.width} x ${target.height}`;
    this.#ghostLabel.style.transform =
      `translate(calc(-50% + ${base.x + shiftX}px),` +
      ` calc(-50% + ${base.y + shiftY - ghostH / 2 - EXPAND_LABEL_GAP}px))`;
    this.#ghostLabel.hidden = false;
  }

  #hideGhost() {
    if (!this.#ghost) return;
    this.#ghost.hidden = true;
    this.#ghostLabel.hidden = true;
    this.#outline.hidden = !this.isExpanded;
  }

  #bindHandles() {
    this.#handleBox.addEventListener('pointerdown', (event) => {
      const el = event.target.closest('.draw-handle');
      if (!el || !this.hasImage) return;
      event.preventDefault();
      event.stopPropagation();
      el.setPointerCapture(event.pointerId);
      el.classList.add('draw-handle--active');
      this.#drag = {
        el,
        side: el.dataset.side,
        startX: event.clientX,
        startY: event.clientY,
        base: { ...this.#dimensions },
        baseOrigin: { ...this.#origin },
      };
    });

    this.#handleBox.addEventListener('pointermove', (event) => {
      const drag = this.#drag;
      if (!drag) return;
      event.preventDefault();

      const scale = this.#fitScale * this.#zoom || 1;
      const dx = (event.clientX - drag.startX) / scale;
      const dy = (event.clientY - drag.startY) / scale;

      const by = {};
      if (drag.side.includes('e')) by.right = dx;
      if (drag.side.includes('w')) by.left = -dx;
      if (drag.side.includes('s')) by.bottom = dy;
      if (drag.side.includes('n')) by.top = -dy;
      drag.by = by;

      this.#showGhost(drag, by);
    });

    const end = (event) => {
      const drag = this.#drag;
      if (!drag) return;
      drag.el.classList.remove('draw-handle--active');
      if (drag.el.hasPointerCapture(event.pointerId)) {
        drag.el.releasePointerCapture(event.pointerId);
      }
      this.#hideGhost();
      if (drag.by) this.expandBy(drag.by);
      this.#drag = null;
    };
    this.#handleBox.addEventListener('pointerup', end);
    this.#handleBox.addEventListener('pointercancel', end);
  }

  set onHistoryChange(fn) {
    this.#onHistoryChange = fn;
  }

  set onPick(fn) {
    this.#onPick = fn;
  }

  set onToolChange(fn) {
    this.#onToolChange = fn;
  }

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  get hasImage() {
    return Boolean(this.#canvas);
  }

  setMode(mode) {
    this.#mode = mode;
    this.#stage.classList.toggle('draw-stage--ink', mode === 'draw');
    this.#syncCursorStyle();
  }


  get mode() {
    return this.#mode;
  }

  get #dimensions() {
    if (this.#canvas) return this.#canvas;
    return { width: 0, height: 0 };
  }

  get #imageSize() {
    if (this.#image) {
      return { width: this.#image.naturalWidth, height: this.#image.naturalHeight };
    }
    return this.#blank ?? { width: 0, height: 0 };
  }

  get isExpanded() {
    const img = this.#imageSize;
    const box = this.#dimensions;
    return box.width !== img.width || box.height !== img.height;
  }


  get layers() {
    return this.#layers
      .map((l, i) => ({
        id: l.id,
        visible: l.visible,
        base: l.base,
        active: i === this.#active,
        index: i,
      }))
      .reverse();
  }

  get layerCount() {
    return this.#layers.length;
  }

  set onLayersChange(fn) {
    this.#onLayersChange = fn ?? (() => {});
  }

  #stackIndex(panelIndex) {
    return this.#layers.length - 1 - panelIndex;
  }

  selectLayer(panelIndex) {
    const i = this.#stackIndex(panelIndex);
    if (i < 0 || i >= this.#layers.length || i === this.#active) return;
    this.#active = i;
    this.#mask = this.#layers[i].canvas;
    this.#stroke = null;
    this.#cloneOrigin = null;
    this.#hsvSource = null;
    if (this.#mode !== 'draw') this.#rebuildOutset();
    this.#redrawNow();
    this.#onLayersChange();
  }

  addLayer() {
    const canvas = document.createElement('canvas');
    const stroke = this.#strokeSize;
    canvas.width = stroke.width;
    canvas.height = stroke.height;
    this.#pushUndo();
    this.#layers.splice(this.#active + 1, 0, {
      id: this.#nextLayerId++,
      canvas,
      visible: true,
      base: false,
    });
    this.#active += 1;
    this.#mask = canvas;
    if (this.#mode !== 'draw') this.#rebuildOutset();
    this.#redrawNow();
    this.#onLayersChange();
  }

  removeLayer(panelIndex) {
    if (this.#layers.length <= 1) return;
    const i = this.#stackIndex(panelIndex);
    if (i < 0 || i >= this.#layers.length) return;
    this.#pushUndo();
    this.#layers.splice(i, 1);
    if (this.#active >= i) this.#active = Math.max(0, this.#active - 1);
    this.#mask = this.#layers[this.#active].canvas;
    if (this.#mode !== 'draw') this.#rebuildOutset();
    this.#redrawNow();
    this.#onLayersChange();
  }

  moveLayer(panelIndex, dir) {
    const i = this.#stackIndex(panelIndex);
    const j = i + (dir < 0 ? 1 : -1);
    if (i < 0 || i >= this.#layers.length) return;
    if (j < 0 || j >= this.#layers.length) return;
    this.#pushUndo();
    const [moved] = this.#layers.splice(i, 1);
    this.#layers.splice(j, 0, moved);
    if (this.#active === i) this.#active = j;
    else if (this.#active === j) this.#active = i;
    this.#mask = this.#layers[this.#active].canvas;
    this.#redrawNow();
    this.#onLayersChange();
  }

  setLayerVisible(panelIndex, visible) {
    const i = this.#stackIndex(panelIndex);
    if (i < 0 || i >= this.#layers.length) return;
    this.#layers[i].visible = Boolean(visible);
    this.#redrawNow();
    this.#onLayersChange();
  }

  mergeLayers() {
    if (this.#layers.length <= 1) return;
    this.#pushUndo();

    const visible = this.#layers.filter((l) => l.visible);
    const keep = this.#layers[0];
    const ctx = keep.canvas.getContext('2d');
    const flat = document.createElement('canvas');
    flat.width = keep.canvas.width;
    flat.height = keep.canvas.height;
    const fctx = flat.getContext('2d');
    for (const layer of visible) fctx.drawImage(layer.canvas, 0, 0);

    ctx.clearRect(0, 0, keep.canvas.width, keep.canvas.height);
    ctx.drawImage(flat, 0, 0);
    keep.base = this.#layers.some((l) => l.base);
    keep.visible = true;

    this.#layers = [keep];
    this.#active = 0;
    this.#mask = keep.canvas;
    if (this.#mode !== 'draw') this.#rebuildOutset();
    this.#redrawNow();
    this.#onLayersChange();
  }

  layerThumbnail(panelIndex, size = 74) {
    const i = this.#stackIndex(panelIndex);
    const layer = this.#layers[i];
    if (!layer) return null;
    const out = document.createElement('canvas');
    const box = this.#dimensions;
    if (!box.width || !box.height) return null;
    const scale = Math.min(size / box.width, size / box.height);
    out.width = Math.max(1, Math.round(box.width * scale));
    out.height = Math.max(1, Math.round(box.height * scale));
    const ctx = out.getContext('2d');
    if (layer.base && this.#image) {
      const img = this.#imageSize;
      ctx.drawImage(
        this.#image,
        this.#origin.x * scale, this.#origin.y * scale,
        img.width * scale, img.height * scale,
      );
    }
    ctx.drawImage(layer.canvas, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }

  get canvasRect() {
    return {
      ...this.#dimensions,
      origin: { ...this.#origin },
      image: this.#imageSize,
    };
  }

  async load(src) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That image could not be loaded.'));
      img.src = src;
    });

    this.#image = image;
    this.#blank = null;
    this.#reset();
  }

  loadBlank(width, height) {
    this.#image = null;
    this.#blank = { width, height };
    this.#reset();
  }

  #reset() {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#stroke = null;
    this.#cloneOrigin = null;
    this.#hsvSource = null;
    if (this.#focus) {
      this.#focus = null;
      this.#onFocusChange(null);
    }
    this.#canvas = { ...this.#imageSize };
    this.#origin = { x: 0, y: 0 };
    this.#layers = [{ id: this.#nextLayerId++, canvas: this.#mask, visible: true, base: true }];
    this.#active = 0;
    this.#resizeLayers();
    this.#onLayersChange();

    this.#undo = [];
    this.#redo = [];
    this.#onHistoryChange();
    this.clear();
    this.fit();
  }

  #resizeLayers({ mask = true } = {}) {
    const { width, height } = this.#dimensions;
    this.#composite.width = width;
    this.#composite.height = height;
    this.#sizeCursorLayer();
    if (!mask) return;

    const stroke = this.#strokeSize;
    for (const layer of this.#layers) {
      layer.canvas.width = stroke.width;
      layer.canvas.height = stroke.height;
    }

    const rim = this.#mode === 'draw' ? { width: 1, height: 1 } : stroke;
    this.#outset.width = rim.width;
    this.#outset.height = rim.height;
  }

  #sizeCursorLayer() {
    const box = this.#stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width) || this.#dimensions.width);
    const height = Math.max(1, Math.round(box.height) || this.#dimensions.height);
    if (this.#cursor.width !== width || this.#cursor.height !== height) {
      this.#cursor.width = width;
      this.#cursor.height = height;
    }
    this.#cursor.style.width = `${width}px`;
    this.#cursor.style.height = `${height}px`;
    this.#cursor.style.transform = 'translate(-50%, -50%)';
  }

  #cursorContext() {
    const ctx = this.#cursor.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const scale = this.#displayScale;
    const { x: ox, y: oy } = this.#offset;
    const { width, height } = this.#dimensions;
    ctx.translate(
      this.#cursor.width / 2 + ox - (width * scale) / 2,
      this.#cursor.height / 2 + oy - (height * scale) / 2,
    );
    ctx.scale(scale, scale);
    return ctx;
  }

  #expandTo(next) {
    if (!this.hasImage) return false;
    const prev = this.#dimensions;
    const dx = Math.round(next.originX ?? 0);
    const dy = Math.round(next.originY ?? 0);
    const width = Math.round(next.width);
    const height = Math.round(next.height);
    if (width === prev.width && height === prev.height && !dx && !dy) return false;

    this.#pushUndo();

    const carry = (layer) => {
      const copy = document.createElement('canvas');
      copy.width = layer.width;
      copy.height = layer.height;
      copy.getContext('2d').drawImage(layer, 0, 0);
      return copy;
    };
    const oldLayers = this.#layers.map((l) => carry(l.canvas));
    const oldOutset = carry(this.#outset);
    const oldStroke = this.#strokeSize;

    this.#canvas = { width, height };
    this.#origin = { x: this.#origin.x + dx, y: this.#origin.y + dy };
    this.#resizeLayers();

    const stroke = this.#strokeSize;
    const scaleX = stroke.width / width;
    const scaleY = stroke.height / height;
    const offX = dx * scaleX;
    const offY = dy * scaleY;
    void oldStroke;

    const place = (dest, src, smooth) => {
      const dctx = dest.getContext('2d');
      dctx.imageSmoothingEnabled = smooth;
      dctx.drawImage(
        src,
        offX, offY,
        prev.width * scaleX, prev.height * scaleY,
      );
    };
    this.#layers.forEach((layer, i) => {
      if (oldLayers[i]) place(layer.canvas, oldLayers[i], false);
    });
    if (this.#mode !== 'draw') place(this.#outset, oldOutset, false);

    if (this.#mode === 'mask') this.#markExposed(prev, { x: offX, y: offY });

    const grewRight = width - prev.width - dx;
    const grewBottom = height - prev.height - dy;
    this.#anchor = {
      x: this.#anchor.x + (grewRight - dx) / 2,
      y: this.#anchor.y + (grewBottom - dy) / 2,
    };

    this.#clampPan();
    this.#applyTransform();
    this.#redrawNow();
    return true;
  }

  #markExposed(prev, at) {
    const ctx = this.#mask.getContext('2d');
    const { width, height } = this.#mask;
    const stroke = this.#strokeSize;
    const kept = {
      x: at.x,
      y: at.y,
      w: (prev.width * stroke.width) / this.#dimensions.width,
      h: (prev.height * stroke.height) / this.#dimensions.height,
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.rect(kept.x, kept.y, kept.w, kept.h);
    ctx.fillStyle = MASK_INK;
    ctx.fill('evenodd');
    ctx.restore();

    this.#rebuildOutset();
    this.#harden(this.#mask);
    this.#harden(this.#outset);
  }

  #rebuildOutset() {
    if (this.#mode === 'draw') return;
    const ctx = this.#outset.getContext('2d');
    const { width, height } = this.#outset;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    for (let dy = -RIM_CELLS; dy <= RIM_CELLS; dy++) {
      for (let dx = -RIM_CELLS; dx <= RIM_CELLS; dx++) {
        ctx.drawImage(this.#mask, dx, dy);
      }
    }
  }

  expandBy(by = {}) {
    if (!this.hasImage) return false;
    const prev = this.#dimensions;
    const snap = (v) => Math.round((v || 0) / EXPAND_SNAP) * EXPAND_SNAP;
    const left = snap(by.left);
    const right = snap(by.right);
    const top = snap(by.top);
    const bottom = snap(by.bottom);

    const target = MaskEditor.clampSurface({
      width: prev.width + left + right,
      height: prev.height + top + bottom,
    });
    const grewW = target.width - prev.width;
    const grewH = target.height - prev.height;
    const shareX = left + right === 0 ? 0 : (left / (left + right)) * grewW;
    const shareY = top + bottom === 0 ? 0 : (top / (top + bottom)) * grewH;

    return this.#expandTo({
      width: target.width,
      height: target.height,
      originX: Math.round(shareX / EXPAND_SNAP) * EXPAND_SNAP,
      originY: Math.round(shareY / EXPAND_SNAP) * EXPAND_SNAP,
    });
  }

  resetSurface() {
    if (!this.hasImage || !this.isExpanded) return false;
    const img = this.#imageSize;
    return this.#expandTo({
      width: img.width,
      height: img.height,
      originX: -this.#origin.x,
      originY: -this.#origin.y,
    });
  }

  static clampSurface({ width, height }) {
    let w = Math.max(EXPAND_MIN_SIDE, Math.min(EXPAND_MAX_SIDE, Math.round(width)));
    let h = Math.max(EXPAND_MIN_SIDE, Math.min(EXPAND_MAX_SIDE, Math.round(height)));
    if (w * h > EXPAND_MAX_AREA) {
      const k = Math.sqrt(EXPAND_MAX_AREA / (w * h));
      w = Math.floor((w * k) / EXPAND_SNAP) * EXPAND_SNAP;
      h = Math.floor((h * k) / EXPAND_SNAP) * EXPAND_SNAP;
    }
    const fit = (v) =>
      Math.max(EXPAND_MIN_SIDE, Math.round(v / EXPAND_SNAP) * EXPAND_SNAP);
    return { width: fit(w), height: fit(h) };
  }

  fit() {
    if (!this.hasImage) return;
    this.#zoom = 1;
    this.#pan = { x: 0, y: 0 };
    this.#anchor = { x: 0, y: 0 };
    this.#applyTransform();
  }

  reflow() {
    this.#clampPan();
    this.#applyTransform();
  }

  get #fitScale() {
    const box = this.#stage.getBoundingClientRect();
    const { width, height } = this.#dimensions;
    if (!box.width || !box.height || !width || !height) return 1;
    return Math.min(
      box.width / width,
      box.height / height,
      1,
    );
  }

  #applyTransform() {
    if (!this.hasImage) return;
    const { width, height } = this.#dimensions;
    const scale = this.#fitScale * this.#zoom;
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const { x: ox, y: oy } = this.#offset;
    this.#composite.style.width = `${w}px`;
    this.#composite.style.height = `${h}px`;
    this.#composite.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;

    this.#sizeCursorLayer();
    this.#placeHandles(w, h);
  }

  get #offset() {
    const scale = this.#fitScale * this.#zoom || 1;
    return {
      x: this.#pan.x + this.#anchor.x * scale,
      y: this.#pan.y + this.#anchor.y * scale,
    };
  }

  #placeHandles(w, h) {
    if (!this.#handleBox) return;
    const { x: ox, y: oy } = this.#offset;
    const transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
    for (const el of [this.#handleBox, this.#outline]) {
      el.style.position = 'absolute';
      el.style.top = '50%';
      el.style.left = '50%';
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.transform = transform;
    }
    this.#handleBox.hidden = false;
    this.#outline.hidden = this.#drag ? false : !this.isExpanded;
  }

  #clampPan() {
    const { width, height } = this.#dimensions;
    const scale = this.#fitScale * this.#zoom;
    const box = this.#stage.getBoundingClientRect();
    const limit = (extent, available) => Math.max(0, (extent * scale - available) / 2);
    const maxX = limit(width, box.width);
    const maxY = limit(height, box.height);
    this.#pan = {
      x: Math.max(-maxX, Math.min(maxX, this.#pan.x)),
      y: Math.max(-maxY, Math.min(maxY, this.#pan.y)),
    };
  }

  #zoomBy(factor, anchor) {
    const before = this.#zoom;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, before * factor));
    if (next === before) return;

    const box = this.#stage.getBoundingClientRect();
    const ax = anchor ? anchor.x - (box.left + box.width / 2) : 0;
    const ay = anchor ? anchor.y - (box.top + box.height / 2) : 0;

    const ratio = next / before;
    this.#pan = {
      x: ax - (ax - this.#pan.x) * ratio,
      y: ay - (ay - this.#pan.y) * ratio,
    };
    this.#zoom = next;
    this.#applyTransform();
    this.#onZoomChange(this.zoom);
  }

  get zoom() {
    return this.#zoom;
  }

  set onZoomChange(fn) {
    this.#onZoomChange = fn;
  }

  resetZoom() {
    this.fit();
    this.#onZoomChange(this.zoom);
  }

  static #IMPLEMENTED = new Map([
    ['pen', ['mask', 'draw']],
    ['eraser', ['mask', 'draw']],
    ['fill', ['mask', 'draw']],
    ['select', ['mask', 'draw']],
    ['lasso', ['draw']],
    ['dropper', ['draw']],
    ['blur', ['draw']],
    ['clone', ['draw']],
  ]);

  get #selectIsFocus() {
    return this.#mode === 'mask';
  }

  setTool(tool) {
    this.#tool = tool;
    if (tool !== 'clone') this.#cloneOrigin = null;
    this.#syncCursorStyle();
    this.#scheduleRedraw();
  }

  #syncCursorStyle() {
    this.#stage.classList.toggle(
      'draw-stage--crosshair',
      this.#tool === 'select' && this.#selectIsFocus,
    );
  }

  get tool() {
    return this.#tool;
  }

  get #toolPaints() {
    return Boolean(MaskEditor.#IMPLEMENTED.get(this.#tool)?.includes(this.#mode));
  }

  setSize(size) {
    this.#size = Math.max(MIN_SIZE, Number(size) || MIN_SIZE);
  }

  get #brushCells() {
    if (this.#mode === 'draw') return this.#size;
    return this.#size * (PX_PER_SLIDER_UNIT / MASK_CELL);
  }

  get #brushWidth() {
    return this.#brushCells * this.#cellSize.x;
  }

  get maskSize() {
    const { width, height } = this.#dimensions;
    if (!width || !height) return { width: 1, height: 1 };
    const scale = Math.min(1, MASK_MAX_SIDE / Math.max(width, height));
    const cells = (v) => Math.max(8, Math.ceil((v * scale) / MASK_CELL / 8) * 8);
    return { width: cells(width), height: cells(height) };
  }

  get #strokeSize() {
    if (this.#mode !== 'draw') return this.maskSize;
    const { width, height } = this.#dimensions;
    if (!width || !height) return { width: 1, height: 1 };
    return { width, height };
  }

  get #cellSize() {
    const { width, height } = this.#dimensions;
    const stroke = this.#strokeSize;
    return { x: width / stroke.width, y: height / stroke.height };
  }

  #toMask(p) {
    const cell = this.#cellSize;
    const x = p.x / cell.x;
    const y = p.y / cell.y;
    if (this.#mode === 'draw') return { x, y };
    const span = this.#brushCells + (this.#tool === 'eraser' ? 0 : RIM_CELLS * 2);
    const offset = Math.round(span) % 2 === 0 ? 0 : 0.5;
    return {
      x: Math.round(x - offset) + offset,
      y: Math.round(y - offset) + offset,
    };
  }

  setShape(shape) {
    this.#shape = shape;
  }

  get shape() {
    return this.#shape;
  }

  get #square() {
    return this.#shape === 'square';
  }

  get #softens() {
    return this.#shape === 'soft' && this.#mode === 'draw';
  }

  clear() {
    if (!this.hasImage) return;
    for (const layer of this.#layers) {
      layer.canvas.getContext('2d').clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    }
    this.#outset.getContext('2d').clearRect(0, 0, this.#outset.width, this.#outset.height);
    this.#redrawNow();
  }

  #redraw() {
    this.#flushBlur();

    const ctx = this.#composite.getContext('2d');
    const { width, height } = this.#composite;
    ctx.clearRect(0, 0, width, height);

    if (this.#image) {
      const img = this.#imageSize;
      ctx.drawImage(this.#image, this.#origin.x, this.#origin.y, img.width, img.height);
    }

    if (this.#mode === 'draw') {
      for (const layer of this.#layers) {
        if (!layer.visible) continue;
        ctx.drawImage(layer.canvas, 0, 0);
      }
      return;
    }

    this.#hardenLayers();

    if (this.#focus) {
      const lit = this.#inpaintRect(this.#focus);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(lit.x, lit.y, lit.width, lit.height);
      ctx.fillStyle = MASK_DIM_RGB;
      ctx.globalAlpha = MASK_DIM_ALPHA;
      ctx.fill('evenodd');
      ctx.restore();
    }

    const mask = this.maskSize;
    const tint = this.#tintCanvas(mask.width, mask.height);
    const tctx = tint.getContext('2d');

    ctx.save();
    if (this.#focus) {
      const clip = this.#inpaintRect(this.#focus);
      ctx.beginPath();
      ctx.rect(clip.x, clip.y, clip.width, clip.height);
      ctx.clip();
    }

    const stencil = this.#maskUnion();

    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, mask.width, mask.height);
    tctx.drawImage(this.#outset, 0, 0);
    tctx.globalCompositeOperation = 'destination-out';
    tctx.drawImage(stencil, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = RIM_RGB;
    tctx.fillRect(0, 0, mask.width, mask.height);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = RIM_ALPHA;
    ctx.drawImage(tint, 0, 0, width, height);

    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, mask.width, mask.height);
    tctx.drawImage(stencil, 0, 0);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = CORE_RGB;
    tctx.fillRect(0, 0, mask.width, mask.height);
    tctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = CORE_ALPHA;
    ctx.drawImage(tint, 0, 0, width, height);

    ctx.globalAlpha = 1;
    ctx.restore();

    this.#drawFocusOverlay(ctx);
  }

  #harden(canvas) {
    const { width, height } = canvas;
    const ctx = canvas.getContext('2d');
    const image = ctx.getImageData(0, 0, width, height);
    const { data } = image;
    for (let p = 3; p < data.length; p += 4) {
      data[p] = data[p] >= MASK_THRESHOLD ? 255 : 0;
    }
    ctx.putImageData(image, 0, 0);
  }

  #hardenLayers() {
    this.#harden(this.#mask);
    this.#harden(this.#outset);
  }

  #maskUnion() {
    const visible = this.#layers.filter((l) => l.visible);
    if (visible.length <= 1) return this.#mask;

    const { width, height } = this.#mask;
    if (!this.#union) this.#union = document.createElement('canvas');
    const out = this.#union;
    if (out.width !== width || out.height !== height) {
      out.width = width;
      out.height = height;
    }
    const ctx = out.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    for (const layer of visible) ctx.drawImage(layer.canvas, 0, 0);
    return out;
  }

  #tintCanvas(width, height) {
    if (!this.#tint) this.#tint = document.createElement('canvas');
    if (this.#tint.width !== width || this.#tint.height !== height) {
      this.#tint.width = width;
      this.#tint.height = height;
    }
    return this.#tint;
  }

  #outsetContext() {
    const ctx = this.#outset.getContext('2d');
    const erasing = this.#tool === 'eraser';
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.#ink;
    ctx.fillStyle = this.#ink;
    ctx.lineWidth = this.#brushCells + (erasing ? 0 : RIM_CELLS * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }

  #scheduleRedraw() {
    if (this.#frame !== null) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#redraw();
    });
  }

  #redrawNow() {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#redraw();
  }

  get #ink() {
    return this.#mode === 'draw' ? this.#drawInk : MASK_INK;
  }

  setInk(css) {
    this.#drawInk = css;
  }

  get ink() {
    return this.#drawInk;
  }

  #point(event) {
    const rect = this.#composite.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.#composite.width,
      y: ((event.clientY - rect.top) / rect.height) * this.#composite.height,
    };
  }

  #bindPointer() {
    this.#stage.addEventListener('wheel', (event) => {
      if (!this.hasImage) return;
      event.preventDefault();
      if (!event.deltaY) return;
      const notches = event.deltaMode === 0 ? event.deltaY / 100 : event.deltaY;
      this.#zoomBy(ZOOM_STEP ** -notches, { x: event.clientX, y: event.clientY });
      this.#drawCursor(this.#point(event));
    }, { passive: false });

    this.#stage.addEventListener('pointerdown', (event) => {
      if (!this.hasImage) return;

      if (event.button === 1) {
        event.preventDefault();
        this.#stage.setPointerCapture(event.pointerId);
        this.#panning = { x: event.clientX, y: event.clientY };
        return;
      }

      if (event.button !== 0) return;
      if (!this.#toolPaints) return;
      const p = this.#point(event);
      const bounds = this.#dimensions;
      if (p.x < 0 || p.y < 0 || p.x > bounds.width || p.y > bounds.height) return;

      if (this.#tool === 'dropper') {
        this.#pickColour(p);
        return;
      }

      this.#stage.setPointerCapture(event.pointerId);

      if (this.#tool === 'fill') {
        this.#pushUndo();
        this.#fillAt(p);
        this.#redrawNow();
        return;
      }

      if (this.#tool === 'select') {
        if (this.#selectIsFocus) {
          const hit = this.#focusHitTest(p);
          if (hit === 'grip') {
            this.#stroke = {
              last: p,
              focus: { x: this.#focus.x, y: this.#focus.y },
            };
          } else if (hit === 'inside') {
            this.#stroke = {
              last: p,
              move: { dx: p.x - this.#focus.x, dy: p.y - this.#focus.y },
            };
          } else if (this.#focus) {
            this.#focus = null;
            this.#onFocusChange(null);
            this.#scheduleRedraw();
          } else {
            this.#stroke = { last: p, focus: p };
          }
          return;
        }
        this.#pushUndo();
        this.#stroke = { last: p, rect: p };
        return;
      }

      if (this.#tool === 'lasso') {
        this.#pushUndo();
        this.#stroke = { last: p, lasso: [p] };
        return;
      }

      if (this.#tool === 'clone' && event.altKey) {
        this.#cloneOrigin = this.#toMask(p);
        return;
      }

      if (this.#tool === 'clone' && !this.#cloneOrigin) return;

      this.#pushUndo();
      const m = this.#toMask(p);
      this.#stroke = { last: m, points: [m], cursor: 0, drawn: m };

      if (this.#tool === 'clone') {
        this.#stroke.cloneOffset = {
          x: m.x - this.#cloneOrigin.x,
          y: m.y - this.#cloneOrigin.y,
        };
        this.#stroke.cloneSource = this.#freezeStrokeLayer();
      }

      if (this.#tool === 'blur') this.#stroke.blurSource = this.#freezeStrokeLayer();

      this.#scheduleRedraw();
    });

    this.#stage.addEventListener('pointermove', (event) => {
      if (!this.hasImage) return;

      if (this.#panning) {
        this.#pan = {
          x: this.#pan.x + (event.clientX - this.#panning.x),
          y: this.#pan.y + (event.clientY - this.#panning.y),
        };
        this.#panning = { x: event.clientX, y: event.clientY };
        this.#clampPan();
        this.#applyTransform();
        return;
      }

      const p = this.#point(event);
      this.#drawCursor(p);

      if (!this.#stroke) return;
      if (this.#tool === 'select') {
        if (this.#selectIsFocus) {
          if (this.#stroke.move) this.#moveFocus(p, this.#stroke.move);
          else this.#focus = this.#focusRect(this.#stroke.focus, p);
          this.#scheduleRedraw();
          return;
        }
        this.#previewRect(this.#stroke.rect, p);
        return;
      }

      if (this.#tool === 'lasso') {
        this.#stroke.lasso.push(p);
        this.#previewLasso(this.#stroke.lasso);
        return;
      }

      const points = typeof event.getCoalescedEvents === 'function'
        ? event.getCoalescedEvents().map((e) => this.#toMask(this.#point(e)))
        : [];
      if (!points.length) points.push(this.#toMask(p));

      this.#extendStroke(points);
    });

    const end = (event) => {
      this.#panning = null;
      if (!this.#stroke) return;
      if (this.#tool === 'select' && this.#selectIsFocus) {
        if (this.#stroke.move) {
          this.#moveFocus(this.#point(event), this.#stroke.move);
        } else {
          this.#focus = this.#focusRect(this.#stroke.focus, this.#point(event));
        }
        this.#onFocusChange(this.focusRegion);
      } else if (this.#tool === 'select') {
        this.#commitRect(this.#stroke.rect, this.#point(event));
      } else if (this.#tool === 'lasso') {
        this.#commitLasso(this.#stroke.lasso);
      } else {
        this.#finishStroke();
      }
      this.#flushBlur();
      this.#stroke = null;
      this.#redrawNow();
    };
    this.#stage.addEventListener('pointerup', end);
    this.#stage.addEventListener('pointercancel', end);
    this.#stage.addEventListener('pointerleave', (event) => {
      this.#clearCursor();
      end(event);
    });
  }

  #brushContext() {
    const ctx = this.#mask.getContext('2d');
    ctx.globalCompositeOperation = this.#tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = this.#ink;
    ctx.fillStyle = this.#ink;
    ctx.lineWidth = this.#brushCells;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  }

  #sweepSquare(ctx, a, b, size) {
    const half = size / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    ctx.beginPath();
    if (dx === 0 && dy === 0) {
      ctx.rect(a.x - half, a.y - half, size, size);
      ctx.fill();
      return;
    }

    ctx.rect(a.x - half, a.y - half, size, size);
    ctx.rect(b.x - half, b.y - half, size, size);

    const sx = dx >= 0 ? 1 : -1;
    const sy = dy >= 0 ? 1 : -1;
    ctx.moveTo(a.x - half * sx, a.y - half * sy);
    ctx.lineTo(a.x + half * sx, a.y - half * sy);
    ctx.lineTo(b.x + half * sx, b.y - half * sy);
    ctx.lineTo(b.x + half * sx, b.y + half * sy);
    ctx.lineTo(b.x - half * sx, b.y + half * sy);
    ctx.lineTo(a.x - half * sx, a.y + half * sy);
    ctx.closePath();
    ctx.fill();
  }

  #flattenQuadratic(from, control, to, out) {
    const chord = Math.hypot(to.x - from.x, to.y - from.y)
      + Math.hypot(control.x - from.x, control.y - from.y);
    const steps = Math.max(1, Math.ceil(chord / Math.max(0.5, this.#brushCells / 2)));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const u = 1 - t;
      out.push({
        x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
        y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
      });
    }
    return out;
  }

  #extendStroke(points) {
    if (!points.length) return;
    const stroke = this.#stroke;
    stroke.points.push(...points);

    const pts = stroke.points;
    if (pts.length < 3) return;

    let drawn = stroke.drawn;

    if (this.#tool === 'blur' || this.#tool === 'clone') {
      const apply = this.#tool === 'blur'
        ? (q) => this.#blurAt(q)
        : (q) => this.#cloneAt(q);
      let from = stroke.drawn;
      for (let i = stroke.cursor; i < pts.length - 1; i += 1) {
        const control = pts[i];
        const mid = midpoint(control, pts[i + 1]);
        const path = this.#flattenQuadratic(from, control, mid, []);
        let previous = from;
        for (const to of path) {
          this.#walkDabs(previous, to, apply);
          previous = to;
        }
        from = mid;
        drawn = mid;
      }
      stroke.cursor = pts.length - 1;
      stroke.drawn = drawn;
      stroke.last = pts[pts.length - 1];
      this.#scheduleRedraw();
      return;
    }

    if (this.#square || this.#softens) {
      const path = [];
      let from = stroke.drawn;
      for (let i = stroke.cursor; i < pts.length - 1; i += 1) {
        const control = pts[i];
        const mid = midpoint(control, pts[i + 1]);
        this.#flattenQuadratic(from, control, mid, path);
        from = mid;
        drawn = mid;
      }
      if (this.#softens) this.#sweepSoft(stroke.drawn, path);
      else this.#sweepPath(stroke.drawn, path);
    } else {
      for (const ctx of [this.#brushContext(), this.#outsetContext()]) {
        ctx.beginPath();
        ctx.moveTo(stroke.drawn.x, stroke.drawn.y);
        drawn = stroke.drawn;
        for (let i = stroke.cursor; i < pts.length - 1; i += 1) {
          const control = pts[i];
          const mid = midpoint(control, pts[i + 1]);
          ctx.quadraticCurveTo(control.x, control.y, mid.x, mid.y);
          drawn = mid;
        }
        ctx.stroke();
      }
    }

    stroke.cursor = pts.length - 1;
    stroke.drawn = drawn;
    stroke.last = pts[pts.length - 1];
    this.#scheduleRedraw();
  }

  #sweepPath(start, path) {
    if (!path.length) return;
    const size = this.#brushCells;
    const grow = this.#tool === 'eraser' ? 0 : RIM_CELLS * 2;
    const passes = [
      [this.#brushContext(), size],
      [this.#outsetContext(), size + grow],
    ];
    for (const [ctx, w] of passes) {
      let from = start;
      for (const to of path) {
        this.#sweepSquare(ctx, from, to, w);
        from = to;
      }
    }
  }

  #finishStroke() {
    const stroke = this.#stroke;
    if (!stroke || !stroke.points) return;
    const pts = stroke.points;
    const end = pts[pts.length - 1];

    if (this.#tool === 'blur' || this.#tool === 'clone') {
      const apply = this.#tool === 'blur'
        ? (q) => this.#blurAt(q)
        : (q) => this.#cloneAt(q);
      if (stroke.drawn.x === end.x && stroke.drawn.y === end.y) apply(end);
      else this.#walkDabs(stroke.drawn, end, apply);
      stroke.drawn = end;
      return;
    }

    if (this.#square || this.#softens) {
      const path = [];
      if (stroke.cursor < pts.length - 1) {
        this.#flattenQuadratic(stroke.drawn, pts[stroke.cursor], end, path);
      } else {
        path.push(end);
      }
      if (this.#softens) this.#sweepSoft(stroke.drawn, path);
      else this.#sweepPath(stroke.drawn, path);
    } else {
      for (const ctx of [this.#brushContext(), this.#outsetContext()]) {
        ctx.beginPath();
        ctx.moveTo(stroke.drawn.x, stroke.drawn.y);
        if (stroke.cursor < pts.length - 1) {
          const control = pts[stroke.cursor];
          ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
        } else {
          ctx.lineTo(end.x, end.y);
        }
        ctx.stroke();
      }
    }

    if (pts.length === 1 && stroke.drawn.x === end.x && stroke.drawn.y === end.y) {
      this.#stamp(end);
    }
    stroke.drawn = end;
  }

  #stamp(p) {
    const size = this.#brushCells;
    const grow = this.#tool === 'eraser' ? 0 : RIM_CELLS * 2;
    const pairs = [
      [this.#brushContext(), size],
      [this.#outsetContext(), size + grow],
    ];
    for (const [ctx, w] of pairs) {
      const half = w / 2;
      if (this.#softens) {
        this.#softDab(ctx, p, w);
        continue;
      }
      if (this.#square) {
        ctx.fillRect(p.x - half, p.y - half, w, w);
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, half, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  #softDab(ctx, p, size) {
    const half = size / 2;
    if (half <= 0) return;
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, half);
    gradient.addColorStop(0, this.#ink);
    gradient.addColorStop(SOFT_CORE_STOP, this.#ink);
    gradient.addColorStop(1, this.#transparentInk);
    const previousFill = ctx.fillStyle;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, half, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = previousFill;
  }

  get #transparentInk() {
    const probe = this.#inkProbe ??= document.createElement('canvas').getContext('2d', {
      willReadFrequently: true,
    });
    probe.canvas.width = 1;
    probe.canvas.height = 1;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = this.#ink;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }

  #sweepSoft(start, path) {
    if (!path.length) return;
    const size = this.#brushCells;
    const grow = this.#tool === 'eraser' ? 0 : RIM_CELLS * 2;
    const passes = [
      [this.#brushContext(), size],
      [this.#outsetContext(), size + grow],
    ];
    for (const [ctx, w] of passes) {
      let from = start;
      for (const to of path) {
        this.#walkDabs(from, to, (q) => this.#softDab(ctx, q, w));
        from = to;
      }
    }
  }

  #previewRect(from, to) {
    this.#clearCursor();
    const ctx = this.#cursorContext();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, this.#dimensions.width / 400);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(from.x, from.y, to.x - from.x, to.y - from.y);
    ctx.setLineDash([]);
  }

  #commitRect(imageFrom, imageTo) {
    const erasing = this.#tool === 'eraser';
    const from = this.#toMask(imageFrom);
    const to = this.#toMask(imageTo);
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const w = Math.abs(to.x - from.x);
    const h = Math.abs(to.y - from.y);
    const grow = erasing ? 0 : RIM_CELLS;
    const pairs = [
      [this.#mask, 0],
      [this.#outset, grow],
    ];
    for (const [canvas, g] of pairs) {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.fillStyle = this.#ink;
      ctx.fillRect(x - g, y - g, w + g * 2, h + g * 2);
    }
    this.#clearCursor();
  }

  #focusRect(from, to) {
    const bounds = this.#dimensions;
    const clampX = (v) => Math.min(Math.max(v, 0), bounds.width);
    const clampY = (v) => Math.min(Math.max(v, 0), bounds.height);
    const x0 = clampX(Math.min(from.x, to.x));
    const y0 = clampY(Math.min(from.y, to.y));
    let width = clampX(Math.max(from.x, to.x)) - x0;
    let height = clampY(Math.max(from.y, to.y)) - y0;
    if (width < FOCUS_MIN_SIDE || height < FOCUS_MIN_SIDE) return null;

    const area = width * height;
    if (area > FOCUS_MAX_AREA) {
      const scale = Math.sqrt(FOCUS_MAX_AREA / area);
      width *= scale;
      height *= scale;
    }

    const anchorLeft = from.x <= to.x;
    const anchorTop = from.y <= to.y;
    const x = anchorLeft ? x0 : clampX(Math.max(from.x, to.x)) - width;
    const y = anchorTop ? y0 : clampY(Math.max(from.y, to.y)) - height;

    return { x, y, width, height };
  }

  #focusHitTest(p) {
    if (!this.#focus) return null;
    const grip = this.#gripRect(this.#focus);
    const pad = (grip.width * (FOCUS_GRIP_HIT_SCALE - 1)) / 2;
    if (
      p.x >= grip.x - pad && p.x <= grip.x + grip.width + pad
      && p.y >= grip.y - pad && p.y <= grip.y + grip.height + pad
    ) {
      return 'grip';
    }
    const r = this.#focus;
    if (p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height) {
      return 'inside';
    }
    return null;
  }

  #moveFocus(p, grab) {
    const bounds = this.#dimensions;
    const r = this.#focus;
    const x = Math.min(Math.max(p.x - grab.dx, 0), bounds.width - r.width);
    const y = Math.min(Math.max(p.y - grab.dy, 0), bounds.height - r.height);
    this.#focus = { x, y, width: r.width, height: r.height };
  }

  set onFocusChange(fn) {
    this.#onFocusChange = fn;
  }

  get focusRegion() {
    return this.#focus ? { ...this.#focus } : null;
  }

  clearFocus() {
    if (!this.#focus) return;
    this.#focus = null;
    this.#onFocusChange(null);
    this.#scheduleRedraw();
  }

  setContextArea(value) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : FOCUS_CONTEXT_DEFAULT;
    const stepped = Math.round(safe / FOCUS_CONTEXT_STEP) * FOCUS_CONTEXT_STEP;
    this.#contextArea = Math.min(
      Math.max(stepped, FOCUS_CONTEXT_MIN),
      FOCUS_CONTEXT_MAX,
    );
    this.#scheduleRedraw();
  }

  get contextArea() {
    return this.#contextArea;
  }

  #contextRect(region) {
    return { ...region };
  }

  #inpaintRect(region) {
    const pad = this.#contextArea;
    const padX = Math.min(pad, Math.max(0, (region.width - FOCUS_MIN_SIDE) / 2));
    const padY = Math.min(pad, Math.max(0, (region.height - FOCUS_MIN_SIDE) / 2));
    return {
      x: region.x + padX,
      y: region.y + padY,
      width: region.width - padX * 2,
      height: region.height - padY * 2,
    };
  }

  #drawFocusOverlay(ctx) {
    if (!this.#focus) return;
    const context = this.#contextRect(this.#focus);
    const inpainted = this.#inpaintRect(this.#focus);

    ctx.save();
    ctx.beginPath();
    ctx.rect(context.x, context.y, context.width, context.height);
    ctx.rect(inpainted.x, inpainted.y, inpainted.width, inpainted.height);
    ctx.fillStyle = FOCUS_CONTEXT_RGB;
    ctx.globalAlpha = FOCUS_CONTEXT_ALPHA;
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    const line = Math.max(1, this.#composite.width / 300);
    ctx.strokeStyle = FOCUS_EDGE_RGB;
    ctx.globalAlpha = FOCUS_EDGE_ALPHA;
    ctx.lineWidth = line;
    ctx.strokeRect(
      context.x - line / 2,
      context.y - line / 2,
      context.width + line,
      context.height + line,
    );
    ctx.restore();

    const grip = this.#gripRect(context);
    ctx.save();
    ctx.fillStyle = FOCUS_GRIP_RGB;
    ctx.globalAlpha = FOCUS_GRIP_ALPHA;
    ctx.fillRect(grip.x, grip.y, grip.width, grip.height);
    ctx.restore();
  }

  #gripRect(region) {
    const scale = this.#composite.width / this.#composite.getBoundingClientRect().width || 1;
    const size = Math.min(
      FOCUS_GRIP_SIZE * (Number.isFinite(scale) && scale > 0 ? scale : 1),
      region.width,
      region.height,
    );
    return {
      x: region.x + region.width - size,
      y: region.y + region.height - size,
      width: size,
      height: size,
    };
  }


  #previewLasso(points) {
    if (points.length < 2) return;
    this.#clearCursor();
    const ctx = this.#cursorContext();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, this.#dimensions.width / 400);
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  #commitLasso(points) {
    this.#clearCursor();
    if (points.length < 3) return;

    const erasing = this.#tool === 'eraser';
    const pairs = [
      [this.#mask, 0],
      [this.#outset, erasing ? 0 : RIM_CELLS * 2],
    ];
    for (const [canvas, grow] of pairs) {
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
      ctx.fillStyle = this.#ink;
      ctx.strokeStyle = this.#ink;
      ctx.lineWidth = grow;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const first = this.#toMask(points[0]);
      ctx.moveTo(first.x, first.y);
      for (const point of points.slice(1)) {
        const m = this.#toMask(point);
        ctx.lineTo(m.x, m.y);
      }
      ctx.closePath();
      ctx.fill();
      if (grow) ctx.stroke();
    }
  }


  #pickColour(p) {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const { data } = this.#composite.getContext('2d').getImageData(x, y, 1, 1);

    if (data[3] === 0) return;

    this.#drawInk = `rgb(${data[0]}, ${data[1]}, ${data[2]})`;
    this.#onPick(data[0], data[1], data[2]);

    this.setTool('pen');
    this.#onToolChange('pen');
  }


  #fillAt(p) {
    if (this.#mode !== 'draw') {
      for (const canvas of [this.#mask, this.#outset]) {
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = this.#ink;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    this.#floodFill(p);
  }

  #floodFill(p) {
    const { width, height } = this.#composite;
    const x0 = Math.floor(p.x);
    const y0 = Math.floor(p.y);
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

    const cctx = this.#composite.getContext('2d');
    const source = cctx.getImageData(0, 0, width, height).data;

    const at = (x, y) => (y * width + x) * 4;
    const seed = at(x0, y0);
    const target = [source[seed], source[seed + 1], source[seed + 2], source[seed + 3]];

    const matches = (i) => source[i] === target[0]
      && source[i + 1] === target[1]
      && source[i + 2] === target[2]
      && source[i + 3] === target[3];

    const seen = new Uint8Array(width * height);
    const region = new Uint8Array(width * height);

    const stack = [[x0, y0]];
    while (stack.length) {
      const [sx, sy] = stack.pop();
      if (seen[sy * width + sx]) continue;

      let left = sx;
      while (left > 0 && !seen[sy * width + (left - 1)] && matches(at(left - 1, sy))) left -= 1;
      let right = sx;
      while (right < width - 1 && !seen[sy * width + (right + 1)] && matches(at(right + 1, sy))) {
        right += 1;
      }

      for (let x = left; x <= right; x += 1) {
        seen[sy * width + x] = 1;
        region[sy * width + x] = 1;
      }

      for (const ny of [sy - 1, sy + 1]) {
        if (ny < 0 || ny >= height) continue;
        let run = false;
        for (let x = left; x <= right; x += 1) {
          const inside = !seen[ny * width + x] && matches(at(x, ny));
          if (inside && !run) stack.push([x, ny]);
          run = inside;
        }
      }
    }

    const stencil = document.createElement('canvas');
    stencil.width = width;
    stencil.height = height;
    const sctx = stencil.getContext('2d');
    const shape = sctx.createImageData(width, height);
    for (let i = 0; i < region.length; i += 1) {
      if (region[i]) shape.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(shape, 0, 0);
    sctx.globalCompositeOperation = 'source-in';
    sctx.fillStyle = this.#ink;
    sctx.fillRect(0, 0, width, height);

    const ctx = this.#mask.getContext('2d');
    ctx.globalCompositeOperation = this.#tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.drawImage(stencil, 0, 0);
  }


  #freezeStrokeLayer() {
    const frozen = document.createElement('canvas');
    frozen.width = this.#mask.width;
    frozen.height = this.#mask.height;
    frozen.getContext('2d').drawImage(this.#mask, 0, 0);
    return frozen;
  }

  #blurAt(p) {
    if (!this.#stroke?.blurSource) return;

    const footprint = this.#blurFootprint();
    const ctx = footprint.getContext('2d');
    ctx.globalCompositeOperation = 'lighter';
    this.#fillSoftDab(ctx, p, this.#brushCells);

    const half = this.#brushCells / 2;
    const bounds = this.#stroke.blurBounds ?? {
      x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity,
    };
    bounds.x0 = Math.min(bounds.x0, p.x - half);
    bounds.y0 = Math.min(bounds.y0, p.y - half);
    bounds.x1 = Math.max(bounds.x1, p.x + half);
    bounds.y1 = Math.max(bounds.y1, p.y + half);
    this.#stroke.blurBounds = bounds;
    this.#stroke.blurDirty = true;
  }

  #blurFootprint() {
    if (!this.#stroke.blurMask) {
      const mask = document.createElement('canvas');
      mask.width = this.#mask.width;
      mask.height = this.#mask.height;
      this.#stroke.blurMask = mask;
    }
    return this.#stroke.blurMask;
  }

  #flushBlur() {
    const stroke = this.#stroke;
    if (!stroke?.blurDirty || !stroke.blurSource || !stroke.blurMask) return;
    stroke.blurDirty = false;

    const radius = Math.max(1, Math.round(this.#size * BLUR_PX_PER_UNIT));
    const { width, height } = this.#mask;

    const pad = radius * BLUR_PASSES;
    const b = stroke.blurBounds;
    const x0 = Math.max(0, Math.floor(b.x0 - pad));
    const y0 = Math.max(0, Math.floor(b.y0 - pad));
    const x1 = Math.min(width, Math.ceil(b.x1 + pad));
    const y1 = Math.min(height, Math.ceil(b.y1 + pad));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    const patch = stroke.blurSource.getContext('2d').getImageData(x0, y0, w, h);
    this.#premultiply(patch.data);
    for (let pass = 0; pass < BLUR_PASSES; pass += 1) this.#boxBlur(patch, radius);
    this.#unpremultiply(patch.data);

    const blurred = document.createElement('canvas');
    blurred.width = w;
    blurred.height = h;
    const bctx = blurred.getContext('2d');
    bctx.putImageData(patch, 0, 0);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(stroke.blurMask, -x0, -y0);

    const kept = document.createElement('canvas');
    kept.width = w;
    kept.height = h;
    const kctx = kept.getContext('2d');
    kctx.drawImage(stroke.blurSource, -x0, -y0);
    kctx.globalCompositeOperation = 'destination-out';
    kctx.drawImage(stroke.blurMask, -x0, -y0);

    kctx.globalCompositeOperation = 'lighter';
    kctx.drawImage(blurred, 0, 0);

    const ctx = this.#mask.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(kept, x0, y0);
    ctx.restore();
  }

  #boxBlur(image, radius) {
    const { width, height, data } = image;
    const scratch = new Float32Array(data.length);
    this.#blurAxis(data, scratch, width, height, radius, true);
    this.#blurAxis(scratch, data, width, height, radius, false);
  }

  #blurAxis(src, dst, width, height, radius, horizontal) {
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;
    const step = horizontal ? 4 : width * 4;
    const line = horizontal ? width * 4 : 4;

    for (let o = 0; o < outer; o += 1) {
      const base = o * line;
      let r = 0; let g = 0; let b = 0; let a = 0;

      let count = 0;
      for (let i = 0; i <= radius && i < inner; i += 1) {
        const p = base + i * step;
        r += src[p]; g += src[p + 1]; b += src[p + 2]; a += src[p + 3];
        count += 1;
      }

      for (let i = 0; i < inner; i += 1) {
        const p = base + i * step;
        dst[p] = r / count;
        dst[p + 1] = g / count;
        dst[p + 2] = b / count;
        dst[p + 3] = a / count;

        const out = i - radius;
        const into = i + radius + 1;
        if (out >= 0) {
          const q = base + out * step;
          r -= src[q]; g -= src[q + 1]; b -= src[q + 2]; a -= src[q + 3];
          count -= 1;
        }
        if (into < inner) {
          const q = base + into * step;
          r += src[q]; g += src[q + 1]; b += src[q + 2]; a += src[q + 3];
          count += 1;
        }
      }
    }
  }

  #premultiply(data) {
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      data[i] *= a;
      data[i + 1] *= a;
      data[i + 2] *= a;
    }
  }

  #unpremultiply(data) {
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      const scale = alpha > 0 ? 255 / alpha : 0;
      data[i] *= scale;
      data[i + 1] *= scale;
      data[i + 2] *= scale;
    }
  }

  #cloneAt(p) {
    const source = this.#stroke?.cloneSource;
    const offset = this.#stroke?.cloneOffset;
    if (!source || !offset) return;

    const ctx = this.#mask.getContext('2d');
    ctx.save();
    ctx.beginPath();
    this.#dabPath(ctx, p, this.#brushCells);
    ctx.clip();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(source, -offset.x, -offset.y);
    ctx.restore();
  }

  #dabPath(ctx, p, size) {
    const half = size / 2;
    if (this.#square) ctx.rect(p.x - half, p.y - half, size, size);
    else ctx.arc(p.x, p.y, half, 0, Math.PI * 2);
  }

  #fillDab(ctx, p, size) {
    ctx.beginPath();
    this.#dabPath(ctx, p, size);
    ctx.fill();
  }

  #fillSoftDab(ctx, p, size) {
    const half = size / 2;
    if (half <= 0) return;
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, half);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(BLUR_EDGE_FEATHER, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, half, 0, Math.PI * 2);
    ctx.fill();
  }

  #walkDabs(from, to, apply) {
    const step = Math.max(0.5, this.#brushCells / 4);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(distance / step));
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      apply({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }

  #drawCursor(p) {
    if ((this.#tool === 'select' || this.#tool === 'lasso') && this.#stroke) return;
    this.#clearCursor();
    const ctx = this.#cursorContext();

    if (this.#tool === 'select' && this.#selectIsFocus) return;

    if (this.#tool === 'dropper') {
      this.#drawCrosshair(ctx, p);
      return;
    }

    if (this.#tool === 'clone' && !this.#cloneOrigin) {
      this.#drawCrosshair(ctx, p);
      return;
    }

    const rimless = this.#tool === 'eraser'
      || this.#tool === 'blur'
      || this.#tool === 'clone';
    const cells = this.#brushCells + (rimless ? 0 : RIM_CELLS * 2);

    ctx.beginPath();
    this.#footprintPath(ctx, this.#toMask(p), cells);

    const scale = this.#displayScale;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 3 / scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();

    if (this.#tool === 'clone' && this.#cloneOrigin) {
      const offset = this.#stroke?.cloneOffset;
      const m = this.#toMask(p);
      const source = offset
        ? { x: m.x - offset.x, y: m.y - offset.y }
        : this.#cloneOrigin;
      const cell = this.#cellSize;
      this.#drawCrosshair(ctx, { x: source.x * cell.x, y: source.y * cell.y });
    }
  }

  #drawCrosshair(ctx, p) {
    const scale = this.#displayScale;
    const arm = 8 / scale;
    ctx.beginPath();
    ctx.moveTo(p.x - arm, p.y);
    ctx.lineTo(p.x + arm, p.y);
    ctx.moveTo(p.x, p.y - arm);
    ctx.lineTo(p.x, p.y + arm);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 3 / scale;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  }

  get #displayScale() {
    const box = this.#composite.getBoundingClientRect();
    if (!box.width || !this.#composite.width) return 1;
    return box.width / this.#composite.width;
  }

  #footprintPath(ctx, centre, size) {
    if (this.#mode === 'draw') {
      const half = size / 2;
      if (this.#square) {
        ctx.rect(centre.x - half, centre.y - half, size, size);
      } else {
        ctx.arc(centre.x, centre.y, half, 0, Math.PI * 2);
      }
      return;
    }

    const span = Math.ceil(size) + 4;
    const stamp = this.#stampCanvas(span, span);
    const sctx = stamp.getContext('2d');
    sctx.globalCompositeOperation = 'copy';
    sctx.clearRect(0, 0, span, span);
    sctx.globalCompositeOperation = 'source-over';
    sctx.fillStyle = '#fff';

    const originX = Math.round(centre.x) - Math.round(span / 2);
    const originY = Math.round(centre.y) - Math.round(span / 2);
    const ox = centre.x - originX;
    const oy = centre.y - originY;
    const half = size / 2;
    if (this.#square) {
      sctx.fillRect(ox - half, oy - half, size, size);
    } else {
      sctx.beginPath();
      sctx.arc(ox, oy, half, 0, Math.PI * 2);
      sctx.fill();
    }

    const { data } = sctx.getImageData(0, 0, span, span);
    const lit = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx >= span || cy >= span) return false;
      return data[(cy * span + cx) * 4 + 3] >= MASK_THRESHOLD;
    };

    const cell = this.#cellSize;
    const px = (cx) => (originX + cx) * cell.x;
    const py = (cy) => (originY + cy) * cell.y;

    for (let cy = 0; cy < span; cy += 1) {
      for (let cx = 0; cx < span; cx += 1) {
        if (!lit(cx, cy)) continue;
        const x0 = px(cx);
        const y0 = py(cy);
        const x1 = px(cx + 1);
        const y1 = py(cy + 1);
        if (!lit(cx, cy - 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
        if (!lit(cx, cy + 1)) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
        if (!lit(cx - 1, cy)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
        if (!lit(cx + 1, cy)) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
      }
    }
  }

  #stampCanvas(width, height) {
    if (!this.#stampBuffer) this.#stampBuffer = document.createElement('canvas');
    if (this.#stampBuffer.width !== width || this.#stampBuffer.height !== height) {
      this.#stampBuffer.width = width;
      this.#stampBuffer.height = height;
    }
    return this.#stampBuffer;
  }


  #clearCursor() {
    const ctx = this.#cursor.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.#cursor.width, this.#cursor.height);
  }


  previewHsv({ hue = 0, saturation = 0, brightness = 0 }) {
    if (!this.hasImage) return;
    if (!this.#hsvSource) this.#hsvSource = this.#freezeStrokeLayer();

    const { width, height } = this.#mask;
    const ctx = this.#mask.getContext('2d');
    const src = this.#hsvSource.getContext('2d').getImageData(0, 0, width, height);
    const out = ctx.createImageData(width, height);

    const sScale = 1 + saturation / 100;
    const vScale = 1 + brightness / 100;

    for (let i = 0; i < src.data.length; i += 4) {
      const a = src.data[i + 3];
      if (a === 0) continue;

      const [h, s, v] = MaskEditor.#rgbToHsv(src.data[i], src.data[i + 1], src.data[i + 2]);
      const [r, g, b] = MaskEditor.#hsvToRgb(
        (((h + hue) % 360) + 360) % 360,
        Math.min(1, Math.max(0, s * sScale)),
        Math.min(1, Math.max(0, v * vScale)),
      );
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = a;
    }

    ctx.putImageData(out, 0, 0);
    this.#redrawNow();
  }

  commitHsv() {
    if (!this.#hsvSource) return;
    const preview = this.#freezeStrokeLayer();
    const ctx = this.#mask.getContext('2d');
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.#hsvSource, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.#pushUndo();
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(preview, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.#hsvSource = null;
    this.#redrawNow();
  }

  cancelHsv() {
    if (!this.#hsvSource) return;
    const ctx = this.#mask.getContext('2d');
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(this.#hsvSource, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    this.#hsvSource = null;
    this.#redrawNow();
  }

  static #rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    return [h, max === 0 ? 0 : d / max, max / 255];
  }

  static #hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    const [r, g, b] =
      h < 60 ? [c, x, 0] :
      h < 120 ? [x, c, 0] :
      h < 180 ? [0, c, x] :
      h < 240 ? [0, x, c] :
      h < 300 ? [x, 0, c] : [c, 0, x];
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }


  #snapshot() {
    return {
      layers: this.#layers.map((l) => ({
        id: l.id,
        visible: l.visible,
        base: l.base,
        pixels: l.canvas
          .getContext('2d')
          .getImageData(0, 0, l.canvas.width, l.canvas.height),
      })),
      active: this.#active,
      outset: this.#outset
        .getContext('2d')
        .getImageData(0, 0, this.#outset.width, this.#outset.height),
      canvas: { ...this.#dimensions },
      origin: { ...this.#origin },
      anchor: { ...this.#anchor },
    };
  }

  #restore(state) {
    const changed =
      state.canvas.width !== this.#dimensions.width ||
      state.canvas.height !== this.#dimensions.height;
    if (changed) {
      this.#canvas = { ...state.canvas };
      this.#resizeLayers();
    }
    this.#origin = { ...state.origin };
    this.#anchor = { ...(state.anchor ?? { x: 0, y: 0 }) };

    const stroke = this.#strokeSize;
    this.#layers = state.layers.map((l) => {
      const canvas = document.createElement('canvas');
      canvas.width = stroke.width;
      canvas.height = stroke.height;
      canvas.getContext('2d').putImageData(l.pixels, 0, 0);
      return { id: l.id, canvas, visible: l.visible, base: l.base };
    });
    this.#active = Math.min(state.active ?? 0, this.#layers.length - 1);
    this.#mask = this.#layers[this.#active].canvas;
    this.#outset.getContext('2d').putImageData(state.outset, 0, 0);
    if (changed) this.#applyTransform();
    this.#onLayersChange();
  }

  #pushUndo() {
    this.#undo.push(this.#snapshot());
    const limit = this.#mode === 'draw' ? DRAW_HISTORY_LIMIT : HISTORY_LIMIT;
    if (this.#undo.length > limit) this.#undo.shift();
    this.#redo = [];
    this.#onHistoryChange();
  }

  undo() {
    if (!this.#undo.length) return;
    this.#redo.push(this.#snapshot());
    this.#restore(this.#undo.pop());
    this.#redrawNow();
    this.#onHistoryChange();
  }

  redo() {
    if (!this.#redo.length) return;
    this.#undo.push(this.#snapshot());
    this.#restore(this.#redo.pop());
    this.#redrawNow();
    this.#onHistoryChange();
  }


  hasStrokes() {
    return this.hasMask();
  }

  hasMask() {
    if (!this.hasImage) return false;
    const src = this.#maskUnion();
    const { data } = src
      .getContext('2d')
      .getImageData(0, 0, src.width, src.height);
    for (let p = 3; p < data.length; p += 4) {
      if (data[p] >= MASK_THRESHOLD) return true;
    }
    return false;
  }

  exportMask() {
    return this.#renderMask({ transparent: false });
  }

  #renderMask({ transparent }) {
    const stencil = this.#maskUnion();
    const { width, height } = stencil;
    const src = stencil.getContext('2d').getImageData(0, 0, width, height);

    const cells = document.createElement('canvas');
    cells.width = width;
    cells.height = height;
    const cctx = cells.getContext('2d');
    const dest = cctx.createImageData(width, height);

    for (let p = 0; p < src.data.length; p += 4) {
      const on = src.data[p + 3] >= MASK_THRESHOLD ? 255 : 0;
      dest.data[p] = on;
      dest.data[p + 1] = on;
      dest.data[p + 2] = on;
      dest.data[p + 3] = transparent && !on ? 0 : 255;
    }
    cctx.putImageData(dest, 0, 0);

    const out = document.createElement('canvas');
    out.width = width * MASK_CELL;
    out.height = height * MASK_CELL;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(cells, 0, 0, out.width, out.height);
    return out.toDataURL('image/png').split(',')[1];
  }

  exportImage() {
    if (this.#mode === 'draw') {
      return this.#composite.toDataURL('image/png').split(',')[1];
    }
    const out = document.createElement('canvas');
    const { width, height } = this.#dimensions;
    out.width = width;
    out.height = height;
    const img = this.#imageSize;
    out.getContext('2d').drawImage(this.#image, this.#origin.x, this.#origin.y, img.width, img.height);
    return out.toDataURL('image/png').split(',')[1];
  }

  exportImageUrl() {
    return `data:image/png;base64,${this.exportImage()}`;
  }

  buildCompositeMask() {
    const stencil = this.#maskUnion();
    const { width: cw, height: ch } = stencil;
    const src = stencil.getContext('2d').getImageData(0, 0, cw, ch);

    const lit = new Uint8Array(cw * ch);
    for (let i = 0; i < cw * ch; i += 1) {
      lit[i] = src.data[i * 4 + 3] >= MASK_THRESHOLD ? 255 : 0;
    }

    const grown = MaskEditor.#dilate(lit, cw, ch, COMPOSITE_DILATE_CELLS);

    for (let x = 0; x < cw; x += 1) {
      if (!lit[x]) grown[x] = 0;
      const last = (ch - 1) * cw + x;
      if (!lit[last]) grown[last] = 0;
    }
    for (let y = 0; y < ch; y += 1) {
      const l = y * cw;
      if (!lit[l]) grown[l] = 0;
      const r = y * cw + cw - 1;
      if (!lit[r]) grown[r] = 0;
    }

    const small = document.createElement('canvas');
    small.width = cw;
    small.height = ch;
    const sctx = small.getContext('2d');
    const flat = sctx.createImageData(cw, ch);
    for (let i = 0; i < cw * ch; i += 1) {
      const v = grown[i];
      flat.data[i * 4] = v;
      flat.data[i * 4 + 1] = v;
      flat.data[i * 4 + 2] = v;
      flat.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(flat, 0, 0);

    const { width: iw, height: ih } = this.#dimensions;
    const out = document.createElement('canvas');
    out.width = Math.max(1, iw);
    out.height = Math.max(1, ih);
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(small, 0, 0, out.width, out.height);

    const blurred = octx.getImageData(0, 0, out.width, out.height);
    MaskEditor.#boxBlurChannel(blurred, out.width, out.height, COMPOSITE_BLUR_RADIUS, COMPOSITE_BLUR_PASSES);

    for (let p = 0; p < blurred.data.length; p += 4) {
      blurred.data[p + 3] = blurred.data[p];
    }
    octx.putImageData(blurred, 0, 0);
    return out;
  }

  static #dilate(srcArr, w, h, r) {
    if (r <= 0) return Uint8Array.from(srcArr);
    const tmp = new Uint8Array(w * h);
    const dst = new Uint8Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let v = 0;
        for (let k = -r; k <= r && !v; k += 1) {
          const xx = x + k;
          if (xx >= 0 && xx < w && srcArr[y * w + xx]) v = 255;
        }
        tmp[y * w + x] = v;
      }
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let v = 0;
        for (let k = -r; k <= r && !v; k += 1) {
          const yy = y + k;
          if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 255;
        }
        dst[y * w + x] = v;
      }
    }
    return dst;
  }

  static #boxBlurChannel(image, w, h, radius, passes) {
    const { data } = image;
    const line = new Float32Array(Math.max(w, h));
    const span = radius * 2 + 1;

    for (let pass = 0; pass < passes; pass += 1) {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) line[x] = data[(y * w + x) * 4];
        let sum = 0;
        for (let x = -radius; x <= radius; x += 1) sum += line[Math.min(Math.max(x, 0), w - 1)];
        for (let x = 0; x < w; x += 1) {
          data[(y * w + x) * 4] = sum / span;
          sum -= line[Math.min(Math.max(x - radius, 0), w - 1)];
          sum += line[Math.min(Math.max(x + radius + 1, 0), w - 1)];
        }
      }
      for (let x = 0; x < w; x += 1) {
        for (let y = 0; y < h; y += 1) line[y] = data[(y * w + x) * 4];
        let sum = 0;
        for (let y = -radius; y <= radius; y += 1) sum += line[Math.min(Math.max(y, 0), h - 1)];
        for (let y = 0; y < h; y += 1) {
          data[(y * w + x) * 4] = sum / span;
          sum -= line[Math.min(Math.max(y - radius, 0), h - 1)];
          sum += line[Math.min(Math.max(y + radius + 1, 0), h - 1)];
        }
      }
    }
  }

  exportFocusedCrop() {
    if (!this.#focus || !this.#image) return null;
    const context = this.#contextRect(this.#focus);
    const { width, height } = MaskEditor.focusOutputSize(context);

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(
      this.#image,
      context.x - this.#origin.x, context.y - this.#origin.y, context.width, context.height,
      0, 0, width, height,
    );

    const cell = this.#cellSize;
    const stencil = document.createElement('canvas');
    stencil.width = width;
    stencil.height = height;
    const sctx = stencil.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(
      this.#maskUnion(),
      context.x / cell.x, context.y / cell.y,
      context.width / cell.x, context.height / cell.y,
      0, 0, width, height,
    );

    const src = sctx.getImageData(0, 0, width, height);
    const dest = sctx.createImageData(width, height);
    const target = this.#inpaintRect(this.#focus);
    const sx = ((target.x - context.x) / context.width) * width;
    const sy = ((target.y - context.y) / context.height) * height;
    const sw = (target.width / context.width) * width;
    const sh = (target.height / context.height) * height;

    let masked = false;
    for (let i = 0; i < width * height && !masked; i += 1) {
      const px = i % width;
      const py = (i - px) / width;
      if (px < sx || px >= sx + sw || py < sy || py >= sy + sh) continue;
      if (src.data[i * 4 + 3] >= MASK_THRESHOLD) masked = true;
    }

    for (let p = 0; p < src.data.length; p += 4) {
      const i = p / 4;
      const px = i % width;
      const py = (i - px) / width;
      const inTarget = px >= sx && px < sx + sw && py >= sy && py < sy + sh;

      const on = inTarget
        ? (masked ? (src.data[p + 3] >= MASK_THRESHOLD ? 255 : 0) : 255)
        : 0;
      dest.data[p] = on;
      dest.data[p + 1] = on;
      dest.data[p + 2] = on;
      dest.data[p + 3] = 255;
    }
    sctx.putImageData(dest, 0, 0);

    return {
      image: out.toDataURL('image/png').split(',')[1],
      mask: stencil.toDataURL('image/png').split(',')[1],
      width,
      height,
      context,
      inpaint: target,
    };
  }

  static focusOutputSize({ width, height }) {
    const maxRatio = FOCUS_MAX_DIMENSION / FOCUS_MIN_DIMENSION;
    let ratio = width / height;
    ratio = Math.min(Math.max(ratio, 1 / maxRatio), maxRatio);

    let h = Math.sqrt(FOCUS_TARGET_AREA / ratio);
    let w = h * ratio;

    const shrink = Math.min(
      1,
      FOCUS_MAX_DIMENSION / w,
      FOCUS_MAX_DIMENSION / h,
    );
    w *= shrink;
    h *= shrink;

    const snap = (v) => {
      const stepped = Math.round(v / FOCUS_GRID) * FOCUS_GRID;
      return Math.min(
        Math.max(stepped, FOCUS_MIN_DIMENSION),
        FOCUS_MAX_DIMENSION,
      );
    };
    let outW = snap(w);
    let outH = snap(h);

    while (outW * outH > FOCUS_TARGET_AREA) {
      if (outW >= outH && outW - FOCUS_GRID >= FOCUS_MIN_DIMENSION) {
        outW -= FOCUS_GRID;
      } else if (outH - FOCUS_GRID >= FOCUS_MIN_DIMENSION) {
        outH -= FOCUS_GRID;
      } else {
        break;
      }
    }

    return { width: outW, height: outH };
  }

  exportComposite() {
    return this.#composite.toDataURL('image/png');
  }

  exportMaskPreview() {
    return `data:image/png;base64,${this.#renderMask({ transparent: true })}`;
  }

  #focusStencil(inpainted) {
    const union = this.#maskUnion();
    const { width, height } = union;
    const cell = this.#cellSize;

    const left = Math.floor(inpainted.x / cell.x);
    const top = Math.floor(inpainted.y / cell.y);
    const right = Math.ceil((inpainted.x + inpainted.width) / cell.x);
    const bottom = Math.ceil((inpainted.y + inpainted.height) / cell.y);

    const src = union.getContext('2d').getImageData(0, 0, width, height);
    const stencil = document.createElement('canvas');
    stencil.width = width;
    stencil.height = height;
    const sctx = stencil.getContext('2d');
    const dest = sctx.createImageData(width, height);

    let painted = false;
    for (let p = 0; p < src.data.length; p += 4) {
      const i = p / 4;
      const px = i % width;
      const py = (i - px) / width;
      const inTarget = px >= left && px < right && py >= top && py < bottom;
      const on = inTarget && src.data[p + 3] >= MASK_THRESHOLD;
      if (on) painted = true;
      dest.data[p] = 255;
      dest.data[p + 1] = 255;
      dest.data[p + 2] = 255;
      dest.data[p + 3] = on ? 255 : 0;
    }
    if (!painted) return null;

    sctx.putImageData(dest, 0, 0);
    return stencil;
  }

  exportFocusedPreview() {
    if (!this.#focus || !this.#image) return null;
    const context = this.#contextRect(this.#focus);
    const inpainted = this.#inpaintRect(this.#focus);

    const out = document.createElement('canvas');
    const surface = this.#dimensions;
    out.width = surface.width;
    out.height = surface.height;
    const ctx = out.getContext('2d');
    const img = this.#imageSize;
    ctx.drawImage(this.#image, this.#origin.x, this.#origin.y, img.width, img.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, out.width, out.height);
    ctx.rect(inpainted.x, inpainted.y, inpainted.width, inpainted.height);
    ctx.fillStyle = FOCUS_PREVIEW_DIM_RGB;
    ctx.globalAlpha = FOCUS_PREVIEW_DIM_ALPHA;
    ctx.fill('evenodd');
    ctx.restore();

    ctx.save();
    const strokes = this.#focusStencil(inpainted);
    if (strokes) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = MASK_PREVIEW_ALPHA;
      ctx.drawImage(strokes, 0, 0, out.width, out.height);
    } else {
      ctx.fillStyle = FOCUS_PREVIEW_FILL_RGB;
      ctx.globalAlpha = FOCUS_PREVIEW_FILL_ALPHA;
      ctx.fillRect(inpainted.x, inpainted.y, inpainted.width, inpainted.height);
    }
    ctx.restore();

    ctx.save();
    const line = Math.max(1, out.width / 300);
    ctx.strokeStyle = FOCUS_PREVIEW_EDGE_RGB;
    ctx.globalAlpha = FOCUS_PREVIEW_EDGE_ALPHA;
    ctx.lineWidth = line;
    ctx.strokeRect(inpainted.x, inpainted.y, inpainted.width, inpainted.height);
    ctx.restore();

    void context;

    return out.toDataURL('image/png');
  }

  exportMaskedImage() {
    const out = document.createElement('canvas');
    const surface = this.#dimensions;
    out.width = surface.width;
    out.height = surface.height;
    const ctx = out.getContext('2d');
    const img = this.#imageSize;
    ctx.drawImage(this.#image, this.#origin.x, this.#origin.y, img.width, img.height);

    const union = this.#maskUnion();
    const { width, height } = union;
    const src = union.getContext('2d').getImageData(0, 0, width, height);
    const stencil = document.createElement('canvas');
    stencil.width = width;
    stencil.height = height;
    const sctx = stencil.getContext('2d');
    const dest = sctx.createImageData(width, height);
    for (let p = 0; p < src.data.length; p += 4) {
      const on = src.data[p + 3] >= MASK_THRESHOLD ? 255 : 0;
      dest.data[p] = 255;
      dest.data[p + 1] = 255;
      dest.data[p + 2] = 255;
      dest.data[p + 3] = on;
    }
    sctx.putImageData(dest, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = MASK_PREVIEW_ALPHA;
    ctx.drawImage(stencil, 0, 0, out.width, out.height);
    ctx.globalAlpha = 1;
    return out.toDataURL('image/png');
  }
}
