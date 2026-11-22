(function () {
  'use strict';

  const M = window.DrowpalMotion;
  if (!M) return;

  const VECTOR_SCALE = 6;
  const MIN_SIZE = 0.02;
  const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const percent = (value, digits = 1) => `${value.toFixed(digits)}%`;
  const signed = (positive, negative) => (value) => {
    if (Math.abs(value) < 0.05) return '0';
    return value > 0 ? `${positive} ${percent(value)}` : `${negative} ${percent(-value)}`;
  };
  const FIELDS = [
    { key: 'moveY', label: '上下に動く', min: -4, max: 4, step: 0.1, toUi: (v) => -v * 100, fromUi: (v) => -v / 100, format: signed('上', '下') },
    { key: 'moveX', label: '左右に動く', min: -4, max: 4, step: 0.1, toUi: (v) => v * 100, fromUi: (v) => v / 100, format: signed('右', '左') },
    { key: 'scaleX', label: '横に膨らむ', min: -5, max: 5, step: 0.1, toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => percent(v) },
    { key: 'scaleY', label: '縦に伸びる', min: -5, max: 5, step: 0.1, toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => percent(v) },
    { key: 'rotate', label: '傾き', min: -4, max: 4, step: 0.05, toUi: (v) => v, fromUi: (v) => v, format: (v) => `${v.toFixed(2)}°` },
    { key: 'falloff', label: 'まわりへのなじみ', min: 0, max: 30, step: 1, toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => percent(v, 0) },
    { key: 'speed', label: '速さ倍率', min: 0.5, max: 2, step: 0.05, toUi: (v) => v, fromUi: (v) => v, format: (v) => `×${v.toFixed(2)}` },
    { key: 'phase', label: '遅れ', min: 0, max: 50, step: 1, toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => percent(v, 0) },
    { key: 'priority', label: '優先度', min: 0.2, max: 3, step: 0.1, toUi: (v) => v, fromUi: (v) => v, format: (v) => v.toFixed(1) }
  ];
  const GLOBALS = {
    bpm: { toUi: (v) => v, fromUi: (v) => v, format: (v) => `${v}回/分` },
    strength: { toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => `${Math.round(v)}%` },
    smoothness: { toUi: (v) => v * 100, fromUi: (v) => v / 100, format: (v) => `${Math.round(v)}%` }
  };

  let ui = null;
  let session = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const selected = () => session?.config.regions.find((region) => region.id === session.selectedId) || null;
  const aspect = () => session.image.naturalWidth / session.image.naturalHeight;

  function setup() {
    const dialog = document.getElementById('motion-editor');
    if (!dialog) return null;
    const elements = {
      dialog,
      stage: document.getElementById('motion-editor-stage'),
      canvas: document.getElementById('motion-editor-canvas'),
      overlay: document.getElementById('motion-editor-overlay'),
      list: document.getElementById('motion-region-list'),
      fields: document.getElementById('motion-editor-fields'),
      empty: document.getElementById('motion-editor-empty'),
      scrub: document.getElementById('motion-editor-scrub'),
      scrubLabel: dialog.querySelector('.motion-editor-scrub'),
      importInput: document.getElementById('motion-editor-import'),
      playButton: dialog.querySelector('[data-motion-action="play"]'),
      compareButton: dialog.querySelector('[data-motion-action="compare"]'),
      inputs: {}
    };
    elements.renderer = M.createRenderer(elements.canvas, { contentScale: 0.92 });
    if (!elements.renderer) return null;
    buildFields(elements);
    bindEvents(elements);
    new ResizeObserver(() => layoutOverlay()).observe(elements.stage);
    return elements;
  }

  function buildFields(elements) {
    const { fields, inputs } = elements;
    const nameLabel = document.createElement('label');
    nameLabel.textContent = '名前';
    inputs.name = Object.assign(document.createElement('input'), { type: 'text', maxLength: 12 });
    nameLabel.append(inputs.name);
    const partLabel = document.createElement('label');
    partLabel.textContent = '部位';
    inputs.part = document.createElement('select');
    M.PARTS.forEach((part) => inputs.part.append(new Option(part.label, part.id)));
    partLabel.append(inputs.part);
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'motion-field-check';
    inputs.enabled = Object.assign(document.createElement('input'), { type: 'checkbox' });
    enabledLabel.append(inputs.enabled, ' この範囲を動かす');
    const partHelp = document.createElement('p');
    partHelp.className = 'small';
    partHelp.textContent = '部位を変えると、その部位らしい呼吸の動きに置き換わります。';
    fields.append(nameLabel, partLabel, partHelp, enabledLabel);
    for (const field of FIELDS) {
      const label = document.createElement('label');
      label.className = 'motion-field-range';
      const title = document.createElement('span');
      title.textContent = field.label;
      const input = Object.assign(document.createElement('input'), {
        type: 'range', min: field.min, max: field.max, step: field.step
      });
      const output = document.createElement('output');
      label.append(title, output, input);
      fields.append(label);
      inputs[field.key] = { input, output, field };
    }
    const remove = Object.assign(document.createElement('button'), {
      type: 'button', className: 'danger-button motion-field-remove', textContent: 'この範囲を削除'
    });
    remove.dataset.motionAction = 'remove';
    fields.append(remove);
  }

  function bindEvents(elements) {
    const { dialog, overlay, inputs, list, scrub, importInput } = elements;
    dialog.addEventListener('click', (event) => {
      const action = event.target.closest('[data-motion-action]')?.dataset.motionAction;
      if (action) runAction(action);
    });
    dialog.addEventListener('close', () => {
      elements.renderer.stop();
      session = null;
    });
    inputs.name.addEventListener('input', () => updateSelected({ name: inputs.name.value || '範囲' }, false));
    inputs.part.addEventListener('change', () => {
      const part = inputs.part.value;
      const region = selected();
      const keepName = region && region.name !== M.PART_NAMES[region.part];
      updateSelected({ part, ...M.BREATH_PRESETS[part], ...(keepName ? {} : { name: M.PART_NAMES[part] }) });
    });
    inputs.enabled.addEventListener('change', () => updateSelected({ enabled: inputs.enabled.checked }));
    for (const { input, field } of FIELDS.map((item) => inputs[item.key])) {
      input.addEventListener('input', () => updateSelected({ [field.key]: field.fromUi(Number(input.value)) }));
    }
    dialog.querySelectorAll('[data-motion-global]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.motionGlobal;
        session.config[key] = GLOBALS[key].fromUi(Number(input.value));
        session.config = M.normalizeConfig(session.config);
        syncGlobals();
        pushConfig();
      });
    });
    scrub.addEventListener('input', () => elements.renderer.setAmount(Number(scrub.value) / 100));
    list.addEventListener('click', (event) => {
      const item = event.target.closest('[data-id]');
      if (!item) return;
      if (event.target.closest('[data-list-toggle]')) return;
      select(item.dataset.id);
    });
    list.addEventListener('change', (event) => {
      const toggle = event.target.closest('[data-list-toggle]');
      if (!toggle) return;
      const region = session.config.regions.find((item) => item.id === toggle.closest('[data-id]').dataset.id);
      if (region) region.enabled = toggle.checked;
      refresh();
    });
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.regions)) throw new Error('呼吸モーションのJSONではありません。');
        session.config = M.normalizeConfig({ ...data, imageKey: session.config.imageKey });
        session.selectedId = session.config.regions[0]?.id || null;
        syncGlobals();
        refresh();
      } catch (error) {
        alert(error.message || 'JSONを読み込めませんでした。');
      }
    });

    overlay.addEventListener('pointerdown', onPointerDown);
    overlay.addEventListener('pointermove', onPointerMove);
    overlay.addEventListener('pointerup', onPointerUp);
    overlay.addEventListener('pointercancel', onPointerUp);
    overlay.addEventListener('keydown', onKeyDown);
  }

  function runAction(action) {
    if (!session) return;
    const { renderer } = ui;
    if (action === 'cancel') {
      ui.dialog.close();
    } else if (action === 'save') {
      session.onSave?.(M.normalizeConfig(session.config));
      ui.dialog.close();
    } else if (action === 'add') {
      addRegion({ x: 0.4, y: 0.4, w: 0.2, h: 0.1 });
    } else if (action === 'remove') {
      session.config.regions = session.config.regions.filter((region) => region.id !== session.selectedId);
      session.selectedId = null;
      refresh();
    } else if (action === 'play') {
      setPlaying(!renderer.playing);
    } else if (action === 'compare') {
      session.compare = !session.compare;
      ui.compareButton.setAttribute('aria-pressed', String(session.compare));
      ui.compareButton.textContent = session.compare ? '動きを表示' : '元画像と比較';
      renderer.setBypass(session.compare);
    } else if (action === 'breath') {
      if (!confirm('各範囲の動きを、部位に合わせた呼吸の動きで作り直します。よろしいですか？')) return;
      session.config = M.applyBreathing(session.config);
      refresh();
    } else if (action === 'detect') {
      if (!confirm('画像から範囲を検出し直します。いまの範囲は置き換わります。よろしいですか？')) return;
      session.config = M.applyBreathing({ ...session.config, regions: M.detectRegions(session.image) });
      session.selectedId = null;
      refresh();
    } else if (action === 'export') {
      const { imageKey, ...data } = M.normalizeConfig(session.config);
      const blob = new Blob([JSON.stringify({ type: 'drowpal-pal-motion', ...data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: 'drowpal-pal-motion.json' });
      link.click();
      URL.revokeObjectURL(url);
    }
  }

  function setPlaying(playing) {
    const { renderer, playButton, scrub, scrubLabel } = ui;
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.textContent = playing ? '⏸ 停止' : '▶ 再生';
    scrubLabel.hidden = playing;
    ui.overlay.classList.toggle('is-playing', playing);
    if (playing) {
      renderer.setAmount(null);
      renderer.play();
    } else {
      renderer.stop();
      renderer.setAmount(Number(scrub.value) / 100);
    }
  }

  function addRegion(rect) {
    if (session.config.regions.length >= M.MAX_REGIONS) {
      alert(`範囲は${M.MAX_REGIONS}個まで作れます。`);
      return null;
    }
    const region = M.normalizeRegion({ part: 'other', name: '範囲', ...M.BREATH_PRESETS.other, ...rect });
    session.config.regions.push(region);
    session.selectedId = region.id;
    refresh();
    return region;
  }

  function updateSelected(changes, redrawList = true) {
    const region = selected();
    if (!region) return;
    Object.assign(region, M.normalizeRegion({ ...region, ...changes }));
    if (redrawList) refresh();
    else {
      renderList();
      renderOverlay();
    }
  }

  function select(id) {
    session.selectedId = id;
    refresh();
  }

  function pushConfig() {
    ui.renderer.setConfig(session.config);
  }

  function refresh() {
    pushConfig();
    renderList();
    renderOverlay();
    renderFields();
  }

  function syncGlobals() {
    ui.dialog.querySelectorAll('[data-motion-global]').forEach((input) => {
      const key = input.dataset.motionGlobal;
      const value = GLOBALS[key].toUi(session.config[key]);
      input.value = String(value);
      ui.dialog.querySelector(`[data-motion-output="${key}"]`).textContent = GLOBALS[key].format(value);
    });
  }

  function renderList() {
    ui.list.replaceChildren(...session.config.regions.map((region) => {
      const item = document.createElement('li');
      item.dataset.id = region.id;
      item.dataset.part = region.part;
      item.classList.toggle('is-selected', region.id === session.selectedId);
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'motion-list-select' });
      const name = Object.assign(document.createElement('strong'), { textContent: region.name });
      const part = Object.assign(document.createElement('small'), {
        textContent: M.PARTS.find((entry) => entry.id === region.part)?.label || ''
      });
      button.append(name, part);
      const toggle = Object.assign(document.createElement('input'), { type: 'checkbox', checked: region.enabled, title: '動かす' });
      toggle.dataset.listToggle = '';
      toggle.setAttribute('aria-label', `${region.name}を動かす`);
      item.append(toggle, button);
      return item;
    }));
  }

  function renderFields() {
    const region = selected();
    ui.fields.hidden = !region;
    ui.empty.hidden = Boolean(region);
    if (!region) return;
    const { inputs } = ui;
    if (document.activeElement !== inputs.name) inputs.name.value = region.name;
    inputs.part.value = region.part;
    inputs.enabled.checked = region.enabled;
    for (const field of FIELDS) {
      const value = field.toUi(region[field.key]);
      inputs[field.key].input.value = String(value);
      inputs[field.key].output.textContent = field.format(value);
    }
  }

  function layoutOverlay() {
    if (!session || !ui) return;
    const { stage, overlay } = ui;
    const box = M.fitRect(stage.clientWidth, stage.clientHeight, session.image.naturalWidth, session.image.naturalHeight, 0.92);
    Object.assign(overlay.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
  }

  function renderOverlay() {
    const { overlay } = ui;
    const focusedId = document.activeElement?.closest?.('.motion-region')?.dataset.id;
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('motion-vectors');
    const nodes = [svg];
    for (const region of session.config.regions) {
      const isSelected = region.id === session.selectedId;
      const el = document.createElement('div');
      el.className = 'motion-region';
      el.dataset.id = region.id;
      el.dataset.part = region.part;
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${region.name}の範囲。矢印キーで移動、Deleteで削除`);
      el.classList.toggle('is-selected', isSelected);
      el.classList.toggle('is-disabled', !region.enabled);
      Object.assign(el.style, {
        left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%`
      });
      el.append(Object.assign(document.createElement('span'), { className: 'motion-region-label', textContent: region.name }));
      if (isSelected) {
        for (const handle of HANDLES) {
          const node = document.createElement('span');
          node.className = 'motion-handle';
          node.dataset.handle = handle;
          el.append(node);
        }
      }
      nodes.push(el);

      const cx = (region.x + region.w / 2) * 100;
      const cy = (region.y + region.h / 2) * 100;
      const vx = cx + (region.moveX * VECTOR_SCALE * 100) / aspect();
      const vy = cy + region.moveY * VECTOR_SCALE * 100;
      const line = document.createElementNS(svgNs, 'line');
      Object.entries({ x1: cx, y1: cy, x2: vx, y2: vy }).forEach(([key, value]) => line.setAttribute(key, value));
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.classList.toggle('is-selected', isSelected);
      svg.append(line);
      if (isSelected) {
        const vector = document.createElement('span');
        vector.className = 'motion-vector';
        vector.dataset.vector = region.id;
        vector.title = '引っぱって動く向きと量を決める';
        Object.assign(vector.style, { left: `${vx}%`, top: `${vy}%` });
        const origin = document.createElement('span');
        origin.className = 'motion-vector-origin';
        Object.assign(origin.style, { left: `${cx}%`, top: `${cy}%` });
        nodes.push(origin, vector);
      }
    }
    overlay.replaceChildren(...nodes);
    if (focusedId) overlay.querySelector(`.motion-region[data-id="${focusedId}"]`)?.focus();
  }

  const pointerToNorm = (event) => {
    const bounds = ui.overlay.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1)
    };
  };

  function onPointerDown(event) {
    if (!session || event.button !== 0) return;
    const point = pointerToNorm(event);
    const vector = event.target.closest('[data-vector]');
    const handle = event.target.closest('[data-handle]');
    const regionEl = event.target.closest('.motion-region');
    if (vector) {
      session.drag = { type: 'vector' };
    } else if (handle) {
      session.drag = { type: 'resize', dir: handle.dataset.handle, start: point, orig: { ...selected() } };
    } else if (regionEl) {
      if (session.selectedId !== regionEl.dataset.id) select(regionEl.dataset.id);
      session.drag = { type: 'move', start: point, orig: { ...selected() } };
    } else {
      session.drag = { type: 'create', start: point, created: false };
    }
    session.drag.pointerId = event.pointerId;
    ui.overlay.setPointerCapture(event.pointerId);
    ui.overlay.classList.add('is-dragging');
    event.preventDefault();
  }

  function onPointerMove(event) {
    const drag = session?.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointerToNorm(event);
    if (drag.type === 'vector') {
      const region = selected();
      const cx = region.x + region.w / 2;
      const cy = region.y + region.h / 2;
      updateSelected({
        moveX: ((point.x - cx) * aspect()) / VECTOR_SCALE,
        moveY: (point.y - cy) / VECTOR_SCALE
      }, false);
      renderFields();
      pushConfig();
      return;
    }
    if (drag.type === 'create') {
      const width = Math.abs(point.x - drag.start.x);
      const height = Math.abs(point.y - drag.start.y);
      if (!drag.created && Math.max(width, height) < 0.015) return;
      const rect = {
        x: Math.min(point.x, drag.start.x),
        y: Math.min(point.y, drag.start.y),
        w: Math.max(MIN_SIZE, width),
        h: Math.max(MIN_SIZE, height)
      };
      if (!drag.created) {
        drag.created = Boolean(addRegion(rect));
        if (!drag.created) session.drag = null;
        return;
      }
      updateSelected(rect, false);
      pushConfig();
      return;
    }
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const { orig } = drag;
    let { x, y, w, h } = orig;
    if (drag.type === 'move') {
      x = clamp(orig.x + dx, 0, 1 - orig.w);
      y = clamp(orig.y + dy, 0, 1 - orig.h);
    } else {
      if (drag.dir.includes('w')) {
        x = clamp(orig.x + dx, 0, orig.x + orig.w - MIN_SIZE);
        w = orig.x + orig.w - x;
      }
      if (drag.dir.includes('e')) w = clamp(orig.w + dx, MIN_SIZE, 1 - orig.x);
      if (drag.dir.includes('n')) {
        y = clamp(orig.y + dy, 0, orig.y + orig.h - MIN_SIZE);
        h = orig.y + orig.h - y;
      }
      if (drag.dir.includes('s')) h = clamp(orig.h + dy, MIN_SIZE, 1 - orig.y);
    }
    updateSelected({ x, y, w, h }, false);
    pushConfig();
  }

  function onPointerUp(event) {
    const drag = session?.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    session.drag = null;
    ui.overlay.classList.remove('is-dragging');
    if (drag.type === 'create' && !drag.created) select(null);
    else refresh();
  }

  function onKeyDown(event) {
    const regionEl = event.target.closest('.motion-region');
    if (!regionEl || !session) return;
    if (session.selectedId !== regionEl.dataset.id) select(regionEl.dataset.id);
    const region = selected();
    const step = event.shiftKey ? 0.02 : 0.005;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      updateSelected({
        x: clamp(region.x + moves[event.key][0], 0, 1 - region.w),
        y: clamp(region.y + moves[event.key][1], 0, 1 - region.h)
      });
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      runAction('remove');
    }
  }

  async function open({ imageUrl, config, onSave }) {
    ui = ui || setup();
    if (!ui) {
      alert('この端末ではWebGLが使えないため、詳細な調整画面を開けません。');
      return false;
    }
    const image = new Image();
    image.src = imageUrl;
    await image.decode();
    session = {
      image,
      config: M.normalizeConfig(config),
      selectedId: null,
      compare: false,
      drag: null,
      onSave
    };
    if (!session.config.regions.length) {
      session.config = M.applyBreathing({ ...session.config, regions: M.detectRegions(image) });
    }
    session.selectedId = session.config.regions[0]?.id || null;
    ui.renderer.setBypass(false);
    ui.compareButton.setAttribute('aria-pressed', 'false');
    ui.compareButton.textContent = '元画像と比較';
    ui.dialog.showModal();
    ui.renderer.setImage(image);
    syncGlobals();
    refresh();
    layoutOverlay();
    setPlaying(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    return true;
  }

  window.DrowpalMotionEditor = { open };
})();
