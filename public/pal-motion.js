(function (root) {
  'use strict';

  const PARTS = [
    { id: 'head', label: '頭' },
    { id: 'hair', label: '髪' },
    { id: 'neck', label: '首' },
    { id: 'shoulderL', label: '左肩（画面の左）' },
    { id: 'shoulderR', label: '右肩（画面の右）' },
    { id: 'chest', label: '胸' },
    { id: 'other', label: 'その他' }
  ];
  const PART_NAMES = {
    head: '頭',
    hair: '髪',
    neck: '首',
    shoulderL: '左肩',
    shoulderR: '右肩',
    chest: '胸',
    other: '範囲'
  };

  // Movement values are fractions of the image height; scale values are deltas (0.01 = +1%).
  const BREATH_PRESETS = {
    shoulderL: { moveX: 0, moveY: -0.011, scaleX: 0, scaleY: 0, rotate: 0.25, falloff: 0.08, speed: 1, phase: 0, priority: 1.2 },
    shoulderR: { moveX: 0, moveY: -0.011, scaleX: 0, scaleY: 0, rotate: -0.25, falloff: 0.08, speed: 1, phase: 0, priority: 1.2 },
    chest: { moveX: 0, moveY: -0.006, scaleX: 0.014, scaleY: 0.01, rotate: 0, falloff: 0.1, speed: 1, phase: 0.01, priority: 1 },
    neck: { moveX: 0, moveY: -0.008, scaleX: 0, scaleY: 0, rotate: 0, falloff: 0.05, speed: 1, phase: 0.04, priority: 0.8 },
    head: { moveX: 0, moveY: -0.008, scaleX: 0, scaleY: 0, rotate: 0.35, falloff: 0.06, speed: 1, phase: 0.07, priority: 1 },
    hair: { moveX: 0, moveY: -0.007, scaleX: 0.004, scaleY: 0.008, rotate: 0, falloff: 0.08, speed: 1, phase: 0.15, priority: 0.6 },
    other: { moveX: 0, moveY: -0.005, scaleX: 0, scaleY: 0, rotate: 0, falloff: 0.06, speed: 1, phase: 0, priority: 1 }
  };

  const LIMITS = {
    x: [0, 0.99], y: [0, 0.99], w: [0.01, 1], h: [0.01, 1],
    moveX: [-0.04, 0.04], moveY: [-0.04, 0.04],
    scaleX: [-0.06, 0.06], scaleY: [-0.06, 0.06],
    rotate: [-5, 5], falloff: [0, 0.3], speed: [0.25, 3], phase: [0, 1], priority: [0.1, 3]
  };
  const MAX_REGIONS = 12;
  const MAX_DISPLACEMENT = 0.05;
  const GRID = 32;
  const DEFAULTS = { bpm: 16, strength: 1, smoothness: 1 };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const num = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const makeId = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const smoothstep = (edge0, edge1, x) => {
    if (edge1 <= edge0) return x < edge0 ? 0 : 1;
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function normalizeRegion(raw = {}) {
    const part = PARTS.some((item) => item.id === raw.part) ? raw.part : 'other';
    const preset = BREATH_PRESETS[part];
    const region = {
      id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : makeId(),
      name: String(raw.name ?? PART_NAMES[part]).slice(0, 12) || PART_NAMES[part],
      part,
      enabled: raw.enabled !== false
    };
    for (const key of Object.keys(LIMITS)) {
      const fallback = key in preset ? preset[key] : { x: 0.4, y: 0.4, w: 0.2, h: 0.1 }[key];
      region[key] = clamp(num(raw[key], fallback), LIMITS[key][0], LIMITS[key][1]);
    }
    region.w = Math.min(region.w, 1 - region.x) || 0.01;
    region.h = Math.min(region.h, 1 - region.y) || 0.01;
    return region;
  }

  function normalizeConfig(raw = {}) {
    const regions = Array.isArray(raw.regions) ? raw.regions.slice(0, MAX_REGIONS).map(normalizeRegion) : [];
    return {
      version: 1,
      enabled: raw.enabled !== false,
      imageKey: typeof raw.imageKey === 'string' ? raw.imageKey : '',
      bpm: clamp(num(raw.bpm, DEFAULTS.bpm), 6, 40),
      strength: clamp(num(raw.strength, DEFAULTS.strength), 0, 2.5),
      smoothness: clamp(num(raw.smoothness, DEFAULTS.smoothness), 0.3, 2.5),
      regions
    };
  }

  function applyBreathing(config) {
    return normalizeConfig({
      ...config,
      regions: config.regions.map((region) => ({ ...region, ...BREATH_PRESETS[region.part] }))
    });
  }

  function readAlphaRows(source) {
    const iw = source.naturalWidth || source.width;
    const ih = source.naturalHeight || source.height;
    if (!iw || !ih) return null;
    const scale = Math.min(1, 180 / Math.max(iw, ih));
    const w = Math.max(8, Math.round(iw * scale));
    const h = Math.max(8, Math.round(ih * scale));
    let data;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(source, 0, 0, w, h);
      data = context.getImageData(0, 0, w, h).data;
    } catch (error) {
      return null;
    }
    const rows = [];
    const skin = [];
    let opaque = 0;
    for (let y = 0; y < h; y += 1) {
      let left = -1;
      let right = -1;
      let skinCount = 0;
      let skinLeft = -1;
      let skinRight = -1;
      for (let x = 0; x < w; x += 1) {
        const k = (y * w + x) * 4;
        const [r, g, b, alpha] = [data[k], data[k + 1], data[k + 2], data[k + 3]];
        if (alpha > 250) opaque += 1;
        if (alpha > 48) {
          if (left < 0) left = x;
          right = x;
        }
        // Light, warm skin tones typical of illustrations; gray/blue hair and clothes are excluded.
        if (alpha > 200 && r > 170 && r >= g && g >= b - 8 && r - b >= 18 && r - b <= 100 && r - g <= 70) {
          skinCount += 1;
          if (skinLeft < 0) skinLeft = x;
          skinRight = x;
        }
      }
      rows.push(left < 0 ? null : { left, right, width: right - left + 1 });
      skin.push({ count: skinCount, left: skinLeft, right: skinRight });
    }
    if (opaque > w * h * 0.97) return null;
    return { w, h, rows, skin };
  }

  // Uses the largest skin-colored block in the upper body as the face.
  function detectFace(alpha, top, figH) {
    const { w, skin } = alpha;
    const end = Math.min(skin.length - 1, top + Math.round(figH * 0.6));
    let peak = -1;
    for (let y = top; y <= end; y += 1) {
      if (peak < 0 || skin[y].count > skin[peak].count) peak = y;
    }
    if (peak < 0 || skin[peak].count < Math.max(3, w * 0.03)) return null;
    const threshold = skin[peak].count * 0.25;
    const maxGap = Math.max(2, Math.round(figH * 0.02));
    const expand = (direction) => {
      let edge = peak;
      let gap = 0;
      for (let y = peak + direction; y >= top && y <= end; y += direction) {
        if (skin[y].count >= threshold) {
          edge = y;
          gap = 0;
        } else if (++gap > maxGap) {
          break;
        }
      }
      return edge;
    };
    const faceTop = expand(-1);
    const chin = expand(1);
    const lefts = [];
    const rights = [];
    for (let y = faceTop; y <= chin; y += 1) {
      if (skin[y].count >= threshold) {
        lefts.push(skin[y].left);
        rights.push(skin[y].right);
      }
    }
    const median = (values) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const left = median(lefts);
    const right = median(rights) + 1;
    const faceW = right - left;
    const figW = Math.max(...alpha.rows.filter(Boolean).map((row) => row.width));
    if (chin - faceTop < figH * 0.04 || faceW < figW * 0.08 || faceW > figW * 0.8) return null;
    return { cx: (left + right) / 2, faceW, chin };
  }

  // Finds head, neck and shoulder lines from a transparent PNG (face color first, silhouette as fallback).
  function detectLayout(source) {
    const alpha = readAlphaRows(source);
    if (!alpha || !alpha.rows.some(Boolean)) return null;
    const { w, h, rows } = alpha;
    const top = rows.findIndex(Boolean);
    let bottom = rows.length - 1;
    while (bottom > top && !rows[bottom]) bottom -= 1;
    const figH = bottom - top + 1;
    if (figH < 8) return null;
    const rowAt = (y) => rows[clamp(Math.round(y), top, bottom)] || null;

    let cx;
    let headW;
    let chin;
    let neckW;
    const face = detectFace(alpha, top, figH);
    if (face) {
      cx = face.cx;
      headW = face.faceW * 1.3;
      chin = face.chin;
      neckW = face.faceW * 0.45;
    } else {
      const widths = rows.map((row) => (row ? row.width : 0));
      let runMax = 0;
      chin = -1;
      for (let y = top; y <= top + figH * 0.6 && chin < 0; y += 1) {
        runMax = Math.max(runMax, widths[y]);
        if (y < top + figH * 0.06 || widths[y] >= runMax * 0.82) continue;
        for (let k = y; k <= Math.min(bottom, y + figH * 0.16); k += 1) {
          if (widths[k] > widths[y] * 1.35) {
            chin = y;
            break;
          }
        }
      }
      if (chin < 0) chin = Math.round(top + figH * (figH / Math.max(1, ...widths) > 2.2 ? 0.17 : 0.3));
      let centerSum = 0;
      let centerCount = 0;
      headW = 0;
      for (let y = top; y < chin; y += 1) {
        if (!rows[y]) continue;
        headW = Math.max(headW, rows[y].width);
        centerSum += (rows[y].left + rows[y].right) / 2;
        centerCount += 1;
      }
      cx = centerCount ? centerSum / centerCount : w / 2;
      headW *= 0.8;
      neckW = Math.max(widths[chin] || 0, headW * 0.3) * 0.6;
    }
    const headH = Math.max(chin - top, figH * 0.08);
    const shoulderY = chin + headH * 0.25;
    const shoulderRow = rowAt(shoulderY + headH * 0.12) || { left: cx - headW, right: cx + headW };
    const hairRow = rowAt(top + headH * 0.7) || { left: cx - headW / 2, right: cx + headW / 2 };
    const maxShoulder = headW * 1.1;
    return {
      top: top / h,
      cx: cx / w,
      headW: headW / w,
      headH: headH / h,
      chin: chin / h,
      neckW: neckW / w,
      shoulderY: shoulderY / h,
      shoulderL: Math.max(shoulderRow.left, cx - maxShoulder) / w,
      shoulderR: Math.min(shoulderRow.right + 1, cx + maxShoulder) / w,
      hairL: hairRow.left / w,
      hairR: (hairRow.right + 1) / w
    };
  }

  function fallbackLayout() {
    return {
      top: 0.08, cx: 0.5, headW: 0.3, headH: 0.26, chin: 0.34, neckW: 0.1,
      shoulderY: 0.4, shoulderL: 0.2, shoulderR: 0.8, hairL: 0.3, hairR: 0.7
    };
  }

  function rect(part, x0, y0, x1, y1) {
    const left = clamp(Math.min(x0, x1), 0, 0.99);
    const topY = clamp(Math.min(y0, y1), 0, 0.99);
    return normalizeRegion({
      part,
      name: PART_NAMES[part],
      x: left,
      y: topY,
      w: Math.max(0.02, clamp(Math.max(x0, x1), 0, 1) - left),
      h: Math.max(0.02, clamp(Math.max(y0, y1), 0, 1) - topY)
    });
  }

  function detectRegions(source) {
    const layout = detectLayout(source) || fallbackLayout();
    const { top, cx, headW, headH, chin, neckW, shoulderY, shoulderL, shoulderR } = layout;
    const neckHalf = Math.max(neckW / 2, 0.015);
    const band = Math.max(0.025, headH * 0.22);
    const chestHalf = Math.max(neckHalf * 2, (shoulderR - shoulderL) * 0.32);
    return [
      rect('hair', Math.min(layout.hairL, cx - headW * 0.55), top + headH * 0.1, Math.max(layout.hairR, cx + headW * 0.55), chin + headH * 0.3),
      rect('head', cx - headW * 0.45, top, cx + headW * 0.45, chin),
      rect('neck', cx - neckHalf, chin - headH * 0.04, cx + neckHalf, shoulderY),
      rect('shoulderL', shoulderL, shoulderY - band * 0.4, cx - neckHalf * 1.3, shoulderY + band),
      rect('shoulderR', cx + neckHalf * 1.3, shoulderY - band * 0.4, shoulderR, shoulderY + band),
      rect('chest', cx - chestHalf, shoulderY + band, cx + chestHalf, shoulderY + band + headH * 0.65)
    ];
  }
  function createAutoConfig(source, options = {}) {
    return applyBreathing(normalizeConfig({ ...DEFAULTS, ...options, regions: detectRegions(source) }));
  }

  // Asymmetric breath curve: quick inhale (40%), slower exhale.
  function breathCurve(cycle) {
    const x = cycle - Math.floor(cycle);
    const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);
    return x < 0.4 ? ease(x / 0.4) : 1 - ease((x - 0.4) / 0.6);
  }

  function createMesh(aspect, grid = GRID) {
    const count = (grid + 1) * (grid + 1);
    const uv = new Float32Array(count * 2);
    const indices = new Uint16Array(grid * grid * 6);
    for (let y = 0; y <= grid; y += 1) {
      for (let x = 0; x <= grid; x += 1) {
        const i = y * (grid + 1) + x;
        uv[i * 2] = x / grid;
        uv[i * 2 + 1] = y / grid;
      }
    }
    let n = 0;
    for (let y = 0; y < grid; y += 1) {
      for (let x = 0; x < grid; x += 1) {
        const a = y * (grid + 1) + x;
        const b = a + 1;
        const c = a + grid + 1;
        const d = c + 1;
        indices.set([a, b, c, b, d, c], n);
        n += 6;
      }
    }
    return { aspect, count, uv, indices, positions: new Float32Array(uv), weights: [], regions: [] };
  }

  // Precomputes per-vertex influence. Inside a rectangle weight is 1; outside it fades with smoothstep.
  function prepareMesh(mesh, config) {
    const { aspect, count, uv } = mesh;
    const regions = (config?.regions || []).filter((region) => region.enabled);
    mesh.regions = regions;
    mesh.weights = regions.map((region) => {
      const weights = new Float32Array(count);
      const hw = (region.w * aspect) / 2;
      const hh = region.h / 2;
      const cx = (region.x + region.w / 2) * aspect;
      const cy = region.y + region.h / 2;
      const falloff = region.falloff * (config.smoothness || 1);
      for (let i = 0; i < count; i += 1) {
        const dx = Math.max(Math.abs(uv[i * 2] * aspect - cx) - hw, 0);
        const dy = Math.max(Math.abs(uv[i * 2 + 1] - cy) - hh, 0);
        weights[i] = 1 - smoothstep(0, falloff, Math.hypot(dx, dy));
      }
      return weights;
    });
    return mesh;
  }

  // Writes deformed UV positions into mesh.positions. `amount` overrides time-based breath (0..1).
  function deformMesh(mesh, config, time, amount = null) {
    const { aspect, count, uv, positions, regions, weights } = mesh;
    const strength = config?.strength ?? 1;
    const cycleSeconds = 60 / (config?.bpm || DEFAULTS.bpm);
    const transforms = regions.map((region) => {
      const s = (amount ?? breathCurve((time / cycleSeconds) * region.speed - region.phase)) * strength;
      const angle = (region.rotate * s * Math.PI) / 180;
      return {
        cx: (region.x + region.w / 2) * aspect,
        cy: region.y + region.h / 2,
        tx: region.moveX * s,
        ty: region.moveY * s,
        sx: 1 + region.scaleX * s,
        sy: 1 + region.scaleY * s,
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        priority: region.priority
      };
    });
    for (let i = 0; i < count; i += 1) {
      const px = uv[i * 2] * aspect;
      const py = uv[i * 2 + 1];
      let sumX = 0;
      let sumY = 0;
      let total = 0;
      for (let r = 0; r < transforms.length; r += 1) {
        const weight = weights[r][i];
        if (weight <= 0) continue;
        const t = transforms[r];
        const lx = (px - t.cx) * t.sx;
        const ly = (py - t.cy) * t.sy;
        const factor = weight * t.priority;
        sumX += factor * (t.cx + lx * t.cos - ly * t.sin + t.tx - px);
        sumY += factor * (t.cy + lx * t.sin + ly * t.cos + t.ty - py);
        total += factor;
      }
      if (total > 1) {
        sumX /= total;
        sumY /= total;
      }
      const length = Math.hypot(sumX, sumY);
      if (length > MAX_DISPLACEMENT) {
        sumX *= MAX_DISPLACEMENT / length;
        sumY *= MAX_DISPLACEMENT / length;
      }
      positions[i * 2] = (px + sumX) / aspect;
      positions[i * 2 + 1] = py + sumY;
    }
    return positions;
  }

  function fitRect(width, height, imageWidth, imageHeight, contentScale = 1, alignX = 0.5, alignY = 0.5, mode = 'contain') {
    const areaW = width * contentScale;
    const areaH = height * contentScale;
    const scale = mode === 'cover'
      ? Math.max(areaW / imageWidth, areaH / imageHeight)
      : Math.min(areaW / imageWidth, areaH / imageHeight);
    const w = imageWidth * scale;
    const h = imageHeight * scale;
    return {
      x: (width - areaW) / 2 + (areaW - w) * alignX,
      y: (height - areaH) / 2 + (areaH - h) * alignY,
      w,
      h
    };
  }

  const VERTEX_SHADER = `
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    uniform vec4 u_rect;
    varying vec2 v_uv;
    void main() {
      v_uv = a_uv;
      gl_Position = vec4(u_rect.x + a_pos.x * u_rect.z, u_rect.y - a_pos.y * u_rect.w, 0.0, 1.0);
    }`;
  const FRAGMENT_SHADER = `
    precision mediump float;
    uniform sampler2D u_texture;
    varying vec2 v_uv;
    void main() {
      gl_FragColor = texture2D(u_texture, v_uv);
    }`;

  function isSupported() {
    try {
      const canvas = document.createElement('canvas');
      return Boolean(canvas.getContext('webgl'));
    } catch (error) {
      return false;
    }
  }

  function createRenderer(canvas, options = {}) {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
    const posLocation = gl.getAttribLocation(program, 'a_pos');
    const uvLocation = gl.getAttribLocation(program, 'a_uv');
    const rectLocation = gl.getUniformLocation(program, 'u_rect');
    const posBuffer = gl.createBuffer();
    const uvBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const texture = gl.createTexture();
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let mesh = null;
    let config = null;
    let imageSize = null;
    let playing = false;
    let frame = 0;
    let lastTime = 0;
    let clock = 0;
    let amount = null;
    let bypass = false;
    let pixelScale = 1;
    let visible = true;
    let lost = false;
    const contentScale = options.contentScale ?? 1;
    const getAlign = options.getAlign || (() => [0.5, 0.5]);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(dpr * pixelScale, 4);
      const width = Math.max(1, Math.min(4096, Math.round(canvas.clientWidth * scale)));
      const height = Math.max(1, Math.min(4096, Math.round(canvas.clientHeight * scale)));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const draw = () => {
      if (lost) return;
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!mesh || !imageSize) return;
      if (bypass || !config) {
        mesh.positions.set(mesh.uv);
      } else {
        deformMesh(mesh, config, clock, amount);
      }
      const [alignX, alignY] = getAlign();
      const objectFit = getComputedStyle(canvas).objectFit;
      const box = fitRect(canvas.width, canvas.height, imageSize.w, imageSize.h, contentScale, alignX, alignY, objectFit);
      gl.uniform4f(
        rectLocation,
        (box.x / canvas.width) * 2 - 1,
        1 - (box.y / canvas.height) * 2,
        (box.w / canvas.width) * 2,
        (box.h / canvas.height) * 2
      );
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(posLocation);
      gl.vertexAttribPointer(posLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    };

    const tick = (now) => {
      frame = 0;
      if (!playing || !visible) return;
      clock += Math.min(0.1, (now - (lastTime || now)) / 1000);
      lastTime = now;
      draw();
      frame = requestAnimationFrame(tick);
    };
    const schedule = () => {
      if (playing && visible && !frame && !lost) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
    resizeObserver?.observe(canvas);
    const onVisibility = () => {
      visible = !document.hidden;
      schedule();
    };
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      lost = true;
      options.onContextLost?.();
    });

    return {
      canvas,
      setImage(source) {
        let width = source.naturalWidth || source.width;
        let height = source.naturalHeight || source.height;
        if (!width || !height) return false;
        const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 2048);
        let upload = source;
        if (Math.max(width, height) > maxSize) {
          const ratio = maxSize / Math.max(width, height);
          const scaled = document.createElement('canvas');
          scaled.width = Math.round(width * ratio);
          scaled.height = Math.round(height * ratio);
          scaled.getContext('2d').drawImage(source, 0, 0, scaled.width, scaled.height);
          upload = scaled;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        imageSize = { w: width, h: height };
        mesh = createMesh(width / height);
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.uv, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
        if (config) prepareMesh(mesh, config);
        draw();
        return true;
      },
      setConfig(next) {
        config = next ? normalizeConfig(next) : null;
        if (mesh && config) prepareMesh(mesh, config);
        draw();
      },
      setAmount(value) {
        amount = value === null ? null : clamp(Number(value), 0, 1);
        draw();
      },
      setBypass(value) {
        bypass = Boolean(value);
        draw();
      },
      setPixelScale(value) {
        pixelScale = clamp(Number(value) || 1, 0.5, 3);
        draw();
      },
      setVisible(value) {
        visible = Boolean(value) && !document.hidden;
        schedule();
      },
      play() {
        playing = true;
        schedule();
      },
      stop() {
        playing = false;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        draw();
      },
      get playing() {
        return playing;
      },
      get imageSize() {
        return imageSize;
      },
      draw,
      destroy() {
        this.stop();
        resizeObserver?.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }

  // Mounts a WebGL canvas next to the sidebar <img>; the <img> stays as the fallback.
  function mountStage({ stage, image, onImageLoad }) {
    if (!isSupported()) return null;
    const canvas = document.createElement('canvas');
    canvas.className = 'character-image character-motion-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    image.after(canvas);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let ready = false;
    let config = null;
    let renderer;
    const update = () => {
      const active = Boolean(renderer && ready && config?.enabled && config.regions.length && !reducedMotion.matches);
      stage.classList.toggle('has-motion', active);
      if (active) renderer.play();
      else renderer?.stop();
    };
    try {
      renderer = createRenderer(canvas, {
        contentScale: 1 / 1.1,
        getAlign: () => {
          const [x = '50%', y = '50%'] = getComputedStyle(image).objectPosition.split(' ');
          const toRatio = (value) => (value.endsWith('%') ? parseFloat(value) / 100 : 0.5);
          return [toRatio(x), toRatio(y)];
        },
        onContextLost: () => {
          ready = false;
          stage.classList.remove('has-motion');
        }
      });
    } catch (error) {
      console.warn('[PalMotion] WebGLを初期化できませんでした。', error);
    }
    if (!renderer) {
      canvas.remove();
      return null;
    }
    const loadImage = () => {
      if (!image.complete || !image.naturalWidth) return;
      ready = renderer.setImage(image);
      onImageLoad?.();
      update();
    };
    image.addEventListener('load', loadImage);
    loadImage();
    reducedMotion.addEventListener?.('change', update);
    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver((entries) => renderer.setVisible(entries.some((entry) => entry.isIntersecting))).observe(stage);
    }
    return {
      canvas,
      renderer,
      setConfig(next) {
        config = next ? normalizeConfig(next) : null;
        renderer.setConfig(config);
        update();
      },
      setViewScale(scale) {
        renderer.setPixelScale(scale);
      }
    };
  }

  const api = {
    PARTS,
    PART_NAMES,
    BREATH_PRESETS,
    LIMITS,
    MAX_REGIONS,
    DEFAULTS,
    normalizeRegion,
    normalizeConfig,
    applyBreathing,
    detectLayout,
    detectRegions,
    createAutoConfig,
    breathCurve,
    createMesh,
    prepareMesh,
    deformMesh,
    fitRect,
    isSupported,
    createRenderer,
    mountStage
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.DrowpalMotion = api;
})(typeof window !== 'undefined' ? window : globalThis);
