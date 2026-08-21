const promptBlock = document.querySelector('.prompt-block');
const tabs = [...document.querySelectorAll('.prompt-tab[role="tab"]')];
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (promptBlock?.classList.contains('prompt-block--stacked')) return;
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      const field = document.querySelector(`.prompt-field[data-for="${other.dataset.target}"]`);
      if (field) field.hidden = !selected;
    }
    syncEmphasis();
  });
}

const promptDetach = document.getElementById('prompt-detach');
const detachHomes = {
  tabbed: document.querySelector('.prompt-tab-group[data-target="undesired"]'),
  stacked: document.querySelector('.prompt-subhead'),
};

export let promptStacked = false;

function setPromptStacked(stacked, { focusButton = true } = {}) {
  promptStacked = stacked;
  promptBlock.classList.toggle('prompt-block--stacked', stacked);
  detachHomes[stacked ? 'stacked' : 'tabbed']?.append(promptDetach);
  if (focusButton) promptDetach.focus();
  promptDetach.setAttribute('aria-pressed', String(stacked));
  const label = stacked ? 'Show one prompt box at a time' : 'Show both prompt boxes';
  promptDetach.setAttribute('aria-label', label);
  promptDetach.title = label;
  for (const tab of tabs) {
    if (stacked) tab.removeAttribute('role');
    else tab.setAttribute('role', 'tab');
  }
  document.querySelector('.prompt-tabs')
    ?.setAttribute('role', stacked ? 'presentation' : 'tablist');
  syncEmphasis();
  autoGrow();
}

promptDetach?.addEventListener('click', () => {
  setPromptStacked(!promptStacked);
  scheduleSave();
});

export const FURRY_TAG = 'fur dataset';

const datasetToggle = document.getElementById('dataset-toggle');
let furryMode = false;
datasetToggle?.addEventListener('click', () => {
  furryMode = !furryMode;
  datasetToggle.setAttribute('aria-pressed', String(furryMode));
  datasetToggle.setAttribute('aria-label', furryMode ? 'Switch to anime mode' : 'Switch to furry mode');
  datasetToggle.title = furryMode ? 'Furry mode' : 'Anime mode';
});

const RESOLUTION_GROUPS = [
  {
    label: 'Normal',
    presets: [
      { name: 'Portrait', width: 832, height: 1216 },
      { name: 'Landscape', width: 1216, height: 832 },
      { name: 'Square', width: 1024, height: 1024 },
    ],
  },
  {
    label: 'Large',
    presets: [
      { name: 'Portrait', width: 1024, height: 1536 },
      { name: 'Landscape', width: 1536, height: 1024 },
      { name: 'Square', width: 1472, height: 1472 },
    ],
  },
  {
    label: 'Wallpaper',
    presets: [
      { name: 'Portrait', width: 1088, height: 1920 },
      { name: 'Landscape', width: 1920, height: 1088 },
    ],
  },
  {
    label: 'Small',
    presets: [
      { name: 'Portrait', width: 512, height: 768 },
      { name: 'Landscape', width: 768, height: 512 },
      { name: 'Square', width: 640, height: 640 },
    ],
  },
  { label: 'Custom', presets: [{ name: 'Custom' }] },
];

const RESOLUTIONS = RESOLUTION_GROUPS.flatMap((group) =>
  group.presets.map((preset) => ({
    ...preset,
    value: preset.width ? `${preset.width}x${preset.height}` : 'custom',
    label: preset.width ? `${preset.name} (${preset.width}x${preset.height})` : preset.name,
  })),
);

const resolution = document.getElementById('resolution');
const resolutionListbox = document.getElementById('resolution-listbox');
const resolutionLabel = document.getElementById('resolution-label');

let selectedResolution = resolution.dataset.value || '832x1216';
let resolutionActiveIndex = 0;

for (const group of RESOLUTION_GROUPS) {
  const heading = document.createElement('li');
  heading.className = 'listbox__group-label';
  heading.setAttribute('role', 'presentation');
  heading.textContent = group.label;
  resolutionListbox.append(heading);

  for (const preset of group.presets) {
    const value = preset.width ? `${preset.width}x${preset.height}` : 'custom';
    const option = document.createElement('li');
    option.className = 'listbox__option';
    option.setAttribute('role', 'option');
    option.id = `resolution-option-${value}`;
    option.dataset.value = value;
    option.textContent = preset.width
      ? `${preset.name} (${preset.width}x${preset.height})`
      : preset.name;
    resolutionListbox.append(option);
  }
}

const resolutionOptions = [...resolutionListbox.querySelectorAll('.listbox__option')];

function renderResolution() {
  const entry = RESOLUTIONS.find((r) => r.value === selectedResolution) ?? RESOLUTIONS[0];
  selectedResolution = entry.value;
  resolution.dataset.value = entry.value;
  resolutionLabel.textContent = entry.name;
  for (const option of resolutionOptions) {
    option.setAttribute('aria-selected', String(option.dataset.value === entry.value));
  }
}

function setResolutionActive(index, { scroll = true, skip = 0 } = {}) {
  const wrap = (i) => (i + resolutionOptions.length) % resolutionOptions.length;
  let target = wrap(index);
  if (skip !== 0) {
    for (let moved = 0; moved < resolutionOptions.length; moved += 1) {
      break;
      target = wrap(target + skip);
    }
  }
  resolutionActiveIndex = target;
  for (const [i, option] of resolutionOptions.entries()) {
    option.classList.toggle('listbox__option--active', i === resolutionActiveIndex);
  }
  const current = resolutionOptions[resolutionActiveIndex];
  resolution.setAttribute('aria-activedescendant', current.id);
  if (scroll) current.scrollIntoView({ block: 'nearest' });
}

const resolutionMenuOpen = () => !resolutionListbox.hidden;

function openResolutionMenu() {
  resolutionListbox.hidden = false;
  resolution.setAttribute('aria-expanded', 'true');
  const index = Math.max(
    0,
    resolutionOptions.findIndex((o) => o.dataset.value === selectedResolution),
  );
  setResolutionActive(index, { scroll: false });
  resolutionOptions[index].scrollIntoView({ block: 'center' });
}

function closeResolutionMenu({ focus = false } = {}) {
  resolutionListbox.hidden = true;
  resolution.setAttribute('aria-expanded', 'false');
  resolution.removeAttribute('aria-activedescendant');
  for (const option of resolutionOptions) {
    option.classList.remove('listbox__option--active');
  }
  if (focus) resolution.focus();
}


function applyResolution(width, height) {
  for (const [id, size] of [['width', width], ['height', height]]) {
    const input = document.getElementById(id);
    input.value = String(size);
    input.dataset.lastValid = String(size);
  }
  syncResolutionSelect();
}

function commitResolution(value) {
  selectedResolution = value;
  renderResolution();
  closeResolutionMenu({ focus: true });
  if (value === 'custom') return;
  const [w, h] = value.split('x');
  for (const [id, size] of [['width', w], ['height', h]]) {
    const input = document.getElementById(id);
    input.value = size;
    input.dataset.lastValid = size;
  }
  syncCost();
}

resolution.addEventListener('click', (event) => {
  event.stopPropagation();
  if (resolutionMenuOpen()) closeResolutionMenu();
  else openResolutionMenu();
});

resolutionListbox.addEventListener('click', (event) => {
  event.stopPropagation();
  const option = event.target.closest('.listbox__option');
  if (option) commitResolution(option.dataset.value);
});

resolutionListbox.addEventListener('mousemove', (event) => {
  const option = event.target.closest('.listbox__option');
  if (option) setResolutionActive(resolutionOptions.indexOf(option));
});

resolution.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (resolutionMenuOpen()) setResolutionActive(resolutionActiveIndex + 1, { skip: 1 });
      else openResolutionMenu();
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (resolutionMenuOpen()) setResolutionActive(resolutionActiveIndex - 1, { skip: -1 });
      else openResolutionMenu();
      break;
    case 'Home':
      if (!resolutionMenuOpen()) break;
      event.preventDefault();
      setResolutionActive(0, { skip: 1 });
      break;
    case 'End':
      if (!resolutionMenuOpen()) break;
      event.preventDefault();
      setResolutionActive(resolutionOptions.length - 1, { skip: -1 });
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (resolutionMenuOpen()) {
        commitResolution(resolutionOptions[resolutionActiveIndex].dataset.value);
      } else {
        openResolutionMenu();
      }
      break;
    case 'Escape':
      if (resolutionMenuOpen()) {
        event.preventDefault();
        closeResolutionMenu({ focus: true });
      }
      break;
    case 'Tab':
      if (resolutionMenuOpen()) closeResolutionMenu();
      break;
    default:
      break;
  }
});

document.addEventListener('click', () => {
  if (resolutionMenuOpen()) closeResolutionMenu();
});

renderResolution();

const DIMENSION_STEP = 64;
const MAX_PIXELS = 3 * 1024 * 1024;
const FIT_SHORT_AXIS = 896;
const MAX_FIT_ASPECT_ERROR = 0.01;

const MAX_INPAINT_DIMENSION = 2560;

function overPixelBudget(w, h) {
  return Number.isFinite(w) && Number.isFinite(h) && w * h > MAX_PIXELS;
}

function fitToValid(width, height, { maxSide = DIMENSION_MAX } = {}) {
  if (!(width > 0) || !(height > 0)) {
    return { width: DIMENSION_MIN, height: DIMENSION_MIN };
  }

  const sideCap = Math.min(maxSide, DIMENSION_MAX);

  const snap = (n) => Math.max(
    Math.round(n / DIMENSION_STEP) * DIMENSION_STEP,
    DIMENSION_MIN,
  );

  
  const w = snap(width);
  const h = snap(height);
  if (w * h <= MAX_PIXELS && w <= sideCap && h <= sideCap) {
    
    const aspect = width / height;
    const snapErr = Math.abs(w / h - aspect) / aspect;
    if (snapErr > 1e-9) {
      const sourceScale = Math.sqrt(width * height);
      const drift = (a, b) => Math.abs(Math.sqrt(a * b) / sourceScale - 1);
      const snapDrift = drift(w, h);

      
      const REACH = 3;
      let better = null;
      for (let iw = -REACH; iw <= REACH; iw += 1) {
        for (let ih = -REACH; ih <= REACH; ih += 1) {
          const cw = w + iw * DIMENSION_STEP;
          const ch = h + ih * DIMENSION_STEP;
          if (cw < DIMENSION_MIN || ch < DIMENSION_MIN) continue;
          if (cw > sideCap || ch > sideCap) continue;
          if (cw * ch > MAX_PIXELS) continue;
          const err = Math.abs(cw / ch - aspect) / aspect;
          if (err >= snapErr - 1e-9) continue;
          if (drift(cw, ch) > snapDrift + 0.02) continue;
          if (!better || err < better.err) better = { width: cw, height: ch, err };
        }
      }
      if (better) return { width: better.width, height: better.height };
    }
    return { width: w, height: h };
  }

  
  const aspect = width / height;
  const portrait = width <= height;
  let best = null;

  for (let long = DIMENSION_MIN; long <= sideCap; long += DIMENSION_STEP) {
    const rawShort = portrait ? long * aspect : long / aspect;
    for (const round of [Math.floor, Math.ceil]) {
      const short = round(rawShort / DIMENSION_STEP) * DIMENSION_STEP;
      if (short < DIMENSION_MIN || short > sideCap) continue;
      const cand = portrait
        ? { width: short, height: long }
        : { width: long, height: short };
      if (cand.width * cand.height > MAX_PIXELS) continue;

      
      const err = Math.abs(cand.width / cand.height - aspect) / aspect;
      const area = cand.width * cand.height;
      if (err > MAX_FIT_ASPECT_ERROR) continue;
      if (
        !best
        || area > best.area
        || (area === best.area && err < best.err)
      ) {
        best = { ...cand, err, area };
      }
    }
  }

  
  if (!best) {
    const long = Math.min(sideCap, DIMENSION_MAX);
    const short = DIMENSION_MIN;
    if (long * short <= MAX_PIXELS) {
      return portrait
        ? { width: short, height: long }
        : { width: long, height: short };
    }
    return { width: DIMENSION_MIN, height: DIMENSION_MIN };
  }
  return { width: best.width, height: best.height };
}

function snapDimension(input) {
  const raw = Number(input.value);
  if (!Number.isFinite(raw) || input.value.trim() === '') {
    input.value = input.dataset.lastValid ?? input.min;
    return;
  }
  const snapped = Math.round(raw / DIMENSION_STEP) * DIMENSION_STEP;
  input.value = String(Math.min(Math.max(snapped, DIMENSION_MIN), DIMENSION_MAX));
  input.dataset.lastValid = input.value;
  clampToPixelBudget(input.id);
  syncResolutionSelect();
}


function clampToPixelBudget(changedId) {
  const otherId = changedId === 'width' ? 'height' : 'width';
  const changed = document.getElementById(changedId);
  const other = document.getElementById(otherId);

  const changedValue = Number(changed.value);
  const otherValue = Number(other.value);
  if (!Number.isFinite(changedValue) || !Number.isFinite(otherValue)) return;
  if (changedValue * otherValue <= MAX_PIXELS) return;

  const room = Math.floor(MAX_PIXELS / changedValue / DIMENSION_STEP) * DIMENSION_STEP;
  if (room >= DIMENSION_MIN) {
    other.value = String(room);
    other.dataset.lastValid = other.value;
    return;
  }

  
  const capped = Math.floor(MAX_PIXELS / DIMENSION_MIN / DIMENSION_STEP) * DIMENSION_STEP;
  changed.value = String(Math.max(Math.min(changedValue, capped), DIMENSION_MIN));
  changed.dataset.lastValid = changed.value;
  other.value = String(DIMENSION_MIN);
  other.dataset.lastValid = other.value;
}

function currentResolution() {
  return ['width', 'height'].map((id) => {
    const input = document.getElementById(id);
    const value = Number(input.value);
    const snapped = Math.round(value / DIMENSION_STEP) * DIMENSION_STEP;
    if (!Number.isFinite(value) || snapped < Number(input.min)) {
      return Number(input.dataset.lastValid ?? input.min);
    }
    return Math.min(snapped, DIMENSION_MAX);
  });
}

function syncResolutionSelect() {
  const pair = `${document.getElementById('width').value}x${document.getElementById('height').value}`;
  const match = RESOLUTIONS.some((r) => r.value === pair);
  selectedResolution = match ? pair : 'custom';
  renderResolution();
  syncDimensionMax();
  syncCost();
}

for (const id of ['width', 'height']) {
  const input = document.getElementById(id);
  input.dataset.lastValid = input.value;
  input.addEventListener('blur', () => snapDimension(input));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      snapDimension(input);
    }
  });
  input.addEventListener('input', () => syncResolutionSelect());
  input.addEventListener('change', () => {
      syncResolutionSelect();
  });
}

document.getElementById('swap-dimensions')?.addEventListener('click', () => {
  const width = document.getElementById('width');
  const height = document.getElementById('height');
  [width.value, height.value] = [height.value, width.value];
  width.dataset.lastValid = width.value;
  height.dataset.lastValid = height.value;
  syncResolutionSelect();
});

const STEPS_CEILING = 50;

const DIMENSION_MIN = Number(document.getElementById('width').min);
const DIMENSION_MAX = Number(document.getElementById('width').max);

function syncDimensionMax() {
  for (const id of ['width', 'height']) {
    document.getElementById(id).max = String(DIMENSION_MAX);
  }
}

function applyStepsCeiling() {
  for (const id of ['steps', 'steps-range']) {
    const control = document.getElementById(id);
    if (!control) continue;
    control.max = String(STEPS_CEILING);
    if (Number(control.value) > STEPS_CEILING) control.value = String(STEPS_CEILING);
  }

  syncDimensionMax();
  syncCost();
}

const MAX_IMAGE_COUNT = 4;
let imageCount = 1;

const imageCountButtons = document.getElementById('image-count-buttons');


function renderImageCount() {
  if (!imageCountButtons) return;

  for (let count = 1; count <= MAX_IMAGE_COUNT; count += 1) {
    let button = imageCountButtons.children[count - 1];
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'image-count__button';
      button.dataset.count = String(count);
      button.setAttribute('role', 'radio');
      button.textContent = String(count);
      imageCountButtons.append(button);
    }
    button.setAttribute('aria-checked', String(count === imageCount));
  }
}

function setImageCount(count) {
  const next = Math.min(Math.max(count, 1), MAX_IMAGE_COUNT);
  if (next === imageCount) return;
  imageCount = next;
  renderImageCount();
  syncCost();
  if (imageCountReady) saveDraft();
}

let imageCountReady = false;

imageCountButtons?.addEventListener('click', (event) => {
  const button = event.target.closest('.image-count__button');
  if (!button || button.disabled) return;
  setImageCount(Number(button.dataset.count));
});

renderImageCount();

const MODEL_GROUPS = [
  {
    label: 'Newest',
    models: [
      {
        value: 'nai-diffusion-5-curated',
        name: 'NAI Diffusion V5 Curated',
        desc: 'A version of the newest model trained on a curated subset of images. Recommended for streaming.',
      },
      {
        value: 'nai-diffusion-5-full',
        name: 'NAI Diffusion V5 Full',
        desc: 'The newest and best model.',
      },
    ],
  },
  {
    label: 'Previous',
    models: [
      {
        value: 'nai-diffusion-4-5-curated',
        name: 'NAI Diffusion V4.5 Curated',
        desc: 'A version of the previous model trained on a curated subset of images. Recommended for streaming.',
      },
      {
        value: 'nai-diffusion-4-5-full',
        name: 'NAI Diffusion V4.5 Full',
        desc: 'The previous model, soon to be replaced by V5',
      },
    ],
  },
  {
    label: 'Legacy',
    models: [
      {
        value: 'nai-diffusion-4-curated',
        name: 'NAI Diffusion V4 Curated',
        desc: 'The V4 model trained on a curated subset of images. No longer recommended for use.',
      },
      {
        value: 'nai-diffusion-4-full',
        name: 'NAI Diffusion V4 Full',
        desc: 'The V4 model. No longer recommended for use.',
      },
      {
        value: 'nai-diffusion-3',
        name: 'NAI Diffusion Anime V3',
        desc: 'The previous model. No longer recommended for use.',
      },
      {
        value: 'nai-diffusion-furry-3',
        name: 'NAI Diffusion Furry V3',
        desc: 'The previous furry model. No longer recommended for use.',
      },
    ],
  },
];

const MODELS = MODEL_GROUPS.flatMap((g) => g.models);

const V5_MODELS = new Set(['nai-diffusion-5-curated', 'nai-diffusion-5-full']);
const isV5Model = (model) => V5_MODELS.has(model);

let syncTransparentBg = () => {};
let syncModelFeatures = () => {};

const modelCombo = document.getElementById('model');
const modelListbox = document.getElementById('model-listbox');
const modelDesc = document.getElementById('model-desc');
const modelTitle = document.getElementById('model-title');

let selectedModel = modelCombo.dataset.value || 'nai-diffusion-5-full';
let activeIndex = 0;

for (const group of MODEL_GROUPS) {
  const heading = document.createElement('li');
  heading.className = 'listbox__group-label';
  heading.setAttribute('role', 'presentation');
  heading.textContent = group.label.toUpperCase();
  modelListbox.append(heading);

  for (const entry of group.models) {
    const option = document.createElement('li');
    option.className = 'listbox__option';
    option.setAttribute('role', 'option');
    option.id = `model-option-${entry.value}`;
    option.dataset.value = entry.value;

    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = entry.name;
    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = entry.desc;
    option.append(name, desc);

    modelListbox.append(option);
  }
}

const modelOptions = [...modelListbox.querySelectorAll('.listbox__option')];

function renderModel() {
  const entry = MODELS.find((m) => m.value === selectedModel) ?? MODELS[0];
  selectedModel = entry.value;
  modelCombo.dataset.value = entry.value;
  modelTitle.textContent = entry.name;
  modelDesc.textContent = entry.desc;

  for (const option of modelOptions) {
    option.setAttribute('aria-selected', String(option.dataset.value === entry.value));
  }

  syncTransparentBg();
  syncModelFeatures();
  syncUcPresets();
}

function setActive(index, { scroll = true } = {}) {
  activeIndex = (index + modelOptions.length) % modelOptions.length;
  for (const [i, option] of modelOptions.entries()) {
    option.classList.toggle('listbox__option--active', i === activeIndex);
  }
  const current = modelOptions[activeIndex];
  modelCombo.setAttribute('aria-activedescendant', current.id);
  if (scroll) current.scrollIntoView({ block: 'nearest' });
}

const modelMenuOpen = () => !modelListbox.hidden;

function openModelMenu() {
  modelListbox.hidden = false;
  modelCombo.setAttribute('aria-expanded', 'true');
  modelListbox.scrollTop = 0;
  setActive(
    Math.max(0, modelOptions.findIndex((o) => o.dataset.value === selectedModel)),
    { scroll: false },
  );
}

function closeModelMenu({ focus = false } = {}) {
  modelListbox.hidden = true;
  modelCombo.setAttribute('aria-expanded', 'false');
  modelCombo.removeAttribute('aria-activedescendant');
  for (const option of modelOptions) option.classList.remove('listbox__option--active');
  if (focus) modelCombo.focus();
}

function commitModel(value) {
  selectedModel = value;
  renderModel();
  closeModelMenu({ focus: true });
  renderVibes();
}

modelCombo.addEventListener('click', (event) => {
  event.stopPropagation();
  if (modelMenuOpen()) closeModelMenu();
  else openModelMenu();
});

modelListbox.addEventListener('click', (event) => {
  event.stopPropagation();
  const option = event.target.closest('.listbox__option');
  if (option) commitModel(option.dataset.value);
});

modelListbox.addEventListener('mousemove', (event) => {
  const option = event.target.closest('.listbox__option');
  if (option) setActive(modelOptions.indexOf(option));
});

modelCombo.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (modelMenuOpen()) setActive(activeIndex + 1);
      else openModelMenu();
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (modelMenuOpen()) setActive(activeIndex - 1);
      else openModelMenu();
      break;
    case 'Home':
      if (!modelMenuOpen()) break;
      event.preventDefault();
      setActive(0);
      break;
    case 'End':
      if (!modelMenuOpen()) break;
      event.preventDefault();
      setActive(modelOptions.length - 1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (modelMenuOpen()) commitModel(modelOptions[activeIndex].dataset.value);
      else openModelMenu();
      break;
    case 'Escape':
      if (modelMenuOpen()) {
        event.preventDefault();
        closeModelMenu({ focus: true });
      }
      break;
    case 'Tab':
      if (modelMenuOpen()) closeModelMenu();
      break;
    default:
      break;
  }
});

document.addEventListener('click', () => {
  if (modelMenuOpen()) closeModelMenu();
});

const UC_PRESET_OPTIONS = [
  { value: 'heavy', label: 'Heavy' },
  { value: 'light', label: 'Light' },
  { value: 'human_focus', label: 'Human Focus' },
  { value: 'furry_focus', label: 'Furry Focus' },
  { value: 'none', label: 'None' },
];

const FURRY_FOCUS_MODELS = new Set([
  'nai-diffusion-4-5-full',
  'nai-diffusion-5-curated',
  'nai-diffusion-5-full',
]);

const ucPresetCombo = document.getElementById('uc-preset');
const ucPresetListbox = document.getElementById('uc-preset-listbox');
const ucPresetLabel = document.getElementById('uc-preset-label-value');

for (const entry of UC_PRESET_OPTIONS) {
  const option = document.createElement('li');
  option.className = 'listbox__option';
  option.setAttribute('role', 'option');
  option.id = `uc-preset-option-${entry.value}`;
  option.dataset.value = entry.value;
  option.textContent = entry.label;
  ucPresetListbox.append(option);
}

const ucPresetOptions = [...ucPresetListbox.querySelectorAll('.listbox__option')];
let ucPresetActiveIndex = 0;

function ucPresetAllowed(value) {
  return value !== 'furry_focus' || FURRY_FOCUS_MODELS.has(selectedModel);
}

function syncUcPresets() {
  for (const option of ucPresetOptions) {
    option.hidden = !ucPresetAllowed(option.dataset.value);
  }
  if (!ucPresetAllowed(ucPresetCombo.dataset.value)) {
    ucPresetCombo.dataset.value = 'heavy';
  }
  renderUcPreset();
}

function renderUcPreset() {
  const entry = UC_PRESET_OPTIONS.find((o) => o.value === ucPresetCombo.dataset.value)
    ?? UC_PRESET_OPTIONS[0];
  ucPresetCombo.dataset.value = entry.value;
  ucPresetLabel.textContent = entry.label;
  for (const option of ucPresetOptions) {
    option.setAttribute('aria-selected', String(option.dataset.value === entry.value));
  }
}

renderModel();

Object.defineProperty(ucPresetCombo, 'value', {
  get: () => ucPresetCombo.dataset.value,
  set: (next) => {
    if (!UC_PRESET_OPTIONS.some((o) => o.value === String(next))) return;
    if (!ucPresetAllowed(String(next))) return;
    ucPresetCombo.dataset.value = String(next);
    renderUcPreset();
  },
});

const ucPresetMenuOpen = () => !ucPresetListbox.hidden;

function setUcPresetActive(index, { scroll = true } = {}) {
  ucPresetActiveIndex = (index + ucPresetOptions.length) % ucPresetOptions.length;
  for (const [i, option] of ucPresetOptions.entries()) {
    option.classList.toggle('listbox__option--active', i === ucPresetActiveIndex);
  }
  const current = ucPresetOptions[ucPresetActiveIndex];
  ucPresetCombo.setAttribute('aria-activedescendant', current.id);
  if (scroll) current.scrollIntoView({ block: 'nearest' });
}

function openUcPresetMenu() {
  ucPresetListbox.hidden = false;
  ucPresetCombo.setAttribute('aria-expanded', 'true');
  setUcPresetActive(
    Math.max(0, ucPresetOptions.findIndex((o) => o.dataset.value === ucPresetCombo.dataset.value)),
    { scroll: false },
  );
}

function closeUcPresetMenu({ focus = false } = {}) {
  ucPresetListbox.hidden = true;
  ucPresetCombo.setAttribute('aria-expanded', 'false');
  ucPresetCombo.removeAttribute('aria-activedescendant');
  for (const option of ucPresetOptions) option.classList.remove('listbox__option--active');
  if (focus) ucPresetCombo.focus();
}

function commitUcPreset(value) {
  ucPresetCombo.dataset.value = value;
  renderUcPreset();
  closeUcPresetMenu({ focus: true });
  ucPresetCombo.dispatchEvent(new Event('change', { bubbles: true }));
}

ucPresetCombo.addEventListener('click', (event) => {
  event.stopPropagation();
  if (ucPresetMenuOpen()) closeUcPresetMenu();
  else openUcPresetMenu();
});

ucPresetListbox.addEventListener('click', (event) => {
  event.stopPropagation();
  const option = event.target.closest('.listbox__option');
  if (option) commitUcPreset(option.dataset.value);
});

ucPresetListbox.addEventListener('mousemove', (event) => {
  const option = event.target.closest('.listbox__option');
  if (option) setUcPresetActive(ucPresetOptions.indexOf(option));
});

ucPresetCombo.addEventListener('keydown', (event) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      if (ucPresetMenuOpen()) setUcPresetActive(ucPresetActiveIndex + 1);
      else openUcPresetMenu();
      break;
    case 'ArrowUp':
      event.preventDefault();
      if (ucPresetMenuOpen()) setUcPresetActive(ucPresetActiveIndex - 1);
      else openUcPresetMenu();
      break;
    case 'Home':
      if (!ucPresetMenuOpen()) break;
      event.preventDefault();
      setUcPresetActive(0);
      break;
    case 'End':
      if (!ucPresetMenuOpen()) break;
      event.preventDefault();
      setUcPresetActive(ucPresetOptions.length - 1);
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      if (ucPresetMenuOpen()) commitUcPreset(ucPresetOptions[ucPresetActiveIndex].dataset.value);
      else openUcPresetMenu();
      break;
    case 'Escape':
      if (ucPresetMenuOpen()) {
        event.preventDefault();
        closeUcPresetMenu({ focus: true });
      }
      break;
    case 'Tab':
      if (ucPresetMenuOpen()) closeUcPresetMenu();
      break;
    default:
      break;
  }
});

document.addEventListener('click', () => {
  if (ucPresetMenuOpen()) closeUcPresetMenu();
});

renderUcPreset();

const settingsTrigger = document.getElementById('prompt-settings-trigger');
const settingsPopover = document.getElementById('prompt-settings');

const VIEWPORT_MARGIN = 8;

const isTrayLayout = () =>
  (document.getElementById('tray-handle')?.offsetParent ?? null) !== null;

const foldoutAnchor = () => {
  const chunks = document.getElementById('tab-chunks');
  if (chunks?.getAttribute('aria-selected') === 'true') {
    const list = document.getElementById('character-list');
    if (list && list.children.length > 0) return list;
    return document.querySelector('.character-prompts');
  }
  return [
    document.getElementById('base-img-loaded'),
    document.getElementById('base-img-empty'),
  ].find((el) => el && !el.hidden);
};

const syncFoldoutTab = () => {
  const chunks =
    document.getElementById('tab-chunks')?.getAttribute('aria-selected') === 'true';
  document.body.classList.toggle('prompt-chunks-open', chunks);
};

const publishFoldoutTop = () => {
  const anchor = foldoutAnchor();
  const scroller = document.querySelector('.settings-panel .panel-scroll');
  const floor = scroller?.getBoundingClientRect().top ?? 0;
  const edge = anchor ? anchor.getBoundingClientRect().bottom : floor;
  document.documentElement.style.setProperty(
    '--prompt-foldout-top',
    `${Math.round(Math.max(edge, floor))}px`,
  );
};

const positionPopover = () => {
  const rect = settingsTrigger.getBoundingClientRect();
  const rail = document.querySelector('.settings-panel');
  settingsPopover.style.left = `${Math.round(rail ? rail.getBoundingClientRect().right : 450)}px`;

  const height = settingsPopover.offsetHeight || 520;
  const maxTop = window.innerHeight - height - VIEWPORT_MARGIN;
  const top = Math.max(VIEWPORT_MARGIN, Math.min(Math.round(rect.top), maxTop));
  settingsPopover.style.top = `${top}px`;
};

const settingsHome = settingsPopover.parentElement;

const closePopover = () => {
  settingsPopover.hidden = true;
  settingsTrigger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('prompt-settings-open');
  settingsPopover.style.removeProperty('top');
  settingsPopover.style.removeProperty('left');
  if (settingsHome && settingsPopover.parentElement !== settingsHome) {
    settingsHome.appendChild(settingsPopover);
  }
};

const openPopover = () => {
  if (settingsPopover.parentElement !== document.body) {
    document.body.appendChild(settingsPopover);
  }
  settingsPopover.hidden = false;
  document.body.classList.add('prompt-settings-open');
  syncFoldoutTab();
  if (isTrayLayout()) publishFoldoutTop();
  else positionPopover();
  settingsTrigger.setAttribute('aria-expanded', 'true');
};

settingsTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  if (settingsPopover.hidden) openPopover();
  else closePopover();
});

window.addEventListener('resize', () => {
  if (settingsPopover.hidden) return;
  if (isTrayLayout()) {
    settingsPopover.style.removeProperty('top');
    settingsPopover.style.removeProperty('left');
    publishFoldoutTop();
  } else {
    positionPopover();
  }
});

document.querySelector('.settings-panel .panel-scroll')?.addEventListener(
  'scroll',
  () => {
    if (!settingsPopover.hidden && isTrayLayout()) publishFoldoutTop();
  },
  { passive: true },
);

settingsPopover.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', () => {
  if (!settingsPopover.hidden) closePopover();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !settingsPopover.hidden) closePopover();
});

const settingsTabs = [...settingsPopover.querySelectorAll('.prompt-settings__tab')];
for (const tab of settingsTabs) {
  tab.addEventListener('click', () => {
    for (const other of settingsTabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      const panel = document.getElementById(other.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    }
    if (tab.dataset.tab === 'chunks') showChunkList();
    if (isTrayLayout()) publishFoldoutTop();
    syncFoldoutTab();
  });
}


const CHUNK_DEFAULT_COLOR = '#6B7280';

let chunks = [];
let chunkCategories = [];
let chunkSeq = 0;

let chunkDraft = null;

const chunkListView = document.getElementById('chunks-list-view');
const chunkList = document.getElementById('chunks-list');
const chunkForm = document.getElementById('chunks-form');
const chunkFormTitle = document.getElementById('chunks-form-title');
const chunkNameInput = document.getElementById('chunk-name');
const chunkContentInput = document.getElementById('chunk-content');
const chunkCategorySelect = document.getElementById('chunk-category');
const chunkColorInput = document.getElementById('chunk-color');
const chunkSwatch = document.getElementById('chunk-swatch');
const chunkSaturation = document.getElementById('chunk-saturation');
const chunkSaturationPointer = document.getElementById('chunk-saturation-pointer');
const chunkHue = document.getElementById('chunk-hue');
const chunkHuePointer = document.getElementById('chunk-hue-pointer');
const chunkSaveButton = document.getElementById('chunks-form-save');
const chunkDeleteButton = document.getElementById('chunks-form-delete');

let chunkHsv = { h: 220, s: 0.16, v: 0.5 };

function chunkRgbToHsv(r, g, b, fallbackHue = 0) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = fallbackHue;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

function hsvToHex({ h, s, v }) {
  return `#${hsvToRgb(h, s, v).map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function parseHex(text) {
  const hex = String(text).trim().replace(/^#/, '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function renderChunkColor({ skipInput = false } = {}) {
  const hex = hsvToHex(chunkHsv);
  if (!skipInput) chunkColorInput.value = hex;
  chunkSwatch.style.setProperty('--chunk-color', hex);
  chunkSaturation.style.backgroundColor = `rgb(${hsvToRgb(chunkHsv.h, 1, 1).join(', ')})`;
  chunkSaturationPointer.style.left = `${chunkHsv.s * 100}%`;
  chunkSaturationPointer.style.top = `${(1 - chunkHsv.v) * 100}%`;
  chunkHuePointer.style.left = `${(chunkHsv.h / 360) * 100}%`;
  chunkHue.setAttribute('aria-valuenow', String(Math.round(chunkHsv.h)));
  chunkSaturation.setAttribute(
    'aria-valuetext',
    `Saturation ${Math.round(chunkHsv.s * 100)}%, Brightness ${Math.round(chunkHsv.v * 100)}%`,
  );
}

function setChunkColor(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  chunkHsv = chunkRgbToHsv(...rgb, chunkHsv.h);
  renderChunkColor();
  return true;
}

function dragTrack(el, onMove) {
  const handle = (event) => {
    const box = el.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - box.top) / box.height, 0), 1);
    onMove(x, y);
    renderChunkColor();
  };
  el.addEventListener('pointerdown', (event) => {
    el.setPointerCapture(event.pointerId);
    handle(event);
  });
  el.addEventListener('pointermove', (event) => {
    if (el.hasPointerCapture(event.pointerId)) handle(event);
  });
  el.addEventListener('pointerup', (event) => el.releasePointerCapture(event.pointerId));
  el.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onMove(null, null, move);
    renderChunkColor();
  });
}

dragTrack(chunkSaturation, (x, y, delta) => {
  if (delta) {
    chunkHsv.s = Math.min(Math.max(chunkHsv.s + delta[0], 0), 1);
    chunkHsv.v = Math.min(Math.max(chunkHsv.v - delta[1], 0), 1);
    return;
  }
  chunkHsv.s = x;
  chunkHsv.v = 1 - y;
});
dragTrack(chunkHue, (x, y, delta) => {
  if (delta) {
    chunkHsv.h = Math.min(Math.max(chunkHsv.h + delta[0] * 360, 0), 360);
    return;
  }
  chunkHsv.h = x * 360;
});

chunkColorInput.addEventListener('input', () => {
  const rgb = parseHex(chunkColorInput.value);
  if (!rgb) return;
  chunkHsv = chunkRgbToHsv(...rgb, chunkHsv.h);
  renderChunkColor({ skipInput: true });
});
chunkColorInput.addEventListener('change', () => renderChunkColor());

function showChunkList() {
  chunkDraft = null;
  chunkForm.hidden = true;
  chunkListView.hidden = false;
}

function showChunkForm(kind, entry = null) {
  chunkDraft = { kind, id: entry?.id ?? null };

  chunkFormTitle.textContent = kind === 'category'
    ? (entry ? 'Edit Category' : 'New Category')
    : (entry ? 'Edit Prompt Chunk' : 'New Prompt Chunk');
  chunkNameInput.placeholder = kind === 'category' ? 'Category name...' : 'e.g., My Style Tags';
  chunkNameInput.value = entry?.name ?? '';
  chunkContentInput.value = entry?.content ?? '';

  for (const field of chunkForm.querySelectorAll('[data-chunk-only]')) {
    field.hidden = kind === 'category';
  }

  renderChunkCategoryOptions(entry?.category ?? '');
  setChunkColor(entry?.color ?? CHUNK_DEFAULT_COLOR);
  syncChunkSave();

  chunkDeleteButton.hidden = !entry;

  chunkListView.hidden = true;
  chunkForm.hidden = false;
  chunkNameInput.focus();
}

function renderChunkCategoryOptions(selected) {
  chunkCategorySelect.replaceChildren();
  const none = new Option('Uncategorized', '');
  chunkCategorySelect.append(none);
  for (const category of chunkCategories) {
    chunkCategorySelect.append(new Option(category.name, category.id));
  }
  chunkCategorySelect.value = chunkCategories.some((c) => c.id === selected) ? selected : '';
}

function syncChunkSave() {
  chunkSaveButton.disabled = !chunkNameInput.value.trim();
}
chunkNameInput.addEventListener('input', syncChunkSave);

function renderChunks() {
  chunkList.replaceChildren();

  if (!chunks.length) {
    const empty = document.createElement('p');
    empty.className = 'chunks__empty';
    empty.textContent = 'No custom prompt chunks yet. Click + to add one.';
    chunkList.append(empty);
    return;
  }

  for (const chunk of chunks) {
    const wrap = document.createElement('div');
    wrap.className = 'chunks__chunk-wrap';
    wrap.dataset.id = chunk.id;

    const before = document.createElement('div');
    before.className = 'chunks__drop chunks__drop--before';
    const after = document.createElement('div');
    after.className = 'chunks__drop chunks__drop--after';

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'chunks__chunk';
    pill.draggable = true;
    pill.style.setProperty('--chunk-color', chunk.color || CHUNK_DEFAULT_COLOR);
    pill.title = `${chunk.content}\n\nClick to insert, drag to reorder`;

    const name = document.createElement('span');
    name.className = 'chunks__chunk-name';
    name.textContent = chunk.name;

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'chunks__edit';
    edit.title = 'Edit Chunk';
    edit.textContent = '✎';

    pill.append(name, edit);
    wrap.append(before, pill, after);
    chunkList.append(wrap);
  }
}

function insertChunk(chunk) {
  const target = lastPromptField ?? document.getElementById('prompt');
  if (!target) return;

  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? start;
  const before = target.value.slice(0, start);
  const after = target.value.slice(end);

  const lead = before && !/[\s,]$/.test(before) ? ', ' : '';
  const trail = after && !/^[\s,]/.test(after) ? ', ' : '';
  const text = `${lead}${chunk.content}${trail}`;

  target.focus();
  target.setSelectionRange(start, end);
  target.setRangeText(text, start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

let lastPromptField = null;
for (const field of document.querySelectorAll('.prompt-input')) {
  field.addEventListener('focus', () => { lastPromptField = field; });
}

chunkList.addEventListener('click', (event) => {
  const wrap = event.target.closest('.chunks__chunk-wrap');
  if (!wrap) return;
  const chunk = chunks.find((c) => c.id === wrap.dataset.id);
  if (!chunk) return;
  if (event.target.closest('.chunks__edit')) {
    showChunkForm('chunk', chunk);
    return;
  }
  insertChunk(chunk);
});

let chunkDragId = null;

chunkList.addEventListener('dragstart', (event) => {
  const wrap = event.target.closest('.chunks__chunk-wrap');
  if (!wrap) return;
  chunkDragId = wrap.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', chunkDragId);
});

chunkList.addEventListener('dragover', (event) => {
  if (!chunkDragId) return;
  event.preventDefault();
  const wrap = event.target.closest('.chunks__chunk-wrap');
  for (const other of chunkList.children) delete other.dataset.drop;
  if (!wrap || wrap.dataset.id === chunkDragId) return;
  const box = wrap.getBoundingClientRect();
  wrap.dataset.drop = event.clientX < box.left + box.width / 2 ? 'before' : 'after';
});

chunkList.addEventListener('drop', (event) => {
  if (!chunkDragId) return;
  event.preventDefault();
  const wrap = event.target.closest('.chunks__chunk-wrap');
  const from = chunks.findIndex((c) => c.id === chunkDragId);
  const side = wrap?.dataset.drop;
  for (const other of chunkList.children) delete other.dataset.drop;
  chunkDragId = null;
  if (!wrap || from < 0 || !side) return;

  const [moved] = chunks.splice(from, 1);
  const target = chunks.findIndex((c) => c.id === wrap.dataset.id);
  if (target < 0) chunks.splice(from, 0, moved);
  else chunks.splice(side === 'before' ? target : target + 1, 0, moved);

  renderChunks();
  scheduleSave();
});

chunkList.addEventListener('dragend', () => {
  chunkDragId = null;
  for (const other of chunkList.children) delete other.dataset.drop;
});

document.getElementById('chunks-new-chunk').addEventListener('click', () => showChunkForm('chunk'));
document.getElementById('chunks-new-category')
  .addEventListener('click', () => showChunkForm('category'));
document.getElementById('chunks-close').addEventListener('click', () => closePopover());
document.getElementById('chunks-form-close').addEventListener('click', showChunkList);
document.getElementById('chunks-form-cancel').addEventListener('click', showChunkList);

chunkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!chunkDraft) return;

  const name = chunkNameInput.value.trim();
  if (!name) return;
  const color = hsvToHex(chunkHsv);

  if (chunkDraft.kind === 'category') {
    const existing = chunkCategories.find((c) => c.id === chunkDraft.id);
    if (existing) Object.assign(existing, { name, color });
    else chunkCategories.push({ id: `cat-${++chunkSeq}`, name, color });
  } else {
    const entry = {
      name,
      content: chunkContentInput.value,
      category: chunkCategorySelect.value,
      color,
    };
    const existing = chunks.find((c) => c.id === chunkDraft.id);
    if (existing) Object.assign(existing, entry);
    else chunks.push({ id: `chunk-${++chunkSeq}`, ...entry });
  }

  renderChunks();
  showChunkList();
  scheduleSave();
});

chunkDeleteButton.addEventListener('click', () => {
  if (!chunkDraft?.id) return;

  const { kind } = chunkDraft;
  const removed = (kind === 'category' ? chunkCategories : chunks)
    .find((c) => c.id === chunkDraft.id)?.name ?? '';

  if (chunkDraft.kind === 'category') {
    chunkCategories = chunkCategories.filter((c) => c.id !== chunkDraft.id);
    for (const chunk of chunks) {
      if (chunk.category === chunkDraft.id) chunk.category = '';
    }
  } else {
    chunks = chunks.filter((c) => c.id !== chunkDraft.id);
  }

  renderChunks();
  showChunkList();
  scheduleSave();
  toastSuccess(`Deleted ${kind === 'category' ? 'category' : 'chunk'} “${removed}”.`);
});

document.getElementById('chunks-delete-all').addEventListener('click', () => {
  if (!chunks.length) return;
  if (!window.confirm(`Delete all ${chunks.length} prompt chunks? This cannot be undone.`)) return;
  const count = chunks.length;
  chunks = [];
  renderChunks();
  scheduleSave();
  toastSuccess(`Deleted all ${count} prompt chunk${count === 1 ? '' : 's'}.`);
});

renderChunks();

const qualityToggle = document.getElementById('add-quality-tags');
const qualityStatus = document.getElementById('quality-tags-status');
qualityToggle.addEventListener('change', () => {
  const on = qualityToggle.checked;
  for (const desc of settingsPopover.querySelectorAll('.setting__desc[data-when]')) {
    const off = (desc.dataset.when === 'on') !== on;
    desc.dataset.hidden = String(off);
    desc.setAttribute('aria-hidden', String(off));
  }
  qualityStatus.textContent = on ? 'Quality Tags Enabled' : 'Quality Tags Disabled';
});

for (const name of ['steps', 'guidance', 'cfg-rescale', 'img2img-strength', 'img2img-noise']) {
  const number = document.getElementById(name);
  const range = document.getElementById(`${name}-range`);
  if (!number || !range) continue;

  const sizeNumber = () => {
    number.style.setProperty('--digits', String(number.value.length || 1));
  };

  const costly = name === 'steps' || name === 'img2img-strength';

  range.addEventListener('input', () => {
    number.value = range.value;
    sizeNumber();
    if (costly) syncCost();
  });
  number.addEventListener('input', () => {
    const min = Number(range.min);
    const max = Number(range.max);
    const value = Number(number.value);
    if (Number.isFinite(value)) {
      range.value = String(Math.min(Math.max(value, min), max));
    }
    sizeNumber();
    if (costly) syncCost();
  });

  const clampNumber = () => {
    const min = Number(range.min);
    const max = Number(range.max);
    const value = Number(number.value);
    if (!Number.isFinite(value) || number.value.trim() === '') return;
    const clamped = Math.min(Math.max(value, min), max);
    if (clamped === value) return;
    number.value = String(clamped);
    range.value = String(clamped);
    sizeNumber();
    if (costly) syncCost();
  };

  number.addEventListener('blur', clampNumber);
  number.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      clampNumber();
    }
  });
  number.addEventListener('change', clampNumber);

  sizeNumber();
}

const advancedToggle = document.getElementById('advanced-toggle');
const advancedBody = document.getElementById('advanced-body');
advancedToggle?.addEventListener('click', () => {
  const collapsed = advancedBody.hidden;
  advancedBody.hidden = !collapsed;
  advancedToggle.setAttribute('aria-expanded', String(collapsed));
  advancedToggle.querySelector('.icon')?.classList.toggle('icon--flipped', !collapsed);
});

const promptField = document.getElementById('prompt');
const promptLength = document.getElementById('prompt-length');
const PROMPT_SOFT_LIMIT = 800;

const transparentBgButton = document.getElementById('transparent-bg');
let transparentBg = false;

syncTransparentBg = () => {
  transparentBgButton.hidden = !isV5Model(selectedModel);
  transparentBgButton.setAttribute('aria-pressed', String(transparentBg));
};

transparentBgButton.addEventListener('click', () => {
  transparentBg = !transparentBg;
  syncTransparentBg();
  saveDraft();
});

const autoGrow = () => {
  for (const el of document.querySelectorAll('.prompt-input')) {
    if (el.offsetParent === null) continue;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
};

promptField?.addEventListener('input', () => {
  const pct = Math.min(100, (promptField.value.length / PROMPT_SOFT_LIMIT) * 100);
  promptLength.style.width = `${pct}%`;
  autoGrow();
});
document.getElementById('undesired')?.addEventListener('input', autoGrow);
syncTransparentBg();

import { parseEmphasis, emphasisStyle } from './emphasis.js';

const emphasisToggle = document.getElementById('highlight-emphasis');

const emphasisFields = [...document.querySelectorAll('.prompt-field')].map((wrap) => ({
  wrap,
  input: wrap.querySelector('.prompt-input'),
  mirror: wrap.querySelector('.prompt-mirror'),
}));

function paintEmphasis({ input, mirror }) {
  if (!input || !mirror) return;

  const runs = parseEmphasis(input.value);
  const frag = document.createDocumentFragment();

  for (const run of runs) {
    if (run.terminator) {
      const span = document.createElement('span');
      span.className = 'em em--terminator';
      span.textContent = run.text;
      frag.append(span);
      continue;
    }

    const style = emphasisStyle(run.weight);
    if (!style) {
      frag.append(document.createTextNode(run.text));
      continue;
    }
    const span = document.createElement('span');
    span.className = `em em--${style.direction}`;
    span.style.setProperty('--em-a', String(style.alpha));
    span.textContent = run.text;
    frag.append(span);
  }

  if (input.value.endsWith('\n')) frag.append(document.createTextNode('​'));

  mirror.replaceChildren(frag);
  mirror.scrollTop = input.scrollTop;
  mirror.scrollLeft = input.scrollLeft;
}

const emphasisOn = () => emphasisToggle?.checked !== false;

function syncEmphasis() {
  const on = emphasisOn();
  for (const field of emphasisFields) {
    field.wrap.classList.toggle('prompt-field--highlight', on);
    if (!on || field.wrap.offsetParent === null) {
      if (!on) field.mirror?.replaceChildren();
      continue;
    }
    paintEmphasis(field);
  }
  syncCharacterEmphasis();
}

// Character cards are rebuilt by renderCharacters(), so their mirrors are painted
// on demand rather than bound once like the static prompt fields.
function paintCardEmphasis(card) {
  if (!card) return;
  const on = emphasisOn();
  card.classList.toggle('character-card--highlight', on);
  const mirror = card.querySelector('[data-role="mirror"]');
  if (!mirror) return;
  if (!on) {
    mirror.replaceChildren();
    return;
  }
  paintEmphasis({ input: card.querySelector('[data-role="input"]'), mirror });
}

function syncCharacterEmphasis() {
  for (const card of document.querySelectorAll('.character-card')) paintCardEmphasis(card);
}

for (const field of emphasisFields) {
  if (!field.input) continue;
  field.input.addEventListener('input', () => paintEmphasis(field));
  field.input.addEventListener('scroll', () => {
    field.mirror.scrollTop = field.input.scrollTop;
    field.mirror.scrollLeft = field.input.scrollLeft;
  });
}

emphasisToggle?.addEventListener('change', syncEmphasis);
syncEmphasis();

import { tagAtCaret, applySuggestion, dotOpacity } from './tagsuggest.js';

const suggestDisableToggle = document.getElementById('disable-tag-suggestions');

const SUGGEST_DEBOUNCE_MS = 180;

const SUGGEST_MIN_CHARS = 2;

const SUGGEST_SPINNER_MIN_MS = 300;

const suggestFields = new Set();

let suggestFieldSeq = 0;

const suggestionsDisabled = () => suggestDisableToggle?.checked === true;

function hideSuggest(field) {
  field.box.hidden = true;
  field.loading.hidden = true;
  field.input.setAttribute('aria-expanded', 'false');
  field.input.removeAttribute('aria-activedescendant');
  field.items = [];
  field.activeIndex = -1;
  field.span = null;
  field.controller?.abort();
  field.controller = null;
  clearTimeout(field.timer);
}

function showSuggestLoading(field) {
  field.list.replaceChildren();
  field.items = [];
  field.activeIndex = -1;
  field.input.removeAttribute('aria-activedescendant');
  field.loading.hidden = false;
  field.box.hidden = false;
  field.input.setAttribute('aria-expanded', 'true');
}

function setActiveSuggestion(field, index) {
  const rows = [...field.list.querySelectorAll('.tag-suggest__option')];
  if (!rows.length) return;

  const next = ((index % rows.length) + rows.length) % rows.length;
  field.activeIndex = next;

  rows.forEach((row, i) => {
    const on = i === next;
    row.classList.toggle('tag-suggest__option--active', on);
    row.setAttribute('aria-selected', String(on));
    if (on) {
      field.input.setAttribute('aria-activedescendant', row.id);
      row.scrollIntoView({ block: 'nearest' });
    }
  });
}

function chooseSuggestion(field, index) {
  const item = field.items[index];
  if (!item) return;

  const target = tagAtCaret(field.input.value, field.input.selectionStart);
  if (!target) return;

  const { text, caret } = applySuggestion(field.input.value, target, item.tag);
  field.input.value = text;
  field.input.setSelectionRange(caret, caret);

  hideSuggest(field);

  field.input.dispatchEvent(new Event('input', { bubbles: true }));
  field.input.focus();
}

function renderSuggest(field, tags) {
  field.items = tags;
  field.activeIndex = -1;

  if (!tags.length) {
    hideSuggest(field);
    return;
  }

  const frag = document.createDocumentFragment();
  tags.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'tag-suggest__option';
    row.id = `${field.list.id}-opt-${i}`;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');

    const label = document.createElement('span');
    label.textContent = item.tag;
    row.append(label);

    const dot = document.createElement('div');
    dot.className = 'tag-suggest__dot';
    dot.style.setProperty('--dot-a', String(dotOpacity(item.count)));
    dot.title = `${item.count.toLocaleString()} posts`;
    row.append(dot);

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chooseSuggestion(field, i);
    });
    row.addEventListener('mouseenter', () => setActiveSuggestion(field, i));

    frag.append(row);
  });

  field.list.replaceChildren(frag);
  field.loading.hidden = true;
  field.box.hidden = false;
  field.input.setAttribute('aria-expanded', 'true');
}

async function requestSuggest(field, span) {
  field.controller?.abort();
  const controller = new AbortController();
  field.controller = controller;

  const url = `/api/suggest-tags?model=${encodeURIComponent(selectedModel)}`
    + `&prompt=${encodeURIComponent(span.value)}`;

  showSuggestLoading(field);
  const shownAt = performance.now();

  const holdRemaining = () =>
    Math.max(0, SUGGEST_SPINNER_MIN_MS - (performance.now() - shownAt));
  const afterHold = () => new Promise((resolve) => setTimeout(resolve, holdRemaining()));

  let tags;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      await afterHold();
      if (field.controller === controller) hideSuggest(field);
      return;
    }
    ({ tags } = await res.json());
  } catch {
    return;
  }

  if (controller.signal.aborted) return;

  const now = tagAtCaret(field.input.value, field.input.selectionStart);
  if (!now || now.value !== span.value) return;

  if (holdRemaining() > 0) {
    await afterHold();
    if (controller.signal.aborted || field.controller !== controller) return;

    const after = tagAtCaret(field.input.value, field.input.selectionStart);
    if (!after || after.value !== span.value) return;
  }

  field.span = now;
  renderSuggest(field, tags ?? []);
}

function scheduleSuggest(field) {
  clearTimeout(field.timer);

  if (suggestionsDisabled()) {
    hideSuggest(field);
    return;
  }

  if (document.activeElement !== field.input) {
    hideSuggest(field);
    return;
  }

  if (field.input.selectionStart !== field.input.selectionEnd) {
    hideSuggest(field);
    return;
  }

  const span = tagAtCaret(field.input.value, field.input.selectionStart);

  if (field.dismissedFor !== null) {
    if (span && span.value === field.dismissedFor) return;
    field.dismissedFor = null;
  }

  if (!span || span.value.length < SUGGEST_MIN_CHARS) {
    hideSuggest(field);
    return;
  }

  field.span = span;
  field.timer = setTimeout(() => requestSuggest(field, span), SUGGEST_DEBOUNCE_MS);
}

function attachSuggest(input, box) {
  if (!input || !box) return null;

  const list = box.querySelector('.tag-suggest__list');
  const loading = box.querySelector('.tag-suggest__loading');
  if (!list || !loading) return null;

  if (!list.id) {
    suggestFieldSeq += 1;
    list.id = `tag-suggest-${suggestFieldSeq}-list`;
  }
  input.setAttribute('aria-controls', list.id);

  const field = {
    input,
    box,
    list,
    loading,
    close: box.querySelector('.tag-suggest__close'),
    timer: 0,
    controller: null,
    span: null,
    items: [],
    activeIndex: -1,
    dismissedFor: null,
  };

  suggestFields.add(field);

  field.input.addEventListener('input', () => scheduleSuggest(field));

  field.input.addEventListener('keydown', (e) => {
    if (field.box.hidden) {
      if (e.key === 'Escape') return;
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestion(field, field.activeIndex + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestion(field, field.activeIndex - 1);
        break;
      case 'Enter':
      case 'Tab':
        if (field.activeIndex >= 0) {
          e.preventDefault();
          chooseSuggestion(field, field.activeIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        field.dismissedFor = field.span?.value ?? null;
        hideSuggest(field);
        break;
      default:
        break;
    }
  });

  field.input.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) scheduleSuggest(field);
  });
  field.input.addEventListener('click', () => scheduleSuggest(field));

  field.input.addEventListener('blur', () => hideSuggest(field));

  field.close?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    field.dismissedFor = field.span?.value ?? null;
    hideSuggest(field);
    field.input.focus();
  });

  return field;
}

function detachSuggest(field) {
  if (!field) return;
  clearTimeout(field.timer);
  field.controller?.abort();
  suggestFields.delete(field);
}

for (const wrap of document.querySelectorAll('.prompt-field')) {
  attachSuggest(wrap.querySelector('.prompt-input'), wrap.querySelector('.tag-suggest'));
}

suggestDisableToggle?.addEventListener('change', () => {
  if (!suggestionsDisabled()) return;
  for (const field of suggestFields) hideSuggest(field);
});

const aiToggle = document.getElementById('ai-settings-toggle');
const aiBody = document.getElementById('ai-settings-body');
aiToggle?.addEventListener('click', () => {
  const collapsed = aiBody.hidden;
  aiBody.hidden = !collapsed;
  aiToggle.setAttribute('aria-expanded', String(collapsed));
  aiToggle.setAttribute('aria-label', collapsed ? 'Collapse AI settings' : 'Expand AI settings');
  aiToggle.classList.toggle('ai-settings__head--expanded', collapsed);
});

document.getElementById('ai-settings-close')?.addEventListener('click', () => {
  aiBody.hidden = true;
  aiToggle.setAttribute('aria-expanded', 'false');
  aiToggle.setAttribute('aria-label', 'Expand AI settings');
  aiToggle.classList.remove('ai-settings__head--expanded');
});

const glance = {
  steps: document.getElementById('glance-steps'),
  guidance: document.getElementById('glance-guidance'),
  seed: document.getElementById('glance-seed'),
  sampler: document.getElementById('glance-sampler'),
};
const seedClear = document.getElementById('seed-clear');
const syncGlance = () => {
  glance.steps.textContent = document.getElementById('steps').value;
  syncCost();
  glance.guidance.textContent = document.getElementById('guidance').value;
  const seed = document.getElementById('seed').value.trim();
  glance.seed.textContent = seed || 'N/A';
  seedClear.hidden = seed === '';
  const sampler = document.getElementById('sampler');
  glance.sampler.textContent = sampler.options[sampler.selectedIndex].text;
};
const SEED_MAX = 4294967295;
const seedInput = document.getElementById('seed');
seedInput.addEventListener('input', () => {
  const before = seedInput.value;
  let clean = before.replace(/\D/g, '');
  if (Number(clean) > SEED_MAX) clean = String(SEED_MAX);
  if (clean === before) return;

  const caret = seedInput.selectionStart ?? before.length;
  const kept = before.slice(0, caret).replace(/\D/g, '').length;
  seedInput.value = clean;
  const at = Math.min(kept, clean.length);
  seedInput.setSelectionRange(at, at);
});

seedInput.addEventListener('blur', () => {
  const before = seedInput.value;
  if (!/^0\d/.test(before)) return;
  seedInput.value = String(Number(before));
  seedInput.dispatchEvent(new Event('input', { bubbles: true }));
  seedInput.dispatchEvent(new Event('change', { bubbles: true }));
});

for (const id of ['steps', 'steps-range', 'guidance', 'guidance-range', 'seed', 'sampler']) {
  const el = document.getElementById(id);
  el?.addEventListener('input', syncGlance);
  el?.addEventListener('change', syncGlance);
}
seedClear.addEventListener('click', () => {
  const seed = document.getElementById('seed');
  seed.value = '';
  seed.dispatchEvent(new Event('input', { bubbles: true }));
  seed.dispatchEvent(new Event('change', { bubbles: true }));
  seed.focus();
});
syncGlance();


const MAX_CHARACTERS = 15;

const GENDER_SEED = { female: 'girl', male: 'boy', other: '' };
const GENDER_ICON = { female: 'icon-female', male: 'icon-male', other: 'icon-other' };

const characters = [];
let focusedCharacter = -1;
const characterSuggestFields = [];

const characterList = document.getElementById('character-list');
const characterSub = document.querySelector('.character-prompts__sub');
const characterTemplate = document.getElementById('character-card-template');
const addCharacterButton = document.getElementById('add-character');
const genderFlyout = document.getElementById('gender-flyout');
const positionGlobal = document.getElementById('position-global');
const positionGlobalToggle = document.getElementById('position-global-toggle');

let positionTarget = -1;

let globalAutoPosition = true;

const DEFAULT_POSITION = 'C3';

function buildPositionGrid(grid) {
  for (const row of [1, 2, 3, 4, 5]) {
    for (const col of ['A', 'B', 'C', 'D', 'E']) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'position-cell';
      cell.dataset.position = `${col}${row}`;
      cell.setAttribute('aria-label', `${col}${row}`);
      cell.setAttribute('aria-pressed', 'false');
      grid.append(cell);
    }
  }
}

const estimateTokens = (text) =>
  text.trim() ? text.trim().split(/[\s,]+/).filter(Boolean).length : 0;

const closeGenderFlyout = () => {
  genderFlyout.hidden = true;
  addCharacterButton.setAttribute('aria-expanded', 'false');
};

const closePositionPicker = () => {
  positionTarget = -1;
};

const promptTab = document.querySelector('.prompt-tab[data-target="prompt"]');

function syncPromptTabLabel() {
  promptTab.textContent = characters.length > 0 ? 'Base Prompt' : 'Prompt';
}

function renderCharacters() {
  scheduleSave();
  syncPromptTabLabel();
  if (characters.length === 0) focusedCharacter = -1;
  else if (focusedCharacter < 0 || focusedCharacter >= characters.length) {
    focusedCharacter = characters.length - 1;
  }

  if (characters.length < 2 && !globalAutoPosition) {
    globalAutoPosition = true;
    for (const character of characters) character.position = '';
    positionTarget = -1;
  }

  characterSub.textContent = characters.length
    ? 'Click to edit a character.'
    : 'Customize separate characters.';

  for (const field of characterSuggestFields) detachSuggest(field);
  characterSuggestFields.length = 0;

  characterList.replaceChildren();

  characters.forEach((character, index) => {
    const card = characterTemplate.content.firstElementChild.cloneNode(true);
    const isFocused = index === focusedCharacter;
    card.dataset.focused = String(isFocused);
    card.dataset.index = String(index);

    const q = (role) => card.querySelector(`[data-role="${role}"]`);

    const picking = index === positionTarget;
    card.dataset.picking = String(picking);

    q('gender-icon').classList.add('icon--sm', GENDER_ICON[character.gender] ?? 'icon-other');
    q('name').textContent = picking
      ? `Set Character ${index + 1}’s Position`
      : `Character ${index + 1}`;

    card.querySelector('[data-action="up"]').disabled = index === 0;
    card.querySelector('[data-action="down"]').disabled = index === characters.length - 1;

    card.dataset.enabled = String(character.enabled);
    const toggle = card.querySelector('[data-action="toggle"]');
    toggle.setAttribute('aria-pressed', String(character.enabled));
    toggle.setAttribute(
      'aria-label',
      character.enabled ? 'Disable character' : 'Enable character',
    );
    q('toggle-icon').classList.add(
      picking || !character.enabled ? 'icon-close-x' : 'icon-check',
    );
    if (picking) {
      toggle.dataset.action = 'position-done';
      toggle.setAttribute('aria-label', 'Close position picker');
      toggle.removeAttribute('aria-pressed');
    }

    if (isFocused) {
      const input = q('input');
      const onUc = character.tab === 'uc';
      input.value = onUc ? character.uc : character.prompt;
      input.placeholder = onUc
        ? 'Undesired content for this character'
        : 'Describe this character';
      for (const tab of card.querySelectorAll('.character-tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.tab === character.tab));
      }
      const used = Math.min(estimateTokens(onUc ? character.uc : character.prompt) / 60, 1);
      q('token-fill').style.width = `${(used * 100).toFixed(1)}%`;

      const suggest = attachSuggest(input, q('suggest'));
      if (suggest) characterSuggestFields.push(suggest);

      paintCardEmphasis(card);

      const trigger = card.querySelector('[data-action="position"]');
      trigger.disabled = globalAutoPosition;
      q('position-label').textContent = globalAutoPosition ? 'AI’s Choice' : 'Adjust';
      q('position-cell').textContent = globalAutoPosition ? '' : character.position;
    } else {
      q('excerpt').textContent = character.prompt;
      q('summary-position').textContent = globalAutoPosition ? 'AI’s Choice' : 'Custom';
      q('summary-tokens').textContent = String(estimateTokens(character.prompt));
    }

    if (picking) {
      const grid = q('position-grid');
      buildPositionGrid(grid);
      const occupants = new Map();
      characters.forEach((c, i) => {
        const at = c.position || DEFAULT_POSITION;
        occupants.set(at, [...(occupants.get(at) ?? []), i + 1]);
      });
      const here = character.position || DEFAULT_POSITION;
      for (const cell of grid.children) {
        const at = occupants.get(cell.dataset.position) ?? [];
        cell.textContent = at.length > 3 ? `×${at.length}` : at.join('');
        cell.dataset.occupants = at.length > 3 ? 'many' : String(at.length);
        cell.setAttribute('aria-pressed', String(here === cell.dataset.position));
        cell.setAttribute(
          'aria-label',
          at.length
            ? `${cell.dataset.position}, character ${at.join(', ')}`
            : cell.dataset.position,
        );
      }
    }

    characterList.append(card);
  });

  positionGlobal.hidden = characters.length < 2;
  positionGlobalToggle.checked = globalAutoPosition;
  positionGlobal
    .querySelector('[data-role="global-icon"]')
    .setAttribute('class', `icon icon--xs ${globalAutoPosition ? 'icon-check' : 'icon-close-x'}`);

  addCharacterButton.disabled = characters.length >= MAX_CHARACTERS;
  addCharacterButton.title =
    characters.length >= MAX_CHARACTERS ? `Limit is ${MAX_CHARACTERS} characters` : '';

  if (positionTarget >= 0) {
    characterList
      .querySelector(`[data-index="${positionTarget}"] .position-cell[aria-pressed="true"]`)
      ?.focus();
  } else if (focusedCharacter >= 0) {
    const active = characterList.querySelector(
      `[data-index="${focusedCharacter}"] [data-role="input"]`,
    );
    if (active && document.activeElement !== active) {
      const end = active.value.length;
      active.focus();
      active.setSelectionRange(end, end);
    }
  }
}

addCharacterButton.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!settingsPopover.hidden) closePopover();
  if (addCharacterButton.disabled) return;
  const opening = genderFlyout.hidden;
  if (opening) {
    const rect = addCharacterButton.getBoundingClientRect();
    genderFlyout.style.left = `${Math.round(rect.left)}px`;
    genderFlyout.style.top = `${Math.round(rect.top)}px`;
  }
  genderFlyout.hidden = !opening;
  addCharacterButton.setAttribute('aria-expanded', String(opening));
});

genderFlyout.addEventListener('click', (event) => {
  event.stopPropagation();
  const option = event.target.closest('[data-gender]');
  if (!option) return;
  const gender = option.dataset.gender;
  characters.push({
    gender,
    prompt: GENDER_SEED[gender] ?? '',
    uc: '',
    position: globalAutoPosition ? '' : DEFAULT_POSITION,
    tab: 'prompt',
    enabled: true,
  });
  focusedCharacter = characters.length - 1;
  closeGenderFlyout();
  renderCharacters();
});

characterList.addEventListener('click', (event) => {
  const card = event.target.closest('.character-card');
  if (!card) return;
  const index = Number(card.dataset.index);
  const action = event.target.closest('[data-action]')?.dataset.action;

  if (action === 'delete') {
    characters.splice(index, 1);
    if (focusedCharacter > index) focusedCharacter -= 1;
    closePositionPicker();
    renderCharacters();
    return;
  }

  if (action === 'up' || action === 'down') {
    const to = action === 'up' ? index - 1 : index + 1;
    if (to < 0 || to >= characters.length) return;
    [characters[index], characters[to]] = [characters[to], characters[index]];
    if (focusedCharacter === index) focusedCharacter = to;
    else if (focusedCharacter === to) focusedCharacter = index;
    renderCharacters();
    return;
  }

  if (action === 'toggle') {
    const character = characters[index];
    character.enabled = !character.enabled;
    renderCharacters();
    return;
  }

  if (action === 'position') {
    if (globalAutoPosition) return;
    positionTarget = index;
    renderCharacters();
    return;
  }

  if (action === 'position-done') {
    closePositionPicker();
    renderCharacters();
    return;
  }

  const cell = event.target.closest('.position-cell');
  if (cell && positionTarget === index) {
    characters[index].position = cell.dataset.position;
    renderCharacters();
    return;
  }

  const tab = event.target.closest('[data-tab]')?.dataset.tab;
  if (tab) {
    characters[index].tab = tab;
    renderCharacters();
    return;
  }

  if (!characters[index].enabled) return;
  if (index !== focusedCharacter && event.target.closest('[data-role="summary"]')) {
    focusedCharacter = index;
    closePositionPicker();
    renderCharacters();
  }
});

characterList.addEventListener('input', (event) => {
  const input = event.target.closest('[data-role="input"]');
  if (!input) return;
  const index = Number(input.closest('.character-card').dataset.index);
  const character = characters[index];
  character[character.tab === 'uc' ? 'uc' : 'prompt'] = input.value;

  const used = Math.min(estimateTokens(input.value) / 60, 1);
  input
    .closest('.character-card')
    .querySelector('[data-role="token-fill"]')
    .style.width = `${(used * 100).toFixed(1)}%`;

  paintCardEmphasis(input.closest('.character-card'));

  scheduleSave();
});

characterList.addEventListener(
  'scroll',
  (event) => {
    const input = event.target.closest?.('[data-role="input"]');
    if (!input) return;
    const mirror = input.closest('.character-card').querySelector('[data-role="mirror"]');
    if (!mirror) return;
    mirror.scrollTop = input.scrollTop;
    mirror.scrollLeft = input.scrollLeft;
  },
  true,
);

positionGlobalToggle.addEventListener('change', () => {
  globalAutoPosition = positionGlobalToggle.checked;
  for (const character of characters) {
    character.position = globalAutoPosition ? '' : character.position || DEFAULT_POSITION;
  }
  if (globalAutoPosition) closePositionPicker();
  renderCharacters();
});

document.addEventListener('click', () => {
  if (!genderFlyout.hidden) closeGenderFlyout();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!genderFlyout.hidden) closeGenderFlyout();
  else if (positionTarget >= 0) {
    closePositionPicker();
    renderCharacters();
  }
});

import { MaskEditor } from './draw.js';
import { toastInfo, toastSuccess, toastError } from './toast.js';
import { readNaiMetadata, metadataToRail } from './metadata.js';
import { loadRandomPromptTables, randomPrompt } from './randomprompt.js';

const promptRandom = document.querySelector('.prompt-random');
const promptRandomize = document.getElementById('randomize');

let savedPrompt = null;

function syncRandomPrompt() {
  promptRandom.hidden = savedPrompt === null;
  promptRandomize.hidden = savedPrompt !== null;
}

function rollRandomPrompt() {
  if (savedPrompt === null) savedPrompt = promptField.value;

  const { prompt, characters: rolled } = randomPrompt();
  promptField.value = prompt;
  promptField.dispatchEvent(new Event('input'));

  characters.length = 0;
  for (const rolledCharacter of rolled.slice(0, MAX_CHARACTERS)) {
    characters.push({
      gender: rolledCharacter.gender,
      prompt: rolledCharacter.prompt,
      uc: 'lowres, aliasing, ',
      position: '',
      tab: 'prompt',
      enabled: true,
    });
  }
  globalAutoPosition = true;
  focusedCharacter = characters.length - 1;
  renderCharacters();
  syncRandomPrompt();
}

async function randomizeClicked() {
  try {
    await loadRandomPromptTables();
  } catch {
    toastError('Could not load the random prompt tags.');
    return;
  }
  rollRandomPrompt();
}

document.getElementById('randomize').addEventListener('click', randomizeClicked);
document.getElementById('random-reroll').addEventListener('click', randomizeClicked);

document.getElementById('random-clear').addEventListener('click', () => {
  promptField.value = savedPrompt ?? '';
  savedPrompt = null;
  promptField.dispatchEvent(new Event('input'));
  characters.length = 0;
  renderCharacters();
  syncRandomPrompt();
});

syncRandomPrompt();

const drawWindow = document.getElementById('draw-window');
const drawWindowTitle = document.getElementById('draw-window-title');
const drawTitleIcon = document.getElementById('draw-window-title-icon');
const drawStage = document.getElementById('draw-stage');
const baseImgButton = document.getElementById('base-img');
const baseImgFile = document.getElementById('base-img-file');
const baseImgDraw = document.getElementById('base-img-draw');
const baseImgEmpty = document.getElementById('base-img-empty');
const baseImgLoaded = document.getElementById('base-img-loaded');
const image2imageBody = document.getElementById('image2image-body');
const image2imageFold = document.getElementById('image2image-fold');
const maskBody = document.getElementById('mask-body');
const maskFold = document.getElementById('mask-fold');
const imageIntent = document.getElementById('image-intent');
const imageIntentPreview = document.getElementById('image-intent-preview');
const imageMeta = document.getElementById('image-meta');
const image2imageState = document.getElementById('image2image-state');
const maskState = document.getElementById('mask-state');
const maskPreview = document.getElementById('mask-preview');
const vibeNotice = document.getElementById('vibe-notice');
const vibeCard = document.getElementById('vibe-card');
const vibeButton = document.getElementById('vibe-transfer');
const vibeOverflowButton = document.getElementById('vibe-menu');
const vibeSlotList = document.getElementById('vibe-slots');

const editor = new MaskEditor(drawStage);

let inpaint = null;

function setMaskState(active) {
  image2imageState.hidden = active;
  maskState.hidden = !active;
  baseImgLoaded.classList.toggle('image2image--masked', active);
  setImage2ImageFolded(baseImgLoaded.classList.contains('image2image--folded'));
  vibeNotice.hidden = !active || isV5Model(selectedModel);
  vibeCard.classList.toggle('feature-card--disabled', active);
  vibeButton.disabled = active;
  vibeOverflowButton.disabled = active;
  vibeSlotList.classList.toggle('vibe-slots--disabled', active);
  for (const control of vibeSlotList.querySelectorAll('input, button')) {
    control.disabled = active;
  }
  syncCost();
}


function applyInpaintSideCap() {
  const [width, height] = currentResolution();
  if (width <= MAX_INPAINT_DIMENSION && height <= MAX_INPAINT_DIMENSION) return;

  const fitted = fitToValid(width, height, { maxSide: MAX_INPAINT_DIMENSION });
  applyResolution(fitted.width, fitted.height);
  toastInfo(
    `Inpainting caps each side at ${MAX_INPAINT_DIMENSION}px, so this is now `
    + `${fitted.width}x${fitted.height}.`,
  );
}

function clearInpaint() {
  inpaint = null;
  maskPreview.removeAttribute('src');
  setMaskState(false);
  editor.clearFocus();
  scheduleSave({ images: true });
}

let pendingImage = null;
let baseImage = null;

let baseImageSize = null;
let baseImageNativeSize = null;

function measureImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

baseImgButton.addEventListener('click', () => baseImgFile.click());

function openIntentForFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage = reader.result;
    imageIntentPreview.style.backgroundImage = `url("${pendingImage}")`;
    imageIntent.hidden = false;
  };
  reader.readAsDataURL(file);
  scanForMetadata(file);
}

baseImgFile.addEventListener('change', () => {
  const file = baseImgFile.files?.[0];
  baseImgFile.value = '';
  if (!file) return;
  openIntentForFile(file);
});

function closeImageIntent() {
  imageIntent.hidden = true;
  pendingImage = null;
  pendingMetadata = null;
  imageMeta.hidden = true;
  imageIntentPreview.style.backgroundImage = '';
  uploadSeq++;
}

function acceptBaseImage(image) {
  baseImage = image;
  baseImgEmpty.hidden = true;
  baseImgLoaded.hidden = false;
  baseImgLoaded.style.setProperty('--image', `url("${image}")`);
  syncCost();
  scheduleSave({ images: true });
  measureImage(image).then((size) => {
    if (baseImage !== image) return;
    
    baseImageSize = fitToValid(size.width, size.height);
    baseImageNativeSize = size;
    applyResolution(baseImageSize.width, baseImageSize.height);
    syncCost();
  });
}

function setImage2ImageFolded(folded) {
  const masked = !maskState.hidden;
  const button = masked ? maskFold : image2imageFold;
  const body = masked ? maskBody : image2imageBody;
  const label = masked ? 'Inpaint' : 'Image2Image';
  button.setAttribute('aria-expanded', String(!folded));
  button.setAttribute('aria-label', `${folded ? 'Expand' : 'Collapse'} ${label}`);
  body.hidden = folded;
  baseImgLoaded.classList.toggle('image2image--folded', folded);
}

function clearBaseImage() {
  baseImage = null;
  baseImageSize = null;
  baseImageNativeSize = null;
  clearInpaint();
  baseImgLoaded.hidden = true;
  baseImgEmpty.hidden = false;
  baseImgLoaded.style.removeProperty('--image');
  setImage2ImageFolded(false);
  scheduleSave({ images: true });
}

imageIntent.addEventListener('click', (event) => {
  const option = event.target.closest('[data-intent]');
  if (!option || option.disabled) return;
  const { intent } = option.dataset;
  imageIntent.hidden = true;
  const image = pendingImage;
  pendingImage = null;
  imageIntentPreview.style.backgroundImage = '';

  if (intent === 'img2img') acceptBaseImage(image);
  else if (intent === 'vibe') addVibe({ image });
  else if (intent === 'precise') setPrecise({ image });
});


let pendingMetadata = null;

let uploadSeq = 0;

async function scanForMetadata(file) {
  pendingMetadata = null;
  imageMeta.hidden = true;

  const mine = ++uploadSeq;

  let found = null;
  try {
    found = await readNaiMetadata(await file.arrayBuffer());
  } catch {
    found = null;
  }

  if (!found || mine !== uploadSeq) return;

  pendingMetadata = found;
  imageMeta.hidden = false;
}

function importMetadata() {
  if (!pendingMetadata) return;

  const wants = (id) => document.getElementById(id).checked;
  const rail = metadataToRail(pendingMetadata.comment, { clean: wants('meta-clean') });

  if (wants('meta-prompt') && rail.prompt) {
    restoreControl('prompt', rail.prompt);
    if (rail.qualityToggle !== null) restoreControl('add-quality-tags', rail.qualityToggle);
  }
  if (wants('meta-undesired')) {
    if (rail.negativePrompt || rail.ucPreset) restoreControl('undesired', rail.negativePrompt);
    if (rail.ucPreset !== null) restoreControl('uc-preset', rail.ucPreset);
  }

  if (wants('meta-characters')) {
    if (!wants('meta-append')) characters.length = 0;
    for (const character of rail.characters) {
      if (characters.length >= MAX_CHARACTERS) break;
      characters.push({ ...character });
    }

    if (rail.characters.some((c) => c.position)) {
      globalAutoPosition = false;
      positionGlobalToggle.checked = false;
    }

    focusedCharacter = -1;
    positionTarget = -1;
    renderCharacters();
  }

  if (wants('meta-settings')) {
    const { settings } = rail;
    restoreControl('steps', settings.steps);
    restoreControl('guidance', settings.guidance);
    if (settings.sampler && document.querySelector(`#sampler option[value="${settings.sampler}"]`)) {
      restoreControl('sampler', settings.sampler);
    }
    restoreControl('width', settings.width);
    restoreControl('height', settings.height);
    for (const id of ['width', 'height']) {
      const input = document.getElementById(id);
      input.dataset.lastValid = input.value;
    }
    applyStepsCeiling();
  }

  if (wants('meta-seed') && rail.seed !== null) {
    restoreControl('seed', rail.seed ? String(rail.seed) : '');
  }

  closeImageIntent();
}

document.getElementById('meta-import').addEventListener('click', importMetadata);

document.getElementById('meta-characters').addEventListener('change', (event) => {
  const append = document.getElementById('meta-append');
  append.disabled = !event.target.checked;
  if (!event.target.checked) append.checked = false;
});

document.getElementById('image-intent-close').addEventListener('click', closeImageIntent);
document.getElementById('image-intent-backdrop').addEventListener('click', closeImageIntent);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !imageIntent.hidden) closeImageIntent();
});

document.getElementById('image2image-clear').addEventListener('click', clearBaseImage);

image2imageFold.addEventListener('click', () => {
  setImage2ImageFolded(image2imageFold.getAttribute('aria-expanded') === 'true');
});


const vibeSlots = vibeSlotList;
const vibeSlotTemplate = document.getElementById('vibe-slot-template');
const vibeFile = document.getElementById('vibe-file');
const vibeCount = document.getElementById('vibe-count');
const vibeCountWrap = document.getElementById('vibe-count-wrap');
const costBadge = document.getElementById('cost');
const costSpinner = document.getElementById('cost-spinner');

var costUpdating = false;
var generateBusy = false;
var generateButtonReady = false;
var overPixelCap = false;

function syncGenerateDisabled() {
  if (!generateButtonReady) return;
  generateButton.disabled = generateBusy || costUpdating || overPixelCap;
}

const COST_SETTLE_MS = 350;
let costShown = null;
let costSettling = false;
let costSettleTimer = 0;

function paintCostState() {
  const encoding = vibesReady && vibes.some((v) => v.encoding_);
  const updating = encoding || costSettling;

  costBadge.hidden = updating;
  costSpinner.hidden = !updating;

  costUpdating = updating;
  syncGenerateDisabled();
}
const vibeAddIcon = document.getElementById('vibe-add-icon');
const vibeMenuButton = vibeOverflowButton;
const vibeNormalizeRow = document.getElementById('vibe-normalize-row');
const vibeNormalize = document.getElementById('vibe-normalize');

const MAX_VIBES = 4;
const DEFAULT_REFERENCE_STRENGTH = 0.6;
const DEFAULT_INFORMATION_EXTRACTED = 0.7;
const ANLAS_PER_ENCODE = 2;
const ANLAS_PER_PRECISE_REFERENCE = 5;

const anlasGroup = document.querySelector('.anlas-group');
const anlasValue = document.getElementById('anlas-value');

let accountBalance = null;

// NovelAI subscription tiers, as returned by /user/subscription.
const TIER_NAMES = { 0: 'Paper', 1: 'Tablet', 2: 'Scroll', 3: 'Opus' };

function renderAccountTier() {
  const el = document.getElementById('menu-tier');
  if (!el) return;
  const tier = accountBalance?.tier;
  el.textContent = TIER_NAMES[tier] ? `${TIER_NAMES[tier]} Tier` : '';
}

function renderAccountBalance() {
  if (!anlasValue) return;

  if (!accountBalance) {
    if (anlasGroup) anlasGroup.hidden = true;
    return;
  }

  if (anlasGroup) anlasGroup.hidden = false;

  // NovelAI splits the balance in two: Anlas bought outright, and the monthly
  // allowance that comes with a subscription. Both are spendable, and a paid
  // account can easily have all of its Anlas in either one, so the headline
  // number is the total rather than just the purchased half.
  const purchased = accountBalance.anlas ?? 0;
  const allowance = accountBalance.subscriptionAnlas ?? 0;
  anlasValue.textContent = String(purchased + allowance);

  const parts = [`${purchased + allowance} Anlas on the NovelAI account`];
  if (allowance > 0) {
    parts.push(`${purchased} purchased · ${allowance} monthly allowance`);
  }
  parts.push(`A precise reference costs ${ANLAS_PER_PRECISE_REFERENCE} per generation`);
  if (anlasGroup) anlasGroup.title = parts.join(' · ');
}

async function refreshBalance() {
  try {
    const res = await apiFetch('/api/me?fresh=1');
    if (!res.ok) return;
    const body = await res.json();
    if (body?.balance) applyAccountBalance(body.balance);
  } catch {
  }
}

function applyAccountBalance(balance) {
  if (!balance || typeof balance !== 'object') return;
  accountBalance = balance;
  renderAccountBalance();
  renderAccountTier();
  renderOpusUsage();
  // Whether a generation is free depends on the account, so the cost badge has
  // to be recomputed once the balance lands.
  syncCost();
  if (vibesReady) renderVibes();
}

const opusBar = document.getElementById('opus-bar');
const opusBarLabel = document.getElementById('opus-bar-label');
const opusBarFill = document.getElementById('opus-bar-fill');
const opusBarInfo = document.getElementById('opus-bar-info');
const opusPanel = document.getElementById('opus-panel');
const opusPanelLabel = document.getElementById('opus-panel-label');
const opusPanelFill = document.getElementById('opus-panel-fill');
const opusPanelRefill = document.getElementById('opus-panel-refill');
const opusAlwaysShow = document.getElementById('opus-always-show');
const opusAlwaysShowSetting = document.getElementById('opus-always-show-setting');

// "17h 32m" / "48m" - how long until the allowance is full again.
function formatOpusEta(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${Math.max(1, minutes)}m`;
}

function renderOpusUsage() {
  const opus = accountBalance?.opus ?? null;

  if (opusPanel) opusPanel.hidden = !opus;
  if (opusAlwaysShowSetting) opusAlwaysShowSetting.hidden = !opus;
  if (opusBar) opusBar.hidden = !opus || !opusAlwaysShow?.checked;
  if (!opus) return;

  const percent = Math.max(0, Math.min(100, Math.round(opus.percent)));
  const label = `${percent}% of Opus Generations remaining`;

  if (opusBarLabel) opusBarLabel.textContent = label;
  if (opusPanelLabel) opusPanelLabel.textContent = `${percent}% remaining`;

  for (const fill of [opusBarFill, opusPanelFill]) {
    if (!fill) continue;
    fill.style.width = `${percent}%`;
    fill.classList.toggle('opus-meter__fill--empty', percent === 0);
  }

  if (opusPanelRefill) {
    const perPercent = Number(opus.secondsPerPercent) || 0;
    if (percent >= 100 || perPercent <= 0) {
      opusPanelRefill.textContent = percent >= 100 ? 'Your allowance is full.' : '';
    } else {
      const rate = (3600 / perPercent).toFixed(1).replace(/\.0$/, '');
      const eta = formatOpusEta((100 - percent) * perPercent);
      opusPanelRefill.textContent =
        `Currently refilling at ${rate}% per hour. Reaches 100% in ${eta}.`;
    }
  }
}

opusAlwaysShow?.addEventListener('change', renderOpusUsage);

// "More Info" opens Settings, where the full explanation lives.
opusBarInfo?.addEventListener('click', () => {
  setSettingsOpen(true);
});

let vibes = [];
var vibesReady = true;

let vibeSeq = 0;

function vibeName(source) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < source.length; i += 1) {
    const c = source.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b + c, 0x85ebca6b) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0').slice(0, 6);
  return `${hex(a)}-${hex(b)}`;
}

function uniqueVibeName(base) {
  if (!vibes.some((v) => v.name === base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} (${n})`;
    if (!vibes.some((v) => v.name === candidate)) return candidate;
  }
}

function addVibe({ image = null, encoding = null, strength, informationExtracted, name }) {
  if (vibes.length >= MAX_VIBES) {
    toastError(`Vibe Transfer takes at most ${MAX_VIBES} references.`);
    return null;
  }
  const vibe = {
    id: `vibe-${(vibeSeq += 1)}`,
    name: name ?? uniqueVibeName(vibeName(encoding ?? image ?? String(vibeSeq))),
    image,
    encoding,
    strength: strength ?? DEFAULT_REFERENCE_STRENGTH,
    informationExtracted: informationExtracted ?? DEFAULT_INFORMATION_EXTRACTED,
    enabled: true,
    imported: Boolean(encoding),
    encoding_: false,
  };
  vibes.push(vibe);
  renderVibes();
  scheduleSave({ images: true });
  return vibe;
}

function removeVibe(id) {
  vibes = vibes.filter((v) => v.id !== id);
  renderVibes();
  scheduleSave({ images: true });
}

// Opus includes free generations at up to 1 megapixel, 28 steps or fewer, one
// image at a time. Anything beyond that bills Anlas as normal.
const FREE_MAX_PIXELS = 1024 * 1024;
const FREE_MAX_STEPS = 28;

function isFreeGeneration({ width, height, steps, imageCount }) {
  return (
    Boolean(accountBalance?.opus)
    && width * height <= FREE_MAX_PIXELS
    && steps <= FREE_MAX_STEPS
    && imageCount <= 1
  );
}

function generationAnlas({ width, height, steps, strength }) {
  const r = Math.max(width * height, 65536);
  const perSample = Math.ceil(
    2951823174884865e-21 * r + 5.753298233447344e-7 * r * steps,
  );
  return Math.max(Math.ceil(perSample * strength), 2);
}

function renderPixelCapNotice(show, width, height) {
  const notice = document.getElementById('base-size-notice');
  const text = document.getElementById('base-size-notice-text');
  if (!notice || !text) return;
  if (!show) return;
  const fitted = fitToValid(width, height);
  notice.hidden = false;
  text.textContent =
    `${width}x${height} is ${((width * height) / 1e6).toFixed(1)} MP, over the `
    + `${(MAX_PIXELS / 1e6).toFixed(1)} MP NovelAI allows, so Generate is off. `
    + `Try ${fitted.width}x${fitted.height} or smaller.`;
}

function syncCost() {
  if (!vibesReady) return;

  const focusedSize = inpaint?.focused
    ? [inpaint.focused.width, inpaint.focused.height]
    : null;

  const [width, height] = focusedSize ?? currentResolution();
  const steps = Number(document.getElementById('steps').value) || 0;

  let strength = 1;
  if (inpaint) {
    strength = Number(document.getElementById('inpaint-strength').value) || 1;
  } else if (baseImage) {
    strength = Number(document.getElementById('img2img-strength').value) || 1;
  }

  const billedImages = inpaint ? 1 : imageCount;

  const free = isFreeGeneration({ width, height, steps, imageCount: billedImages });

  const generation = free
    ? 0
    : generationAnlas({ width, height, steps, strength }) * billedImages;

  const referencesSupported = !isV5Model(selectedModel);

  const pending = inpaint || !referencesSupported
    ? 0
    : vibes.filter((v) => v.enabled && needsEncoding(v)).length;
  const encodes = pending * ANLAS_PER_ENCODE;

  const references = inpaint || !referencesSupported || !precise?.image ? 0 : 1;
  const referenceCost = references * ANLAS_PER_PRECISE_REFERENCE;

  const anlas = generation + encodes + referenceCost;

  overPixelCap = overPixelBudget(width, height);
  renderPixelCapNotice(overPixelCap, width, height);
  syncGenerateDisabled();

  
  const label = overPixelCap ? 'Invalid' : String(anlas);
  const changed = costShown !== null && costShown !== label;
  costBadge.textContent = label;
  costShown = label;

  if (changed) {
    clearTimeout(costSettleTimer);
    costSettling = true;
    costSettleTimer = setTimeout(() => {
      costSettling = false;
      paintCostState();
    }, COST_SETTLE_MS);
  }

  paintCostState();
  const parts = [];
  if (generation > 0) {
    parts.push(
      `${generation} for ${width}x${height}${baseImageSize ? ' (your image)' : ''}`
        + ` at ${steps} steps`
        + (billedImages > 1 ? ` x${billedImages} images` : ''),
    );
  }
  if (encodes > 0) {
    parts.push(`${encodes} to encode ${pending} vibe${pending === 1 ? '' : 's'}`);
  }
  if (referenceCost > 0) {
    parts.push(`${referenceCost} for the precise reference (every generation)`);
  }
  costBadge.parentElement.title = parts.length
    ? `${anlas} Anlas on the next generation - ${parts.join(', ')}`
    : 'This generation costs no Anlas';
}

function needsEncoding(vibe) {
  if (!vibe.image) return false;
  if (!vibe.encoding) return true;
  return Boolean(vibe.encodedModel) && vibe.encodedModel !== selectedModel;
}

async function encodeVibe(id) {
  const vibe = vibes.find((v) => v.id === id);
  if (!vibe || !needsEncoding(vibe) || vibe.encoding_) return;

  vibe.encoding_ = true;
  renderVibes();

  try {
    const res = await apiFetch('/api/encode-vibe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: vibe.image.slice(vibe.image.indexOf(',') + 1),
        model: selectedModel,
        informationExtracted: vibe.informationExtracted,
      }),
    });
    const body = await res.json().catch(() => ({}));

    applyAccountBalance(body.balance);

    if (!res.ok) throw new Error(body.message ?? `Encoding failed (${res.status}).`);

    vibe.encoding = body.encoding;
    vibe.encodedModel = selectedModel;
    vibe.encodedInfo = vibe.informationExtracted;
    scheduleSave({ images: true });
  } catch (err) {
    reportError(`Could not encode that vibe: ${err.message}`);
  } finally {
    vibe.encoding_ = false;
    renderVibes();
  }
}

function renderVibes() {
  const active = document.activeElement;
  const keepFocus = active?.closest?.('[data-role="vibe-slot"]') ? active : null;
  const focusRole = keepFocus?.dataset?.role;
  const focusSlot = keepFocus?.closest('[data-role="vibe-slot"]')?.dataset?.vibeId;

  vibeSlots.replaceChildren();

  vibeCount.textContent = String(vibes.length);
  vibeCountWrap.hidden = vibes.length === 0;
  vibeMenuButton.hidden = vibes.length === 0;
  vibeAddIcon.classList.toggle('icon-import', vibes.length === 0);
  vibeAddIcon.classList.toggle('icon-plus', vibes.length > 0);
  vibeNormalizeRow.hidden = vibes.length === 0;

  for (const vibe of vibes) {
    const node = vibeSlotTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.vibeId = vibe.id;
    node.classList.toggle('vibe-slot--imported', vibe.imported);
    node.classList.toggle('vibe-slot--encoding', vibe.encoding_);

    const q = (role) => node.querySelector(`[data-role="${role}"]`);

    q('vibe-name').value = vibe.name;

    const thumb = q('vibe-thumb');
    if (vibe.image) thumb.style.backgroundImage = `url("${vibe.image}")`;

    const bind = (numberRole, rangeRole, value, onChange, disabled) => {
      const number = q(numberRole);
      const range = q(rangeRole);
      number.value = String(value);
      range.value = String(value);
      number.style.setProperty('--digits', String(number.value.length || 1));
      number.disabled = disabled;
      range.disabled = disabled;
      if (disabled) return;

      const push = (raw) => {
        const next = Math.min(Math.max(Number(raw), 0.01), 1);
        if (!Number.isFinite(next)) return;
        onChange(next);
      };
      range.addEventListener('input', () => {
        number.value = range.value;
        number.style.setProperty('--digits', String(number.value.length || 1));
        push(range.value);
      });
      number.addEventListener('input', () => {
        number.style.setProperty('--digits', String(number.value.length || 1));
        const n = Number(number.value);
        if (Number.isFinite(n)) range.value = String(Math.min(Math.max(n, 0.01), 1));
        push(number.value);
      });
    };

    bind('vibe-strength-number', 'vibe-strength-range', vibe.strength, (next) => {
      vibe.strength = next;
      scheduleSave();
    }, false);

    bind('vibe-info-number', 'vibe-info-range', vibe.informationExtracted, (next) => {
      vibe.informationExtracted = next;
      scheduleSave();
    },
    Boolean(vibe.encoding) || vibe.encoding_);

    const toggle = node.querySelector('[data-action="vibe-toggle"]');
    toggle.setAttribute('aria-pressed', String(vibe.enabled));
    toggle.classList.toggle('icon-button-frame__button--filled', vibe.enabled);

    const anlas = node.querySelector('[data-action="vibe-encode"]');
    const footer = q('vibe-footer');
    const owes = needsEncoding(vibe);
    footer.hidden = !owes;
    anlas.disabled = !owes || vibe.encoding_;
    anlas.title = owes
      ? `Encode now (${ANLAS_PER_ENCODE} Anlas) - otherwise this happens on the next generation`
      : 'Already encoded - no further cost.';
    q('vibe-anlas-count').textContent = owes ? String(ANLAS_PER_ENCODE) : '0';

    const footerOwed = footer.querySelector('[data-role="vibe-footer-owed"]');
    const footerBlocked = footer.querySelector('[data-role="vibe-footer-blocked"]');
    if (footerOwed) footerOwed.hidden = broke;
    if (footerBlocked) footerBlocked.hidden = !broke;

    vibeSlots.append(node);
  }

  syncCost();

  if (focusSlot && focusRole) {
    vibeSlots
      .querySelector(`[data-vibe-id="${focusSlot}"] [data-role="${focusRole}"]`)
      ?.focus();
  }
}

vibeSlots.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const id = button.closest('[data-role="vibe-slot"]')?.dataset.vibeId;
  if (!id) return;

  if (button.dataset.action === 'vibe-remove') removeVibe(id);
  else if (button.dataset.action === 'vibe-encode') encodeVibe(id);
  else if (button.dataset.action === 'vibe-toggle') {
    const vibe = vibes.find((v) => v.id === id);
    if (!vibe) return;
    vibe.enabled = !vibe.enabled;
    renderVibes();
    scheduleSave();
  }
});

vibeSlots.addEventListener('input', (event) => {
  if (event.target.dataset.role !== 'vibe-name') return;
  const id = event.target.closest('[data-role="vibe-slot"]')?.dataset.vibeId;
  const vibe = vibes.find((v) => v.id === id);
  if (!vibe) return;
  vibe.name = event.target.value;
  scheduleSave();
});

vibeButton.addEventListener('click', () => {
  if (vibes.length >= MAX_VIBES) {
    toastError(`Vibe Transfer takes at most ${MAX_VIBES} references.`);
    return;
  }
  vibeFile.click();
});

vibeNormalize.addEventListener('change', () => scheduleSave());


let exportAsEncoding = false;

const vibeFlyout = document.getElementById('vibe-flyout');

function closeVibeFlyout() {
  vibeFlyout.hidden = true;
  vibeMenuButton.setAttribute('aria-expanded', 'false');
}

vibeMenuButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const open = !vibeFlyout.hidden;
  if (open) {
    closeVibeFlyout();
    return;
  }
  vibeFlyout.hidden = false;
  vibeMenuButton.setAttribute('aria-expanded', 'true');
  const exportable = vibes.some((v) => v.encoding);
  for (const item of vibeFlyout.querySelectorAll('[data-vibe-action]')) {
    if (item.dataset.vibeAction === 'export-as-encoding') continue;
    item.disabled = !exportable;
    item.title = exportable ? '' : 'Nothing to export yet - encode a vibe first.';
  }
});

document.addEventListener('click', () => {
  if (!vibeFlyout.hidden) closeVibeFlyout();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !vibeFlyout.hidden) {
    closeVibeFlyout();
    vibeMenuButton.focus();
  }
});

function buildVibeBundle() {
  const usable = vibes.filter((v) => v.encoding);
  return {
    identifier: 'novelai-vibe-transfer-bundle',
    version: 1,
    vibes: usable.map((v) => {
      const info = v.encodedInfo ?? v.informationExtracted;
      const encodings = exportAsEncoding
        ? { 'v4-5full': { unknown: { encoding: v.encoding, informationExtracted: info } } }
        : { 'v4-5full': { [v.encoding]: { informationExtracted: info } } };
      return {
        identifier: 'novelai-vibe-transfer',
        version: 1,
        type: exportAsEncoding ? 'encoding' : 'image',
        name: v.name,
        ...(exportAsEncoding || !v.image ? {} : { image: v.image }),
        encodings,
        importInfo: { strength: v.strength, informationExtracted: info },
      };
    }),
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function embedBundleInPng(dataUrl, bundleJson) {
  const raw = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));

  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const keyword = 'tarotnai-vibe';
  const text = new TextEncoder().encode(`${keyword}\0${bundleJson}`);
  const type = new TextEncoder().encode('tEXt');
  const chunk = new Uint8Array(12 + text.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, text.length);
  chunk.set(type, 4);
  chunk.set(text, 8);
  view.setUint32(8 + text.length, crc32(Uint8Array.from([...type, ...text])));

  const view2 = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let iend = -1;
  while (offset + 8 <= bytes.length) {
    const length = view2.getUint32(offset);
    const name = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (name === 'IEND') {
      iend = offset;
      break;
    }
    offset += 12 + length;
  }
  if (iend < 0) throw new Error('that image is not a readable PNG');

  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(bytes.subarray(iend), iend + chunk.length);
  return out;
}

vibeFlyout.addEventListener('click', (event) => {
  const item = event.target.closest('[data-vibe-action]');
  if (!item || item.disabled) return;
  const action = item.dataset.vibeAction;

  if (action === 'export-as-encoding') {
    event.stopPropagation();
    exportAsEncoding = !exportAsEncoding;
    item.setAttribute('aria-checked', String(exportAsEncoding));
    scheduleSave();
    return;
  }

  closeVibeFlyout();
  const bundle = JSON.stringify(buildVibeBundle(), null, 2);

  if (action === 'export-bundle') {
    downloadBlob(new Blob([bundle], { type: 'application/json' }),
      `tarotnai-vibes-${vibes.length}.naiv4vibebundle`);
    return;
  }

  if (action === 'embed') {
    const carrier = vibes.find((v) => v.image && v.encoding);
    if (!carrier) {
      reportError('Embedding needs a vibe that still has its source image.');
      return;
    }
    try {
      const png = embedBundleInPng(carrier.image, bundle);
      downloadBlob(new Blob([png], { type: 'image/png' }), `tarotnai-vibe-${carrier.name}.png`);
    } catch (err) {
      reportError(`Could not embed the vibe: ${err.message}`);
    }
  }
});

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

async function looksLikeBundle(file) {
  if (file.size > 4 * 1024 * 1024) return false;
  try {
    const head = await file.slice(0, 4096).text();
    if (!head.trimStart().startsWith('{')) return false;
    return head.includes('novelai-vibe-transfer');
  } catch {
    return false;
  }
}

async function importVibeBundle(file, room) {
  const res = await apiFetch('/api/vibe-bundle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await file.text(),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message ?? 'That file is not a vibe bundle.');

  const parsed = payload.vibes ?? [];
  for (const v of parsed.slice(0, room)) {
    addVibe({
      encoding: v.encoding,
      strength: v.strength,
      informationExtracted: v.informationExtracted ?? DEFAULT_INFORMATION_EXTRACTED,
      name: v.name,
    });
  }
  return { added: Math.min(parsed.length, room), offered: parsed.length };
}

vibeFile.addEventListener('change', async () => {
  const files = [...(vibeFile.files ?? [])];
  vibeFile.value = '';
  if (files.length === 0) return;

  let imported = 0;
  let queued = 0;
  let overflowed = false;

  for (const file of files) {
    const room = MAX_VIBES - vibes.length;
    if (room <= 0) {
      overflowed = true;
      break;
    }
    try {
      if (await looksLikeBundle(file)) {
        const { added, offered } = await importVibeBundle(file, room);
        imported += added;
        if (offered > added) overflowed = true;
      } else {
        addVibe({ image: await readAsDataUrl(file) });
        queued += 1;
      }
    } catch (err) {
      reportError(err.message);
    }
  }

  if (imported > 0) {
    toastSuccess(`Imported ${imported} vibe${imported === 1 ? '' : 's'} - no Anlas spent.`);
  }
  if (queued > 0) {
    toastInfo(
      `${queued} image${queued === 1 ? '' : 's'} added. Encode `
      + `${queued === 1 ? 'it' : 'them'} to use ${queued === 1 ? 'it' : 'them'} `
      + `(${ANLAS_PER_ENCODE} Anlas each).`,
    );
  }
  if (overflowed) toastInfo(`Only ${MAX_VIBES} vibes fit; the rest were skipped.`);
});


const preciseSlots = document.getElementById('precise-slots');
const preciseSlotTemplate = document.getElementById('precise-slot-template');
const preciseButton = document.getElementById('precise-add');
const preciseAddIcon = document.getElementById('precise-add-icon');
const preciseFile = document.getElementById('precise-file');

const PRECISE_MIN = 0;
const PRECISE_MAX = 1;
const PRECISE_STEP = 0.05;
const DEFAULT_PRECISE_STRENGTH = 1;
const DEFAULT_PRECISE_FIDELITY = 1;

const PRECISE_MODES = [
  { value: 'character&style', label: 'Character & Style', icon: 'icon-precise-style-character' },
  { value: 'character', label: 'Character', icon: 'icon-precise-reference' },
  { value: 'style', label: 'Style', icon: 'icon-precise-style' },
];

const PRECISE_EXTRA_MODES = [
  { value: 'costume', label: 'Costume', icon: 'icon-precise-reference' },
  { value: 'delta', label: 'Delta', icon: 'icon-precise-reference' },
];

const ALL_PRECISE_MODES = [...PRECISE_MODES, ...PRECISE_EXTRA_MODES];
const PRECISE_DEFAULT_MODE = PRECISE_MODES[0].value;
const preciseMode = (value) =>
  ALL_PRECISE_MODES.find((m) => m.value === value) ?? PRECISE_MODES[0];

let precise = null;

function setPrecise({ image, strength, fidelity, mode } = {}) {
  precise = {
    image: image ?? null,
    strength: strength ?? DEFAULT_PRECISE_STRENGTH,
    fidelity: fidelity ?? DEFAULT_PRECISE_FIDELITY,
    mode: mode ?? PRECISE_DEFAULT_MODE,
  };
  renderPrecise();
  syncCost();
  return precise;
}

function clearPrecise() {
  precise = null;
  renderPrecise();
  syncCost();
}

function renderPrecise() {
  preciseSlots.replaceChildren();

  preciseAddIcon.classList.toggle('icon-import', !precise);
  preciseAddIcon.classList.toggle('icon-plus', Boolean(precise));
  preciseButton.title = precise
    ? 'Replace the reference image'
    : 'Add a reference image';

  if (!precise) return;

  const node = preciseSlotTemplate.content.firstElementChild.cloneNode(true);
  const q = (role) => node.querySelector(`[data-role="${role}"]`);

  if (precise.image) q('precise-thumb').style.backgroundImage = `url("${precise.image}")`;

  const modeCombo = q('precise-mode');
  const modeLabel = modeCombo.querySelector('.select-control__label');
  const modeIcon = modeCombo.querySelector('.precise-slot__mode-icon');
  const modeListbox = q('precise-mode-listbox');
  const current = preciseMode(precise.mode);

  modeLabel.textContent = current.label;
  modeIcon.className = `icon ${current.icon} precise-slot__mode-icon`;

  modeListbox.replaceChildren();
  const addMode = (mode, extra) => {
    const option = document.createElement('div');
    option.className = `listbox__option${extra ? ' listbox__option--extra' : ''}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(mode.value === current.value));
    option.dataset.value = mode.value;

    const glyph = document.createElement('span');
    glyph.className = `icon ${mode.icon}`;
    glyph.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = mode.label;

    option.append(glyph, text);
    modeListbox.append(option);
  };

  for (const mode of PRECISE_MODES) addMode(mode, false);

  const heading = document.createElement('div');
  heading.className = 'listbox__group-label listbox__group-label--extra';
  heading.setAttribute('role', 'presentation');
  heading.textContent = 'UNDOCUMENTED';
  modeListbox.append(heading);

  for (const mode of PRECISE_EXTRA_MODES) addMode(mode, true);

  const closeModeMenu = () => {
    modeListbox.hidden = true;
    modeCombo.setAttribute('aria-expanded', 'false');
  };

  modeCombo.addEventListener('click', () => {
    const open = modeListbox.hidden;
    modeListbox.hidden = !open;
    modeCombo.setAttribute('aria-expanded', String(open));
  });
  modeCombo.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      modeCombo.click();
    } else if (event.key === 'Escape') closeModeMenu();
  });
  modeListbox.addEventListener('click', (event) => {
    const option = event.target.closest('.listbox__option');
    if (!option) return;
    precise.mode = option.dataset.value;
    closeModeMenu();
    renderPrecise();
  });

  const bind = (numberRole, rangeRole, value, onChange) => {
    const number = q(numberRole);
    const range = q(rangeRole);
    number.value = String(value);
    range.value = String(value);
    number.style.setProperty('--digits', String(number.value.length || 1));

    const push = (raw) => {
      const next = Number(raw);
      if (!Number.isFinite(next)) return;
      onChange(Math.min(Math.max(next, PRECISE_MIN), PRECISE_MAX));
    };
    range.addEventListener('input', () => {
      number.value = range.value;
      number.style.setProperty('--digits', String(number.value.length || 1));
      push(range.value);
    });
    number.addEventListener('input', () => {
      number.style.setProperty('--digits', String(number.value.length || 1));
      const n = Number(number.value);
      if (Number.isFinite(n)) {
        range.value = String(Math.min(Math.max(n, PRECISE_MIN), PRECISE_MAX));
      }
      push(number.value);
    });
  };

  bind('precise-strength-number', 'precise-strength-range', precise.strength, (next) => {
    precise.strength = next;
  });
  bind('precise-fidelity-number', 'precise-fidelity-range', precise.fidelity, (next) => {
    precise.fidelity = next;
  });

  preciseSlots.append(node);
}

preciseSlots.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  if (button.dataset.action === 'precise-remove') clearPrecise();
});

preciseButton.addEventListener('click', () => preciseFile.click());

const vibeBox = document.getElementById('vibe-box');
const preciseBox = document.getElementById('precise-box');
const vibeIntentOption = document.getElementById('image-intent-vibe');
const preciseIntentOption = document.getElementById('image-intent-precise');

syncModelFeatures = () => {
  const supported = !isV5Model(selectedModel);
  vibeBox.hidden = !supported;
  vibeNotice.hidden = !supported || maskState.hidden;
  preciseBox.hidden = !supported;
  vibeIntentOption.hidden = !supported;
  preciseIntentOption.hidden = !supported;
  syncCost();
};

renderPrecise();
syncModelFeatures();

preciseFile.addEventListener('change', async () => {
  const file = preciseFile.files?.[0];
  preciseFile.value = '';
  if (!file) return;
  try {
    setPrecise({ image: await readAsDataUrl(file) });
  } catch (err) {
    reportError(err.message);
  }
});


const PEN_SIZE_BOUNDS = {
  mask: { min: 4, max: 50, value: 4 },
  draw: { min: 5, max: 100, value: 20 },
};

const penSizeByMode = {
  mask: PEN_SIZE_BOUNDS.mask.value,
  draw: PEN_SIZE_BOUNDS.draw.value,
};

function setDrawWindowMode(mode) {
  const drawing = mode === 'draw';
  drawWindowTitle.textContent = drawing ? 'Draw' : 'Draw Mask';
  drawWindow.setAttribute('aria-label', drawing ? 'Draw' : 'Draw Mask');

  drawWindow.classList.toggle('draw-window--ink', drawing);
  drawWindow.classList.toggle('draw-window--mask', !drawing);

  const bounds = PEN_SIZE_BOUNDS[drawing ? 'draw' : 'mask'];
  penSizeRange.min = String(bounds.min);
  penSizeRange.max = String(bounds.max);
  syncPenSize(penSizeByMode[drawing ? 'draw' : 'mask'] ?? bounds.value);

  if (!drawing) {
    closeColorPicker();
    const hsv = document.getElementById('hsv-panel');
    if (!hsv.hidden) {
      editor.cancelHsv();
      hsv.hidden = true;
      document.getElementById('draw-settings').setAttribute('aria-expanded', 'false');
    }
  }

  editor.setMode(mode);
  syncFocusControls();
}

async function openDrawEditor() {
  setDrawWindowMode('draw');
  drawWindow.hidden = false;
  if (baseImage) await editor.load(baseImage);
  else {
    const [width, height] = currentResolution();
    editor.loadBlank(width, height);
  }
  syncHistoryButtons();
}

async function openMaskEditor({ keepMask = false } = {}) {
  if (!baseImage) return;
  setDrawWindowMode('mask');
  drawWindow.hidden = false;
  if (!keepMask) await editor.load(baseImage);
  editor.fit();
  syncHistoryButtons();
}

function closeDrawWindow() {
  drawWindow.hidden = true;
  const resize = document.getElementById('resize-modal');
  if (resize) resize.hidden = true;
  document.getElementById('draw-resize')?.setAttribute('aria-expanded', 'false');
}

baseImgDraw.addEventListener('click', () => openDrawEditor());
document.getElementById('image2image-draw').addEventListener('click', () => openDrawEditor());
document.getElementById('image2image-inpaint').addEventListener('click', () => openMaskEditor());
document.getElementById('draw-close').addEventListener('click', closeDrawWindow);

document.getElementById('mask-edit')
  .addEventListener('click', () => openMaskEditor({ keepMask: true }));
document.getElementById('mask-clear').addEventListener('click', clearBaseImage);
document.getElementById('mask-back').addEventListener('click', clearInpaint);

maskFold.addEventListener('click', () => {
  setImage2ImageFolded(maskFold.getAttribute('aria-expanded') === 'true');
});

document.getElementById('draw-save').addEventListener('click', () => {
  if (editor.mode === 'draw') {
    if (!editor.hasStrokes()) {
      closeDrawWindow();
      return;
    }
    acceptBaseImage(editor.exportImageUrl());
    clearInpaint();
    closeDrawWindow();
    return;
  }

  const focusRegion = editor.focusRegion;
  if (focusRegion) {
    const crop = editor.exportFocusedCrop();
    if (!crop) {
      closeDrawWindow();
      return;
    }
    inpaint = {
      image: crop.image,
      mask: crop.mask,
      blend: editor.buildCompositeMask().toDataURL('image/png'),
      focused: {
        width: crop.width,
        height: crop.height,
        context: crop.context,
        inpaint: crop.inpaint,
        base: baseImage,
      },
    };
    maskPreview.src = editor.exportFocusedPreview() ?? editor.exportMaskedImage();
    setMaskState(true);
    closeDrawWindow();
    scheduleSave({ images: true });
    return;
  }

  if (!editor.hasMask()) {
    closeDrawWindow();
    return;
  }
  inpaint = {
    image: editor.exportImage(),
    mask: editor.exportMask(),
    blend: editor.buildCompositeMask().toDataURL('image/png'),
  };
  applyInpaintSideCap();
  maskPreview.src = editor.exportMaskedImage();
  setMaskState(true);
  closeDrawWindow();
  scheduleSave({ images: true });
});

document.getElementById('draw-export').addEventListener('click', () => {
  const link = document.createElement('a');
  if (editor.mode === 'draw') {
    link.href = editor.exportImageUrl();
    link.download = 'canvas.png';
  } else {
    link.href = editor.exportMaskPreview();
    link.download = 'mask.png';
  }
  link.click();
});

const toolButtons = [...drawWindow.querySelectorAll('.draw-tool[data-tool]')];

function syncToolButtons() {
  for (const button of toolButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === editor.tool));
  }
}

for (const button of toolButtons) {
  button.addEventListener('click', () => {
    editor.setTool(button.dataset.tool);
    syncToolButtons();
    syncFocusControls();
  });
}

editor.onToolChange = () => {
  syncToolButtons();
  syncFocusControls();
};

const layersPanel = document.getElementById('draw-layers-panel');
const layersList = document.getElementById('draw-layers-list');
const layersToggle = document.getElementById('draw-layers-toggle');
const layersCount = document.getElementById('draw-layers-count');
const layerAdd = document.getElementById('draw-layer-add');
const layerMerge = document.getElementById('draw-layer-merge');

function renderLayers() {
  const layers = editor.layers;
  layersCount.textContent = String(layers.length);
  layersList.replaceChildren();

  layers.forEach((layer, index) => {
    const row = document.createElement('div');
    row.className = 'draw-layer-row';
    if (layer.active) row.classList.add('draw-layer-row--active');
    if (!layer.visible) row.classList.add('draw-layer-row--hidden');

    const tile = document.createElement('div');
    tile.className = 'draw-layer-row__tile';

    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'draw-layer-row__thumb-button';
    pick.setAttribute('aria-label', `Select layer ${layers.length - index}`);
    pick.setAttribute('aria-pressed', String(layer.active));
    pick.addEventListener('click', () => editor.selectLayer(index));

    const thumb = document.createElement('img');
    thumb.className = 'draw-layer-row__thumb';
    thumb.alt = '';
    const url = editor.layerThumbnail(index);
    if (url) thumb.src = url;
    pick.append(thumb);
    tile.append(pick);

    if (layer.base) {
      const badge = document.createElement('span');
      badge.className = 'draw-layer-row__badge';
      badge.title = 'Base image';
      const icon = document.createElement('span');
      icon.className = 'icon icon-layer-base';
      icon.setAttribute('aria-hidden', 'true');
      badge.append(icon);
      tile.append(badge);
    }

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'draw-layer-row__delete';
    del.setAttribute('aria-label', 'Delete layer');
    del.disabled = layers.length <= 1;
    const delIcon = document.createElement('span');
    delIcon.className = 'icon icon-trash';
    delIcon.setAttribute('aria-hidden', 'true');
    del.append(delIcon);
    del.addEventListener('click', () => editor.removeLayer(index));
    tile.append(del);

    const arrows = document.createElement('div');
    arrows.className = 'draw-layer-row__arrows';
    for (const [dir, label, cls, disabled] of [
      [-1, 'Move layer up', 'icon-directional_arrow_up', index === 0],
      [1, 'Move layer down', 'icon-directional_arrow_down', index === layers.length - 1],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.disabled = disabled;
      const icon = document.createElement('span');
      icon.className = `icon ${cls}`;
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon);
      button.addEventListener('click', () => editor.moveLayer(index, dir));
      arrows.append(button);
    }

    row.append(tile, arrows);
    layersList.append(row);
  });
}

layersToggle.addEventListener('click', () => {
  const collapsed = !layersPanel.hidden;
  layersPanel.hidden = collapsed;
  layersToggle.setAttribute('aria-expanded', String(!collapsed));
});

layerAdd.addEventListener('click', () => editor.addLayer());

layerMerge.addEventListener('click', () => editor.mergeLayers());

editor.onLayersChange = renderLayers;
renderLayers();

editor.onPick = (r, g, b) => {
  Object.assign(penColor, rgbToHsv(r, g, b));
  applyPenColor();
};

const penSize = document.getElementById('pen-size');
const penSizeRange = document.getElementById('pen-size-range');
const penSizeGroup = document.getElementById('pen-size-group');

const clampPenSize = (value) => Math.min(
  Math.max(Number(value) || Number(penSizeRange.min), Number(penSizeRange.min)),
  Number(penSizeRange.max),
);

const fitPenSizeDigits = () => {
  penSize.style.setProperty('--digits', String(penSize.value.length || 1));
};

const syncPenSize = (value) => {
  const size = clampPenSize(value);
  penSize.value = String(size);
  penSizeRange.value = String(size);
  fitPenSizeDigits();
  editor.setSize(size);
  penSizeByMode[editor.mode === 'draw' ? 'draw' : 'mask'] = size;
  if (penSizeReady) scheduleSave();
};

let penSizeReady = false;

penSizeRange.addEventListener('input', () => syncPenSize(penSizeRange.value));

penSize.addEventListener('input', () => {
  fitPenSizeDigits();
  const typed = Number(penSize.value);
  if (!penSize.value.trim() || !Number.isFinite(typed)) return;
  if (typed < Number(penSizeRange.min) || typed > Number(penSizeRange.max)) return;
  penSizeRange.value = String(typed);
  editor.setSize(typed);
});
penSize.addEventListener('change', () => syncPenSize(penSize.value));
penSize.addEventListener('blur', () => syncPenSize(penSize.value));

syncPenSize(penSizeRange.value);

const contextAreaGroup = document.getElementById('context-area-group');
const contextArea = document.getElementById('context-area');
const contextAreaRange = document.getElementById('context-area-range');
const squareBrushRow = document.getElementById('square-brush-row');

const fitContextDigits = () => {
  contextArea.style.setProperty('--digits', String(contextArea.value.length || 1));
};

const syncContextArea = (value) => {
  const n = Number(value);
  const clamped = Math.min(
    Math.max(Number.isFinite(n) ? n : Number(contextAreaRange.value),
      Number(contextAreaRange.min)),
    Number(contextAreaRange.max),
  );
  editor.setContextArea(clamped);
  const applied = editor.contextArea;
  contextArea.value = String(applied);
  contextAreaRange.value = String(applied);
  fitContextDigits();
};

contextAreaRange.addEventListener('input', () => {
  contextArea.value = String(contextAreaRange.value);
  fitContextDigits();
});
contextAreaRange.addEventListener('change', () => syncContextArea(contextAreaRange.value));
contextArea.addEventListener('input', () => {
  fitContextDigits();
  const typed = Number(contextArea.value);
  if (!contextArea.value.trim() || !Number.isFinite(typed)) return;
  if (typed < Number(contextAreaRange.min) || typed > Number(contextAreaRange.max)) return;
  contextAreaRange.value = String(typed);
});
contextArea.addEventListener('change', () => syncContextArea(contextArea.value));
contextArea.addEventListener('blur', () => syncContextArea(contextArea.value));

syncContextArea(contextAreaRange.value);

function syncFocusControls() {
  const focused = editor.mode === 'mask' && editor.tool === 'select';
  contextAreaGroup.hidden = !focused;
  penSizeGroup.hidden = focused;
  squareBrushRow.hidden = focused;

  const base = editor.mode === 'draw' ? 'Draw' : 'Draw Mask';
  drawWindowTitle.textContent = focused ? 'Focused Area\nSelection' : base;
  drawTitleIcon.classList.toggle('icon-select', focused);
  drawTitleIcon.classList.toggle('icon-pen', !focused);

  drawWindow.setAttribute('aria-label', base);

  const selectButton = drawWindow.querySelector('.draw-tool[data-tool="select"]');
  selectButton?.setAttribute(
    'aria-label',
    focused ? 'Focused Area Selection' : 'Select',
  );
}

const squareBrush = document.getElementById('square-brush');
squareBrush.addEventListener('change', (event) => {
  editor.setShape(event.target.checked ? 'square' : 'round');
  syncBrushShapeButtons();
});

const brushShapeButtons = [...drawWindow.querySelectorAll('.brush-shape__button[data-shape]')];

function syncBrushShapeButtons() {
  const shape = editor.shape;
  for (const button of brushShapeButtons) {
    button.setAttribute('aria-checked', String(button.dataset.shape === shape));
  }
  squareBrush.checked = shape === 'square';
}

for (const button of brushShapeButtons) {
  button.addEventListener('click', () => {
    editor.setShape(button.dataset.shape);
    syncBrushShapeButtons();
  });
}

editor.setShape(squareBrush.checked ? 'square' : 'round');
syncBrushShapeButtons();

document.getElementById('pen-pressure').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const on = button.getAttribute('aria-pressed') === 'true';
  button.setAttribute('aria-pressed', String(!on));
});


const penColorButton = document.getElementById('pen-color');
const colorPicker = document.getElementById('color-picker');
const colorField = document.getElementById('color-field');
const colorFieldThumb = document.getElementById('color-field-thumb');
const colorHue = document.getElementById('color-hue');
const colorHueHandle = document.getElementById('color-hue-handle');
const colorAlpha = document.getElementById('color-alpha');
const colorAlphaHandle = document.getElementById('color-alpha-handle');
const colorHex = document.getElementById('color-hex');

const penColor = { h: 0, s: 0, v: 0 };

function hsvToRgb(h, s, v) {
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

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = penColor.h;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max / 255 };
}

const clamp01 = (n) => Math.min(Math.max(n, 0), 1);

function applyPenColor() {
  const [r, g, b] = hsvToRgb(penColor.h, penColor.s, penColor.v);
  const opaque = `rgb(${r}, ${g}, ${b})`;
  const css = opaque;

  drawWindow.style.setProperty('--pen-color', css);
  drawWindow.style.setProperty('--pen-color-opaque', opaque);
  colorPicker.style.setProperty('--picker-hue',
    `hsl(${penColor.h}, 100%, 50%)`);

  colorFieldThumb.style.left = `${penColor.s * 100}%`;
  colorFieldThumb.style.top = `${(1 - penColor.v) * 100}%`;
  colorHueHandle.style.left = `${(penColor.h / 360) * 100}%`;
  colorAlphaHandle.style.left = `${(1 - penColor.v) * 100}%`;

  const hex = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  colorHex.textContent = hex;

  editor.setInk(css);
}

function trackDrag(element, onMove) {
  const handle = (event) => {
    const rect = element.getBoundingClientRect();
    onMove(
      clamp01((event.clientX - rect.left) / rect.width),
      clamp01((event.clientY - rect.top) / rect.height),
    );
    applyPenColor();
  };
  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    handle(event);
  });
  element.addEventListener('pointermove', (event) => {
    if (!element.hasPointerCapture(event.pointerId)) return;
    handle(event);
  });
}

trackDrag(colorField, (x, y) => {
  penColor.s = x;
  penColor.v = 1 - y;
});
trackDrag(colorHue, (x) => {
  penColor.h = x * 360;
});
trackDrag(colorAlpha, (x) => {
  penColor.v = 1 - x;
});

function closeColorPicker() {
  colorPicker.hidden = true;
  penColorButton.setAttribute('aria-expanded', 'false');
}

penColorButton.addEventListener('click', (event) => {
  event.stopPropagation();
  const open = colorPicker.hidden;
  colorPicker.hidden = !open;
  penColorButton.setAttribute('aria-expanded', String(open));
});

drawWindow.addEventListener('pointerdown', (event) => {
  if (colorPicker.hidden) return;
  if (colorPicker.contains(event.target) || penColorButton.contains(event.target)) return;
  closeColorPicker();
});

applyPenColor();

{
  const panel = document.getElementById('hsv-panel');
  const openButton = document.getElementById('draw-settings');

  const fields = [
    { key: 'hue', number: 'hsv-hue', range: 'hsv-hue-range' },
    { key: 'saturation', number: 'hsv-saturation', range: 'hsv-saturation-range' },
    { key: 'brightness', number: 'hsv-brightness', range: 'hsv-brightness-range' },
  ].map(({ key, number, range }) => ({
    key,
    number: document.getElementById(number),
    range: document.getElementById(range),
  }));

  const values = () => Object.fromEntries(
    fields.map(({ key, range }) => [key, Number(range.value) || 0]),
  );

  const preview = () => editor.previewHsv(values());

  const fitDigits = (field) => {
    field.number.style.setProperty('--digits', String(field.number.value.length || 1));
  };
  const fitAllDigits = () => fields.forEach(fitDigits);

  const clampField = (field, value) => Math.min(
    Math.max(Number(value) || 0, Number(field.range.min)),
    Number(field.range.max),
  );

  for (const field of fields) {
    field.range.addEventListener('input', () => {
      field.number.value = field.range.value;
      fitDigits(field);
      preview();
    });
    field.number.addEventListener('input', () => {
      fitDigits(field);
      const typed = Number(field.number.value);
      if (!field.number.value.trim() || !Number.isFinite(typed)) return;
      if (typed < Number(field.range.min) || typed > Number(field.range.max)) return;
      field.range.value = String(typed);
      preview();
    });
    const commitTyped = () => {
      const next = clampField(field, field.number.value);
      field.number.value = String(next);
      field.range.value = String(next);
      fitDigits(field);
      preview();
    };
    field.number.addEventListener('change', commitTyped);
    field.number.addEventListener('blur', commitTyped);
  }

  const zero = () => {
    for (const field of fields) {
      field.range.value = '0';
      field.number.value = '0';
    }
    fitAllDigits();
  };

  fitAllDigits();

  const close = () => {
    panel.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
  };

  openButton.setAttribute('aria-haspopup', 'dialog');
  openButton.setAttribute('aria-expanded', 'false');
  openButton.addEventListener('click', () => {
    const opening = panel.hidden;
    if (opening) {
      zero();
    } else {
      editor.cancelHsv();
    }
    panel.hidden = !opening;
    openButton.setAttribute('aria-expanded', String(opening));
  });

  document.getElementById('hsv-reset').addEventListener('click', () => {
    zero();
    editor.cancelHsv();
  });

  document.getElementById('hsv-cancel').addEventListener('click', () => {
    editor.cancelHsv();
    close();
  });

  document.getElementById('hsv-apply').addEventListener('click', () => {
    editor.commitHsv();
    close();
  });

  panel.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    editor.cancelHsv();
    close();
  });
}

document.getElementById('draw-clear').addEventListener('click', () => editor.clear());

const resizeButton = document.getElementById('draw-resize');
resizeButton.addEventListener('click', () => {
  if (resizeModal.hidden) openResizeModal();
  else closeResizeModal();
});
function syncResizeButton() {
  resizeButton.disabled = !editor.hasImage;
}

const resizeModal = document.getElementById('resize-modal');
const resizeWidth = document.getElementById('resize-width');
const resizeHeight = document.getElementById('resize-height');
const resizeEdges = {
  left: document.getElementById('resize-left'),
  top: document.getElementById('resize-top'),
  right: document.getElementById('resize-right'),
  bottom: document.getElementById('resize-bottom'),
};
const resizePreview = document.getElementById('resize-preview');

const RESIZE_PREVIEW_MAX = 160;
const RESIZE_GRID = 64;

const resizeInt = (input) => {
  const n = Number.parseInt(input.value, 10);
  return Number.isFinite(n) ? n : 0;
};

function resizeTarget() {
  const rect = editor.canvasRect;
  const base = { width: rect.width || 0, height: rect.height || 0 };
  const edges = {
    left: resizeInt(resizeEdges.left),
    top: resizeInt(resizeEdges.top),
    right: resizeInt(resizeEdges.right),
    bottom: resizeInt(resizeEdges.bottom),
  };
  const shifted = edges.left || edges.top || edges.right || edges.bottom;
  if (shifted) {
    return {
      mode: 'edges',
      edges,
      width: base.width + edges.left + edges.right,
      height: base.height + edges.top + edges.bottom,
      originX: edges.left,
      originY: edges.top,
      base,
    };
  }
  const w = resizeInt(resizeWidth);
  const h = resizeInt(resizeHeight);
  return {
    mode: 'size',
    edges,
    width: w || base.width,
    height: h || base.height,
    originX: 0,
    originY: 0,
    base,
  };
}

function renderResizePreview() {
  const t = resizeTarget();
  const { base } = t;
  if (!base.width || !base.height) {
    resizePreview.replaceChildren();
    return;
  }

  const outW = Math.max(1, t.width);
  const outH = Math.max(1, t.height);
  const k = RESIZE_PREVIEW_MAX / Math.max(outW, outH);
  const vbW = outW * k;
  const vbH = outH * k;
  const changed = outW !== base.width || outH !== base.height;

  const ox = Math.max(0, t.originX) * k;
  const oy = Math.max(0, t.originY) * k;

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(vbW));
  svg.setAttribute('height', String(vbH));
  svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const original = document.createElementNS(ns, 'rect');
  original.setAttribute('x', String(ox));
  original.setAttribute('y', String(oy));
  original.setAttribute('width', String(base.width * k));
  original.setAttribute('height', String(base.height * k));
  original.setAttribute('fill', '#22253F');
  original.setAttribute('stroke', '#FFFFFF');
  original.setAttribute('stroke-width', '1');
  svg.append(original);

  if (changed) {
    const next = document.createElementNS(ns, 'rect');
    next.setAttribute('x', '0');
    next.setAttribute('y', '0');
    next.setAttribute('width', String(vbW));
    next.setAttribute('height', String(vbH));
    next.setAttribute('fill', 'none');
    next.setAttribute('stroke', '#9CDCFF');
    next.setAttribute('stroke-width', '2');
    next.setAttribute('stroke-dasharray', '4 3');
    svg.append(next);
  }

  const cx = ox + (base.width * k) / 2;
  const cy = oy + (base.height * k) / 2;
  const label = (y, fill, size, weight, text) => {
    const el = document.createElementNS(ns, 'text');
    el.setAttribute('x', String(cx));
    el.setAttribute('y', String(y));
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'middle');
    el.setAttribute('fill', fill);
    el.setAttribute('font-size', String(size));
    if (weight) el.setAttribute('font-weight', weight);
    el.textContent = text;
    svg.append(el);
  };

  if (changed) {
    label(cy - 6, '#FFFFFFA0', 10, null, `${base.width}×${base.height}`);
    label(cy + 8, '#9CDCFF', 11, 'bold', `${outW}×${outH}`);
  } else {
    label(cy, '#FFFFFFA0', 10, null, `${base.width}×${base.height}`);
  }

  resizePreview.replaceChildren(svg);
}

function clearResizeEdges() {
  for (const input of Object.values(resizeEdges)) input.value = '0';
}
function syncResizeFieldsToCanvas() {
  const rect = editor.canvasRect;
  resizeWidth.value = String(rect.width || 0);
  resizeHeight.value = String(rect.height || 0);
}

function openResizeModal() {
  if (!editor.hasImage) return;
  syncResizeFieldsToCanvas();
  clearResizeEdges();
  renderResizePreview();
  resizeModal.hidden = false;
  resizeButton.setAttribute('aria-expanded', 'true');
  resizeWidth.focus();
}

function closeResizeModal() {
  resizeModal.hidden = true;
  resizeButton.setAttribute('aria-expanded', 'false');
}

for (const input of [resizeWidth, resizeHeight]) {
  input.addEventListener('input', () => {
    clearResizeEdges();
    renderResizePreview();
  });
}
for (const input of Object.values(resizeEdges)) {
  input.addEventListener('input', () => {
    syncResizeFieldsToCanvas();
    renderResizePreview();
  });
}

document.getElementById('resize-swap').addEventListener('click', () => {
  const w = resizeWidth.value;
  resizeWidth.value = resizeHeight.value;
  resizeHeight.value = w;
  clearResizeEdges();
  renderResizePreview();
});

document.getElementById('resize-crop').addEventListener('click', () => {
  const rect = editor.canvasRect;
  const floorTo = (v) => Math.max(RESIZE_GRID, Math.floor(v / RESIZE_GRID) * RESIZE_GRID);
  resizeWidth.value = String(floorTo(rect.width || 0));
  resizeHeight.value = String(floorTo(rect.height || 0));
  clearResizeEdges();
  renderResizePreview();
});

document.getElementById('resize-apply').addEventListener('click', () => {
  const t = resizeTarget();
  if (t.mode === 'edges') {
    editor.expandBy(t.edges);
  } else {
    editor.expandBy({
      right: t.width - t.base.width,
      bottom: t.height - t.base.height,
    });
  }
  closeResizeModal();
  syncHistoryButtons();
});

document.getElementById('resize-modal-close').addEventListener('click', closeResizeModal);
document.getElementById('resize-modal-backdrop').addEventListener('click', closeResizeModal);

resizeModal.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  event.stopPropagation();
  closeResizeModal();
  resizeButton.focus();
});

const undoButton = document.getElementById('draw-undo');
const redoButton = document.getElementById('draw-redo');

function syncHistoryButtons() {
  undoButton.disabled = !editor.canUndo;
  redoButton.disabled = !editor.canRedo;
  syncResizeButton();
}
editor.onHistoryChange = syncHistoryButtons;

undoButton.addEventListener('click', () => editor.undo());
redoButton.addEventListener('click', () => editor.redo());

document.addEventListener('keydown', (event) => {
  if (drawWindow.hidden) return;
  if (event.key === 'Escape') {
    closeDrawWindow();
    return;
  }
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) editor.redo();
    else editor.undo();
  } else if (key === 'y') {
    event.preventDefault();
    editor.redo();
  }
});

window.addEventListener('resize', () => {
  if (!drawWindow.hidden) editor.reflow();
});

{
  const number = document.getElementById('inpaint-strength');
  const range = document.getElementById('inpaint-strength-range');
  const sizeNumber = () => {
    number.style.setProperty('--digits', String(number.value.length || 1));
  };
  sizeNumber();
  range.addEventListener('input', () => {
    number.value = range.value;
    sizeNumber();
    syncCost();
  });
  number.addEventListener('input', () => {
    const value = Number(number.value);
    if (Number.isFinite(value)) {
      range.value = String(Math.min(Math.max(value, Number(range.min)), Number(range.max)));
    }
    sizeNumber();
    syncCost();
  });
}

const generateButton = document.getElementById('generate');
generateButtonReady = true;
syncGenerateDisabled();
const canvasProgress = document.getElementById('canvas-progress');
const generateLabel = document.getElementById('generate-label');
const generateIdleLabel = generateLabel.textContent;

const quickAction = document.getElementById('quick-action');
const resultRow = document.getElementById('result-row');
const useAsBaseButton = document.getElementById('use-as-base');
const editImageButton = document.getElementById('edit-image');
const inpaintImageButton = document.getElementById('inpaint-image');
const copyClipboardButton = document.getElementById('copy-clipboard');
const downloadImageButton = document.getElementById('download-image');
const pinImageButton = document.getElementById('pin-image');
const expandImageButton = document.getElementById('expand-image');
const seedBadge = document.getElementById('seed-badge');
const seedBadgeValue = document.getElementById('seed-badge-value');
const resolutionBadge = document.getElementById('resolution-badge');
const resolutionBadgeW = document.getElementById('resolution-badge-w');
const resolutionBadgeH = document.getElementById('resolution-badge-h');

let activeStream = null;

function readParams() {
  const width = document.getElementById('width').value;
  const height = document.getElementById('height').value;
  const seed = document.getElementById('seed').value.trim();

  const typed = document.getElementById('prompt').value;
  const prompt = furryMode && typed.trim() ? `${FURRY_TAG}, ${typed}` : typed;

  const strengthAndNoise = {
    strength: Number(document.getElementById('img2img-strength').value),
    noise: Number(document.getElementById('img2img-noise').value),
  };

  let baseImageFields = {};
  if (inpaint) {
    const inpaintStrengthValue = Number(document.getElementById('inpaint-strength').value);
    baseImageFields = {
      image: inpaint.image,
      mask: inpaint.mask,
      inpaintStrength: inpaintStrengthValue,
      strength: Number(document.getElementById('img2img-strength').value),
      addOriginalImage: false,
      ...(inpaint.focused
        ? { resolution: `${inpaint.focused.width},${inpaint.focused.height}` }
        : {}),
    };
  } else if (baseImage) {
    baseImageFields = {
      image: baseImage.slice(baseImage.indexOf(',') + 1),
      ...strengthAndNoise,
    };
  }

  return {
    prompt,
    negativePrompt: document.getElementById('undesired').value,
    resolution: `${width},${height}`,
    ...baseImageFields,
    model: selectedModel,
    qualityToggle: document.getElementById('add-quality-tags').checked,
    transparentBg: transparentBg && isV5Model(selectedModel),
    ucPreset: document.getElementById('uc-preset').value,
    steps: Number(document.getElementById('steps').value),
    guidance: Number(document.getElementById('guidance').value),
    sampler: document.getElementById('sampler').value,
    seed: /^\d+$/.test(seed) ? Number(seed) : 0,
    imageCount: inpaint ? 1 : imageCount,
    characters: characters
      .filter((c) => c.enabled && c.prompt.trim())
      .map((c) => ({ prompt: c.prompt.trim(), uc: c.uc.trim(), position: c.position })),
    vibes: inpaint || isV5Model(selectedModel)
      ? []
      : vibes
        .filter((v) => v.enabled && v.encoding)
        .map((v) => ({ encoding: v.encoding, strength: v.strength })),
    normalizeVibes: vibeNormalize.checked,
    precise: inpaint || isV5Model(selectedModel) || !precise?.image
      ? null
      : {
        image: precise.image.slice(precise.image.indexOf(',') + 1),
        strength: precise.strength,
        fidelity: precise.fidelity,
        mode: precise.mode,
      },
  };
}

function setBusy(busy) {
  generateBusy = busy;
  syncGenerateDisabled();
  generateButton.classList.remove('generate-button--pressed');
  if (canvasProgress) canvasProgress.hidden = !busy;
  generateLabel.textContent = busy ? 'Generating' : generateIdleLabel;
}

function focusedOutputSize(width, height) {
  const snap = (v) => Math.min(
    Math.max(Math.round(v / DIMENSION_STEP) * DIMENSION_STEP, DIMENSION_MIN),
    DIMENSION_MAX,
  );
  return { width: snap(width), height: snap(height) };
}

async function compositeInpaintResult(resultSrc, overlay) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('an image could not be loaded'));
    img.src = src;
  });

  const [base, result, blend] = await Promise.all([
    load(overlay.base), load(resultSrc), load(overlay.blend),
  ]);

  const out = document.createElement('canvas');
  out.width = base.naturalWidth;
  out.height = base.naturalHeight;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(base, 0, 0, out.width, out.height);

  const cut = document.createElement('canvas');
  cut.width = out.width;
  cut.height = out.height;
  const cctx = cut.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(result, 0, 0, cut.width, cut.height);
  cctx.globalCompositeOperation = 'destination-in';
  cctx.drawImage(blend, 0, 0, cut.width, cut.height);

  ctx.drawImage(cut, 0, 0);
  return out.toDataURL('image/png');
}

async function pasteFocusedResult(resultSrc, focused, blendSrc) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The generated image could not be loaded.'));
    img.src = src;
  });

  const [base, patch, blend] = await Promise.all([
    load(focused.base), load(resultSrc), load(blendSrc),
  ]);

  const grid = focusedOutputSize(base.naturalWidth, base.naturalHeight);
  const out = document.createElement('canvas');
  out.width = grid.width;
  out.height = grid.height;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(base, 0, 0, out.width, out.height);

  const sX = out.width / base.naturalWidth;
  const sY = out.height / base.naturalHeight;
  const x = focused.context.x * sX;
  const y = focused.context.y * sY;
  const width = focused.context.width * sX;
  const height = focused.context.height * sY;

  const patchCanvas = document.createElement('canvas');
  patchCanvas.width = Math.max(1, Math.round(width));
  patchCanvas.height = Math.max(1, Math.round(height));
  const pctx = patchCanvas.getContext('2d');

  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(
    patch,
    0, 0, patch.naturalWidth, patch.naturalHeight,
    0, 0, patchCanvas.width, patchCanvas.height,
  );

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = patchCanvas.width;
  alphaCanvas.height = patchCanvas.height;
  const actx = alphaCanvas.getContext('2d');
  actx.imageSmoothingEnabled = true;
  actx.imageSmoothingQuality = 'high';
  actx.drawImage(
    blend,
    x / sX, y / sY, width / sX, height / sY,
    0, 0, alphaCanvas.width, alphaCanvas.height,
  );

  pctx.globalCompositeOperation = 'destination-in';
  pctx.drawImage(alphaCanvas, 0, 0);
  pctx.globalCompositeOperation = 'source-over';

  ctx.drawImage(patchCanvas, Math.round(x), Math.round(y));

  return out.toDataURL('image/png');
}

function watchJob(jobId, settings, focused = null, overlayBase = null, focusedBlend = null) {
  activeStream?.close();
  const stream = new EventSource(`/api/jobs/${jobId}/events`);
  activeStream = stream;

  const isCurrent = () => activeStream === stream;

  stream.addEventListener('end', () => {
    stream.close();
    if (isCurrent()) activeStream = null;
    refreshBalance();
  });

  stream.onmessage = (event) => {
    if (!isCurrent()) {
      stream.close();
      return;
    }
    const update = JSON.parse(event.data);
    if (update.state === 'running') {
      setBusy(true);
    } else {
      stream.close();
      activeStream = null;
      setBusy(false);
      if (update.image) {
        const deliver = (src, at = 0) => {
          const seed = update.seeds?.[at] ?? update.seed;
          const archivedId = update.archivedIds?.[at] ?? update.archivedId ?? null;
          const id = addToHistory({
            src,
            seed,
            prompt: settings?.prompt ?? '',
            settings,
            archivedId,
          });
          return { id, seed, archivedId };
        };

        const deliverAll = () => {
          const sources = update.images?.length ? update.images : [update.image];
          const results = sources.map((src, at) => ({ src, ...deliver(src, at) }));
          showImages(results);
        };

        const deliverOne = (src) => {
          const { id, seed, archivedId } = deliver(src);
          showImage(src, seed, { id, archivedId });
        };

        if (overlayBase) {
          compositeInpaintResult(update.image, overlayBase)
            .then(deliverOne)
            .catch((err) => {
              reportError(`The inpaint could not be merged: ${err.message}`);
              deliverOne(update.image);
            });
        } else if (focused) {
          pasteFocusedResult(update.image, focused, focusedBlend)
            .then(deliverOne)
            .catch((err) => {
              reportError(`The inpainted region could not be merged: ${err.message}`);
              deliverOne(update.image);
            });
        } else {
          deliverAll();
        }
      }
      if (update.error) {
        lastParamsKey = null;
        reportError(update.error.message);
      }
    }
  };

  stream.onerror = () => {
    stream.close();
    if (!isCurrent()) return;
    activeStream = null;
    lastParamsKey = null;
    setBusy(false);
  };
}

const historyList = document.getElementById('history-list');

const sessionHistory = [];
const HISTORY_LIMIT = 40;
let historySeq = 0;


function captureSettings() {
  return {
    prompt: document.getElementById('prompt').value,
    undesired: document.getElementById('undesired').value,
    furryMode,
    model: selectedModel,
    width: document.getElementById('width').value,
    height: document.getElementById('height').value,
    steps: document.getElementById('steps').value,
    guidance: document.getElementById('guidance').value,
    sampler: document.getElementById('sampler').value,
    imageCount,
    qualityToggle: document.getElementById('add-quality-tags').checked,
    transparentBg: transparentBg && isV5Model(selectedModel),
    ucPreset: document.getElementById('uc-preset').value,
    img2imgStrength: document.getElementById('img2img-strength').value,
    img2imgNoise: document.getElementById('img2img-noise').value,
    inpaintStrength: document.getElementById('inpaint-strength').value,
    globalAutoPosition,
    characters: characters.map((c) => ({ ...c })),
  };
}

const historyHelp = document.querySelector('.history-help');
const historyHelpTip = document.getElementById('history-help-tip');

const historyRail = document.getElementById('history-rail');
const historyFold = document.getElementById('history-fold');
const historyReopen = document.getElementById('history-reopen');
const historyReopenButton = document.getElementById('history-reopen-button');

if (historyHelp && historyHelpTip) {
  const placeTip = () => {
    const anchor = historyHelp.getBoundingClientRect();
    const tip = historyHelpTip.getBoundingClientRect();
    const margin = 8;
    const anchorCentre = anchor.left + anchor.width / 2;

    const left = Math.min(
      Math.max(margin, anchorCentre - tip.width / 2),
      window.innerWidth - margin - tip.width,
    );
    historyHelpTip.style.left = `${left}px`;
    historyHelpTip.style.top = `${anchor.bottom + 8}px`;

    const inset = 16;
    const arrow = Math.min(Math.max(anchorCentre - left, inset), tip.width - inset);
    historyHelpTip.style.setProperty('--arrow-left', `${arrow}px`);
  };

  const showTip = () => {
    historyHelpTip.hidden = false;
    placeTip();
  };
  const hideTip = () => { historyHelpTip.hidden = true; };

  historyHelp.addEventListener('pointerenter', showTip);
  historyHelp.addEventListener('pointerleave', hideTip);
  historyHelp.addEventListener('focus', showTip);
  historyHelp.addEventListener('blur', hideTip);
  historyHelp.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTip();
  });
  historyHelp.addEventListener('click', (event) => {
    if (event.pointerType === 'touch') {
      if (historyHelpTip.hidden) showTip();
      else hideTip();
    }
  });

  window.addEventListener('resize', () => {
    if (!historyHelpTip.hidden) placeTip();
  });

  historyRail?.addEventListener('nai:collapse', hideTip);
}

function setHistoryCollapsed(collapsed, { focus = false } = {}) {
  if (!historyRail || !historyFold) return;

  historyRail.dataset.collapsed = String(collapsed);
  historyFold.setAttribute('aria-expanded', String(!collapsed));

  if (historyReopen) {
    if (collapsed) {
      historyReopen.dataset.entering = 'true';
      historyReopen.hidden = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { delete historyReopen.dataset.entering; });
      });
    } else {
      historyReopen.hidden = true;
      delete historyReopen.dataset.entering;
    }
  }

  if (focus) {
    const next = collapsed ? historyReopenButton : historyFold;
    next?.focus();
  }

  historyRail.dispatchEvent(new CustomEvent('nai:collapse', { detail: { collapsed } }));
}

historyFold?.addEventListener('click', () => {
  if (document.body.classList.contains('mobile-history-open')) {
    setMobileHistoryOpen(false);
    return;
  }
  setHistoryCollapsed(true, { focus: true });
});
historyReopenButton?.addEventListener('click', () => setHistoryCollapsed(false, { focus: true }));

function recallMode(event) {
  const settings = event.ctrlKey || event.metaKey;
  const seed = event.shiftKey;
  if (settings && seed) return 'both';
  if (settings) return 'settings';
  if (seed) return 'seed';
  return null;
}

function applySettings(settings) {
  if (!settings) return;

  restoreControl('prompt', settings.prompt);
  restoreControl('undesired', settings.undesired);
  restoreControl('width', settings.width);
  restoreControl('height', settings.height);
  restoreControl('steps', settings.steps);
  restoreControl('guidance', settings.guidance);
  restoreControl('sampler', settings.sampler);
  if (Number.isFinite(Number(settings.imageCount))) setImageCount(Number(settings.imageCount));
  restoreControl('add-quality-tags', settings.qualityToggle);
  if (settings.transparentBg !== undefined) {
    transparentBg = Boolean(settings.transparentBg);
    syncTransparentBg();
  }
  restoreControl('uc-preset', settings.ucPreset);
  restoreControl('img2img-strength', settings.img2imgStrength);
  restoreControl('img2img-noise', settings.img2imgNoise);
  restoreControl('inpaint-strength', settings.inpaintStrength);

  for (const id of ['width', 'height']) {
    const input = document.getElementById(id);
    input.dataset.lastValid = input.value;
  }
  applyStepsCeiling();

  if (settings.model && MODELS.some((m) => m.value === settings.model)) {
    selectedModel = settings.model;
    renderModel();
  }

  if (Boolean(settings.furryMode) !== furryMode) datasetToggle?.click();

  characters.length = 0;
  for (const c of settings.characters ?? []) {
    characters.push({ ...c });
  }
  globalAutoPosition = settings.globalAutoPosition !== false;
  positionGlobalToggle.checked = globalAutoPosition;
  focusedCharacter = -1;
  positionTarget = -1;
  renderCharacters();
}

function applySeed(seed) {
  restoreControl('seed', seed ? String(seed) : '');
}

function markCurrent(id) {
  for (const item of historyList?.querySelectorAll('.history-item') ?? []) {
    item.setAttribute('aria-current', String(item.dataset.id === id));
  }
}

function addToHistory({ src, seed, prompt, settings, archivedId = null }) {
  if (!historyList || !src) return null;

  const id = `s${++historySeq}`;
  sessionHistory.unshift({ id, src, seed, prompt, settings, archivedId });
  sessionHistory.length = Math.min(sessionHistory.length, HISTORY_LIMIT);
  renderHistory();
  return id;
}

function renderHistory() {
  if (!historyList) return;

  historyList.replaceChildren();

  for (const image of sessionHistory) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    button.dataset.id = image.id;
    button.title = image.prompt || '(no prompt)';

    const img = document.createElement('img');
    img.className = 'history-item__image';
    img.src = image.src;
    img.alt = image.prompt || 'Generated image';
    img.loading = 'lazy';
    button.append(img);

    button.addEventListener('click', (event) => {
      const mode = recallMode(event);
      if (!mode) {
        showImage(image.src, image.seed, { id: image.id, archivedId: image.archivedId });
        return;
      }

      const settings = image.settings;

      if (mode !== 'seed' && settings) applySettings(settings);
      if (mode !== 'settings') applySeed(image.seed);

      scheduleSave();

    });

    historyList.append(button);
  }
}

function clearCanvas() {
  const canvas = document.querySelector('.canvas');

  const keep = new Set([canvasProgress, quickAction, resultRow]);
  for (const child of [...canvas.children]) {
    if (!keep.has(child)) child.remove();
  }
  return canvas;
}

function showImage(src, seed, { id = null, archivedId = null } = {}) {
  const canvas = clearCanvas();

  const img = document.createElement('img');
  img.className = 'canvas__image';
  img.src = src;
  img.alt = document.getElementById('prompt').value || 'Generated image';
  canvas.append(img);

  markCurrent(id);


  revealResultTools(src, seed, { id, archivedId });
}

function showImages(results) {
  if (results.length <= 1) {
    const only = results[0];
    if (only) showImage(only.src, only.seed, { id: only.id, archivedId: only.archivedId });
    return;
  }

  const canvas = clearCanvas();
  const promptText = document.getElementById('prompt').value || 'Generated image';

  const grid = document.createElement('div');
  grid.className = 'canvas__grid';
  grid.dataset.count = String(results.length);

  const select = (at) => {
    const chosen = results[at];
    for (const [i, cell] of [...grid.children].entries()) {
      cell.setAttribute('aria-current', String(i === at));
    }
    markCurrent(chosen.id);
    revealResultTools(chosen.src, chosen.seed, {
      id: chosen.id,
      archivedId: chosen.archivedId,
    });
  };

  results.forEach((result, at) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'canvas__cell';
    cell.setAttribute('aria-current', String(at === 0));
    cell.setAttribute('aria-label', `Select image ${at + 1} of ${results.length}`);

    const img = document.createElement('img');
    img.className = 'canvas__image';
    img.src = result.src;
    img.alt = `${promptText} (${at + 1} of ${results.length})`;
    cell.append(img);

    cell.addEventListener('click', () => select(at));
    grid.append(cell);
  });

  canvas.append(grid);
  select(0);
}


let currentImage = null;

let currentHistoryId = null;
let currentArchivedId = null;

function revealResultTools(src, seed, { id = null, archivedId = null } = {}) {
  currentImage = src;
  currentHistoryId = id;
  currentArchivedId = archivedId;
  quickAction.hidden = false;
  resultRow.hidden = false;

  const probe = new Image();
  probe.onload = () => {
    resolutionBadgeW.textContent = String(probe.naturalWidth);
    resolutionBadgeH.textContent = String(probe.naturalHeight);
    resolutionBadge.setAttribute(
      'aria-label', `${probe.naturalWidth} by ${probe.naturalHeight} pixels`);
  };
  probe.src = src;

  const known = Number.isInteger(seed) && seed > 0;
  seedBadge.hidden = !known;
  if (known) seedBadgeValue.textContent = String(seed);
}


useAsBaseButton.addEventListener('click', () => {
  if (!currentImage) return;
  acceptBaseImage(currentImage);
  toastSuccess('Image set as base image.');
});

editImageButton.addEventListener('click', async () => {
  if (!currentImage) return;
  acceptBaseImage(currentImage);
  await openDrawEditor();
});

inpaintImageButton.addEventListener('click', async () => {
  if (!currentImage) return;
  acceptBaseImage(currentImage);
  await openMaskEditor();
});


pinImageButton.addEventListener('click', () => {
  const pinned = pinImageButton.getAttribute('aria-pressed') === 'true';
  pinImageButton.setAttribute('aria-pressed', String(!pinned));
  pinImageButton.classList.toggle('result-tool--active', !pinned);
});


expandImageButton.addEventListener('click', () => {
  if (!currentImage) return;
  window.open(currentImage, '_blank', 'noopener');
});

copyClipboardButton.addEventListener('click', async () => {
  if (!currentImage) return;
  try {
    const blob = await (await fetch(currentImage)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    toastSuccess('Image copied to clipboard.');
  } catch {
    toastError('Could not copy the image to the clipboard.');
  }
});

downloadImageButton.addEventListener('click', () => {
  if (!currentImage) return;
  const link = document.createElement('a');
  link.href = currentImage;
  const seed = seedBadgeValue.textContent;
  link.download = `nai-${seed && seed !== '0' ? seed : Date.now()}.png`;
  link.click();
});

seedBadge.addEventListener('click', () => {
  const seed = seedBadgeValue.textContent;
  if (!seed || seed === '0') return;
  restoreControl('seed', seed);
  toastSuccess(`Seed ${seed} copied to the seed field.`);
});

function reportError(message) {
  console.error(message);
  toastError(message, { autoClose: false });
}

let lastParamsKey = null;

function identicalToLastGeneration(params) {
  if (!Number.isInteger(params.seed) || params.seed <= 0) return false;
  return JSON.stringify(params) === lastParamsKey;
}

generateButton.addEventListener('click', async () => {
  generateButton.classList.add('generate-button--pressed');
  await new Promise((r) => setTimeout(r, 150));
  setBusy(true);

  const params = readParams();
  const settings = captureSettings();
  if (identicalToLastGeneration(params)) {
    setBusy(false);
    toastInfo(
      'Identical parameters to last generation. You may want to change or remove the image seed.',
    );
    return;
  }

  if (!params.prompt?.trim()) {
    setBusy(false);
    toastError('Enter a prompt first - describe the image you want.');
    promptField.focus();
    return;
  }

  if (!inpaint) {
    const pending = vibes.filter((v) => v.enabled && needsEncoding(v));

    if (pending.length > 0) {
      const cost = pending.length * ANLAS_PER_ENCODE;
      toastInfo(
        `Encoding ${pending.length} vibe${pending.length === 1 ? '' : 's'} (${cost} Anlas)…`,
      );
      try {
        for (const vibe of pending) {
          await encodeVibe(vibe.id);
          if (!vibe.encoding) throw new Error('encoding did not complete');
        }
      } catch {
        setBusy(false);
        return;
      }
      Object.assign(params, { vibes: readParams().vibes });
    }
  }

  try {
    const res = await apiFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    let body = {};
    try {
      body = await res.text().then((t) => (t ? JSON.parse(t) : {}));
    } catch {
      setBusy(false);
      const hint = {
        413: ' The request was too large for the web server (nginx client_max_body_size).',
        502: ' The web server could not reach TarotNAI - check the app is running.',
        503: ' The web server could not reach TarotNAI - check the app is running.',
        504: ' TarotNAI took too long to answer (nginx proxy_read_timeout).',
      }[res.status] ?? '';
      if (!res.ok) {
        reportError(
          `Generation failed: ${res.status} ${res.statusText || 'error'} from the web `
          + `server, not from TarotNAI.${hint}`,
        );
        return;
      }
      reportError('The server sent a response this page could not read.');
      return;
    }

    if (!res.ok) {
      setBusy(false);
      if (body.error === 'not_authenticated') {
        onUnauthenticated();
        return;
      }
      reportError(body.message ?? 'Generation failed.');
      return;
    }

    lastParamsKey = JSON.stringify(params);
    watchJob(
      body.jobId,
      settings,
      inpaint?.focused ?? null,
      inpaint && !inpaint.focused && inpaint.blend
        ? { base: baseImage, blend: inpaint.blend }
        : null,
      inpaint?.focused ? inpaint.blend ?? null : null,
    );
  } catch (err) {
    setBusy(false);
    if (err.code === 'not_authenticated') return;
    reportError(`Could not reach the server: ${err.message}`);
  }
});


import { loadState, loadImages, clearState, clearImages, createSaver } from './persist.js';

let imagesDirty = false;

let restoring = false;

function collectDraft() {
  const text = {
    prompt: document.getElementById('prompt').value,
    savedPrompt,
    undesired: document.getElementById('undesired').value,
    furryMode,
    model: selectedModel,
    width: document.getElementById('width').value,
    height: document.getElementById('height').value,
    steps: document.getElementById('steps').value,
    guidance: document.getElementById('guidance').value,
    seed: document.getElementById('seed').value,
    sampler: document.getElementById('sampler').value,
    imageCount,
    qualityToggle: document.getElementById('add-quality-tags').checked,
    transparentBg: transparentBg && isV5Model(selectedModel),
    ucPreset: document.getElementById('uc-preset').value,
    disableTagSuggestions: document.getElementById('disable-tag-suggestions').checked,
    highlightEmphasis: document.getElementById('highlight-emphasis').checked,
    opusAlwaysShow: document.getElementById('opus-always-show').checked,
    promptStacked,
    img2imgStrength: document.getElementById('img2img-strength').value,
    img2imgNoise: document.getElementById('img2img-noise').value,
    inpaintStrength: document.getElementById('inpaint-strength').value,
    contextArea: document.getElementById('context-area').value,
    penSizeByMode: { ...penSizeByMode },
    globalAutoPosition,
    characters: characters.map((c) => ({ ...c })),
    chunks: chunks.map((c) => ({ ...c })),
    chunkCategories: chunkCategories.map((c) => ({ ...c })),
    normalizeVibes: vibeNormalize.checked,
    exportAsEncoding,
    vibes: vibes.map((v) => ({
      id: v.id,
      name: v.name,
      strength: v.strength,
      informationExtracted: v.informationExtracted,
      enabled: v.enabled,
      imported: v.imported,
      encodedModel: v.encodedModel ?? null,
    })),
  };

  let images;
  if (imagesDirty) {
    imagesDirty = false;
    images = {};
    if (vibes.length) {
      images.vibes = vibes.map((v) => ({
        id: v.id,
        image: v.image,
        encoding: v.encoding,
      }));
    }
  }

  return { text, images };
}

const saveDraft = createSaver(collectDraft);

function scheduleSave({ images = false } = {}) {
  if (restoring) return;
  if (images) imagesDirty = true;
  saveDraft();
}

function restoreControl(id, value) {
  if (value === undefined || value === null) return;
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else el.value = String(value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

async function restoreDraft() {
  const saved = loadState();
  restoring = true;
  try {
    if (saved) {
      restoreControl('prompt', saved.prompt);
      savedPrompt = saved.savedPrompt ?? null;
      syncRandomPrompt();
      restoreControl('undesired', saved.undesired);
      restoreControl('width', saved.width);
      restoreControl('height', saved.height);
      restoreControl('steps', saved.steps);
      restoreControl('guidance', saved.guidance);
      restoreControl('seed', saved.seed);
      restoreControl('sampler', saved.sampler);
      if (Number.isFinite(Number(saved.imageCount))) setImageCount(Number(saved.imageCount));
      restoreControl('add-quality-tags', saved.qualityToggle);
      if (saved.transparentBg !== undefined) {
        transparentBg = Boolean(saved.transparentBg);
        syncTransparentBg();
      }
      restoreControl('uc-preset', saved.ucPreset);
      restoreControl('disable-tag-suggestions', saved.disableTagSuggestions);
      restoreControl('highlight-emphasis', saved.highlightEmphasis);
      restoreControl('opus-always-show', saved.opusAlwaysShow);
      renderOpusUsage();
      restoreControl('img2img-strength', saved.img2imgStrength);
      restoreControl('img2img-noise', saved.img2imgNoise);
      restoreControl('inpaint-strength', saved.inpaintStrength);
      if (saved.contextArea !== undefined) syncContextArea(saved.contextArea);
      if (saved.penSizeByMode) {
        for (const mode of ['mask', 'draw']) {
          const n = Number(saved.penSizeByMode[mode]);
          if (Number.isFinite(n)) penSizeByMode[mode] = n;
        }
      }

      for (const id of ['width', 'height']) {
        const input = document.getElementById(id);
        input.dataset.lastValid = input.value;
      }

      applyStepsCeiling();

      if (saved.model && MODELS.some((m) => m.value === saved.model)) {
        selectedModel = saved.model;
        renderModel();
      }

      if (saved.furryMode) {
        furryMode = true;
        datasetToggle?.setAttribute('aria-pressed', 'true');
        datasetToggle?.setAttribute('aria-label', 'Switch to anime mode');
        if (datasetToggle) datasetToggle.title = 'Furry mode';
      }

      if (saved.promptStacked) setPromptStacked(true, { focusButton: false });

      if (Array.isArray(saved.chunkCategories)) {
        for (const c of saved.chunkCategories) {
          if (!c || typeof c !== 'object' || typeof c.name !== 'string') continue;
          chunkCategories.push({
            id: String(c.id ?? `cat-${chunkCategories.length + 1}`),
            name: c.name,
            color: typeof c.color === 'string' ? c.color : CHUNK_DEFAULT_COLOR,
          });
        }
      }
      if (Array.isArray(saved.chunks)) {
        for (const c of saved.chunks) {
          if (!c || typeof c !== 'object' || typeof c.name !== 'string') continue;
          chunks.push({
            id: String(c.id ?? `chunk-${chunks.length + 1}`),
            name: c.name,
            content: typeof c.content === 'string' ? c.content : '',
            category: typeof c.category === 'string' ? c.category : '',
            color: typeof c.color === 'string' ? c.color : CHUNK_DEFAULT_COLOR,
          });
        }
      }
      for (const entry of [...chunks, ...chunkCategories]) {
        const n = Number(String(entry.id).replace(/^(chunk|cat)-/, ''));
        if (Number.isFinite(n) && n > chunkSeq) chunkSeq = n;
      }
      renderChunks();

      if (Array.isArray(saved.characters)) {
        for (const c of saved.characters.slice(0, MAX_CHARACTERS)) {
          if (!c || typeof c !== 'object') continue;
          characters.push({
            gender: GENDER_SEED[c.gender] !== undefined ? c.gender : 'other',
            prompt: typeof c.prompt === 'string' ? c.prompt : '',
            uc: typeof c.uc === 'string' ? c.uc : '',
            position: typeof c.position === 'string' ? c.position : '',
            tab: c.tab === 'uc' ? 'uc' : 'prompt',
            enabled: c.enabled !== false,
          });
        }
        globalAutoPosition = saved.globalAutoPosition !== false;
        positionGlobalToggle.checked = globalAutoPosition;
        focusedCharacter = -1;
        renderCharacters();
      }
    }

    const images = await loadImages();

    if (Array.isArray(saved?.vibes)) {
      vibeNormalize.checked = saved.normalizeVibes !== false;
      exportAsEncoding = saved.exportAsEncoding === true;
      vibeFlyout.querySelector('[data-vibe-action="export-as-encoding"]')
        ?.setAttribute('aria-checked', String(exportAsEncoding));
      const heavy = new Map(
        (Array.isArray(images?.vibes) ? images.vibes : []).map((v) => [v.id, v]),
      );
      for (const v of saved.vibes.slice(0, MAX_VIBES)) {
        if (!v || typeof v !== 'object') continue;
        const stored = heavy.get(v.id) ?? {};
        if (!stored.image && !stored.encoding) continue;
        vibes.push({
          id: v.id,
          name: typeof v.name === 'string' ? v.name : vibeName(stored.encoding ?? stored.image),
          image: stored.image ?? null,
          encoding: stored.encoding ?? null,
          strength: Number.isFinite(Number(v.strength))
            ? Number(v.strength) : DEFAULT_REFERENCE_STRENGTH,
          informationExtracted: Number.isFinite(Number(v.informationExtracted))
            ? Number(v.informationExtracted) : DEFAULT_INFORMATION_EXTRACTED,
          enabled: v.enabled !== false,
          imported: Boolean(v.imported),
          encodedModel: typeof v.encodedModel === 'string' ? v.encodedModel : undefined,
          encoding_: false,
        });
        const n = Number(String(v.id).replace(/^vibe-/, ''));
        if (Number.isFinite(n) && n > vibeSeq) vibeSeq = n;
      }
      renderVibes();
      if (inpaint) setMaskState(true);
    }

  } catch (err) {
    reportError?.(`Could not fully restore your last session: ${err.message}`);
  } finally {
    restoring = false;
    penSizeReady = true;
    imageCountReady = true;
  }
}

for (const id of [
  'prompt', 'undesired', 'width', 'height', 'steps', 'guidance', 'seed',
  'sampler', 'add-quality-tags', 'uc-preset',
  'disable-tag-suggestions', 'highlight-emphasis', 'opus-always-show',
  'img2img-strength', 'img2img-noise', 'inpaint-strength',
  'steps-range', 'guidance-range',
]) {
  const el = document.getElementById(id);
  el?.addEventListener('input', () => scheduleSave());
  el?.addEventListener('change', () => scheduleSave());
}

datasetToggle?.addEventListener('click', () => scheduleSave());
modelCombo?.addEventListener('click', () => scheduleSave());
resolution?.addEventListener('click', () => scheduleSave());
positionGlobalToggle?.addEventListener('change', () => scheduleSave());

window.addEventListener('pagehide', () => saveDraft.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveDraft.flush();
});

restoreDraft();

document.addEventListener('click', (event) => {
  if (event.target.closest('a[href="/auth/logout"]')) {
    clearState();
    clearImages();
  }
});

const loginGate = document.getElementById('login-gate');
const loginGateNote = document.getElementById('login-gate-note');

let sessionEnded = false;
let authMode = 'open';

function showLoginGate(note) {
  if (!loginGate) return;
  loginGate.hidden = false;

  const button = document.getElementById('login-gate-button');
  if (button && authMode !== 'oauth') {
    button.textContent = 'Sign in';
    button.href = '/';
  }

  if (note && loginGateNote) {
    loginGateNote.textContent = note;
    loginGateNote.hidden = false;
  }
}

function hideLoginGate() {
  if (loginGate) loginGate.hidden = true;
}

const keyGate = document.getElementById('key-gate');
const keyGateForm = document.getElementById('key-gate-form');
const keyGateInput = document.getElementById('key-gate-input');
const keyGateNote = document.getElementById('key-gate-note');
const keyGateSubmit = document.getElementById('key-gate-submit');

function setKeyGateNote(text, invalid = false) {
  if (!keyGateNote) return;
  keyGateNote.textContent = text ?? '';
  keyGateNote.hidden = !text;
  keyGate?.classList.toggle('key-gate--invalid', invalid);
}

// There is deliberately no way to dismiss this. Without a key the app cannot
// generate, so letting it be closed would just put the user back in front of a
// UI where every button fails.
function showKeyGate(canSave) {
  if (!keyGate) return;
  keyGate.hidden = false;

  if (!canSave) {
    if (keyGateForm) keyGateForm.hidden = true;
    setKeyGateNote(
      'This server is reachable from the network with no sign-in, so it will not accept ' +
        'a key over HTTP. Set NAI_KEY in .env and restart.',
      true,
    );
    return;
  }

  keyGateInput?.focus();
}

keyGateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const key = keyGateInput?.value.trim() ?? '';
  if (!key) {
    setKeyGateNote('Paste your key first.', true);
    keyGateInput?.focus();
    return;
  }

  keyGateSubmit.disabled = true;
  setKeyGateNote('Checking that key with NovelAI...');

  // NovelAI's subscription endpoint is slow when it is cold, often around ten
  // seconds on the first call, which this always is. Say so rather than leaving
  // the first message sitting there looking stuck.
  const slowNotice = setTimeout(() => {
    setKeyGateNote('Still checking. NovelAI is slow to answer the first request.');
  }, 3000);

  let res;
  let body = {};
  try {
    res = await fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    body = await res.json().catch(() => ({}));
  } catch {
    clearTimeout(slowNotice);
    keyGateSubmit.disabled = false;
    setKeyGateNote('Could not reach the server. Try again.', true);
    return;
  }

  clearTimeout(slowNotice);

  if (!res.ok) {
    keyGateSubmit.disabled = false;
    setKeyGateNote(body.message ?? 'That key was not accepted.', true);
    keyGateInput?.select();
    return;
  }

  if (keyGateInput) keyGateInput.value = '';
  keyGate.hidden = true;
  keyGate.classList.remove('key-gate--invalid');
  keyGateSubmit.disabled = false;
  setKeyGateNote('');

  applyStepsCeiling();
  applyAccountBalance(body.balance ?? null);
});

async function checkSession() {
  let body;
  try {
    const res = await fetch('/api/me');
    body = await res.json();
  } catch {
    showLoginGate('Could not reach the server. Reload to try again.');
    return;
  }

  authMode = body.authMode ?? 'open';

  if (!body.user) {
    showLoginGate(
      authMode === 'oauth' && !body.authConfigured
        ? 'Discord login is not configured on this server yet.'
        : null,
    );
    return;
  }

  hideLoginGate();
  document.body.dataset.signedIn = 'true';

  if (authMode === 'open') {
    const logout = document.getElementById('menu-logout');
    if (logout) logout.hidden = true;
  }

  applyStepsCeiling();
  applyAccountBalance(body.balance);
  showMenuProfile(body.user);

  // Last, so the app behind the gate is fully set up and is ready to use the
  // moment a key is accepted.
  if (!body.hasKey) showKeyGate(body.canSaveKey);
}

checkSession();

const mainMenu = document.getElementById('main-menu');
const menuButton = document.getElementById('menu');

function showMenuProfile(user) {
  const menuUsername = document.getElementById('menu-username');
  const menuAvatar = document.getElementById('menu-avatar');
  if (!menuUsername) return;
  menuUsername.textContent = user.username;
  if (user.avatar && user.discordId && menuAvatar) {
    menuAvatar.src =
      `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=128`;
    menuAvatar.alt = '';
  }
}

const setMenuOpen = (open) => {
  mainMenu.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
};

menuButton?.addEventListener('click', (event) => {
  event.stopPropagation();
  setMenuOpen(!mainMenu.classList.contains('is-open'));
});

document.addEventListener('click', (event) => {
  if (!mainMenu.classList.contains('is-open')) return;
  if (mainMenu.contains(event.target)) return;
  setMenuOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (appSettings && !appSettings.hidden) return;
  if (!mainMenu.classList.contains('is-open')) return;
  setMenuOpen(false);
  menuButton.focus();
});

const appSettings = document.getElementById('app-settings');
const appSettingsClose = document.getElementById('app-settings-close');
const appSettingsBackdrop = document.getElementById('app-settings-backdrop');
const accountSettingsButton = document.getElementById('menu-account-settings');

function setSettingsOpen(open) {
  if (!appSettings) return;
  appSettings.hidden = !open;
  if (open) {
    appSettingsClose?.focus();
  } else {
    accountSettingsButton?.focus();
  }
}

if (accountSettingsButton) accountSettingsButton.disabled = false;

accountSettingsButton?.addEventListener('click', () => {
  setMenuOpen(false);
  setSettingsOpen(true);
});

appSettingsClose?.addEventListener('click', () => setSettingsOpen(false));
appSettingsBackdrop?.addEventListener('click', () => setSettingsOpen(false));

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!appSettings || appSettings.hidden) return;
  setSettingsOpen(false);
});

export function onUnauthenticated() {
  if (sessionEnded) return;
  sessionEnded = true;
  delete document.body.dataset.signedIn;
  showLoginGate('Your session ended. Sign in again to continue.');
}

export async function apiFetch(input, init) {
  const res = await fetch(input, init);
  if (res.status === 401) {
    onUnauthenticated();
    const err = new Error('not_authenticated');
    err.code = 'not_authenticated';
    throw err;
  }
  return res;
}


const dropOverlay = document.getElementById('drop-overlay');

let dragDepth = 0;

function dragHasFiles(event) {
  return [...(event.dataTransfer?.types ?? [])].includes('Files');
}

function showDropOverlay() {
  dropOverlay.hidden = false;
}

function hideDropOverlay() {
  dragDepth = 0;
  dropOverlay.hidden = true;
}

window.addEventListener('dragenter', (event) => {
  if (!dragHasFiles(event)) return;
  dragDepth += 1;
  showDropOverlay();
});

window.addEventListener('dragleave', (event) => {
  if (!dragHasFiles(event)) return;
  dragDepth -= 1;
  if (dragDepth <= 0) hideDropOverlay();
});

window.addEventListener('dragover', (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
});

window.addEventListener('drop', (event) => {
  if (!dragHasFiles(event)) return;
  event.preventDefault();
  hideDropOverlay();

  const files = [...(event.dataTransfer?.files ?? [])];
  if (files.length === 0) return;

  const bundles = files.filter((file) => /\.naiv4vibe(bundle)?$/i.test(file.name));
  if (bundles.length > 0) {
    importDroppedBundles(bundles);
    return;
  }

  const [first, ...rest] = files;
  openIntentForFile(first);
  if (rest.length > 0) {
    toastInfo(`Took ${first.name}; drop one image at a time to use the others.`);
  }
});

async function importDroppedBundles(bundles) {
  let imported = 0;
  let overflowed = false;

  for (const file of bundles) {
    const room = MAX_VIBES - vibes.length;
    if (room <= 0) {
      overflowed = true;
      break;
    }
    try {
      const { added, offered } = await importVibeBundle(file, room);
      imported += added;
      if (offered > added) overflowed = true;
    } catch (err) {
      reportError(err.message);
    }
  }

  if (imported > 0) {
    toastSuccess(`Imported ${imported} vibe${imported === 1 ? '' : 's'} - no Anlas spent.`);
  }
  if (overflowed) toastInfo(`Only ${MAX_VIBES} vibes fit; the rest were skipped.`);
}

const settingsPanel = document.getElementById('settings-panel');
const trayHandle = document.getElementById('tray-handle');
const trayHandleIcon = document.getElementById('tray-handle-icon');

const mobileSettingsToggle = document.getElementById('mobile-settings-toggle');
const mobileHistoryToggle = document.getElementById('mobile-history-toggle');

function setTrayOpen(open) {
  if (!settingsPanel || !trayHandle) return;

  settingsPanel.dataset.tray = open ? 'open' : 'closed';
  trayHandle.setAttribute('aria-expanded', String(open));
  trayHandle.setAttribute('aria-label', open ? 'Close settings' : 'Open settings');

  trayHandleIcon?.classList.toggle('icon-arrow-up', !open);
  trayHandleIcon?.classList.toggle('icon-arrow-down', open);

  if (!open) document.body.classList.remove('mobile-settings-open');
  if (!open) mobileSettingsToggle?.setAttribute('aria-expanded', 'false');
}

trayHandle?.addEventListener('click', () => {
  setTrayOpen(settingsPanel?.dataset.tray !== 'open');
});


setTrayOpen(false);

const aiSettings = document.querySelector('.panel-footer .ai-settings');
const aiSettingsHome = aiSettings?.nextElementSibling ?? null;
const panelScroll = settingsPanel?.querySelector('.panel-scroll');

function setMobileSettingsOpen(open) {
  document.body.classList.toggle('mobile-settings-open', open);
  mobileSettingsToggle?.setAttribute('aria-expanded', String(open));

  if (aiSettings && panelScroll) {
    if (open) {
      panelScroll.append(aiSettings);
    } else if (aiSettings.parentElement !== settingsPanel?.querySelector('.panel-footer')) {
      const footer = settingsPanel?.querySelector('.panel-footer');
      if (aiSettingsHome && aiSettingsHome.parentElement === footer) {
        footer.insertBefore(aiSettings, aiSettingsHome);
      } else {
        footer?.append(aiSettings);
      }
    }
  }

  if (open) {
    setTrayOpen(true);
    document.body.classList.remove('mobile-history-open');
    mobileHistoryToggle?.setAttribute('aria-expanded', 'false');
  }
}

mobileSettingsToggle?.addEventListener('click', () => {
  if (document.body.classList.contains('mobile-settings-open')) {
    setTrayOpen(false);
  } else {
    setMobileSettingsOpen(true);
  }
});

function setMobileHistoryOpen(open) {
  document.body.classList.toggle('mobile-history-open', open);
  mobileHistoryToggle?.setAttribute('aria-expanded', String(open));
  if (open) setTrayOpen(false);
}

mobileHistoryToggle?.addEventListener('click', () => {
  setMobileHistoryOpen(!document.body.classList.contains('mobile-history-open'));
});
