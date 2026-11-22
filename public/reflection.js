document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reflection-form');
  if (!form) return;

  const defaults = ['構図', '表現', 'ストーリー', '頑張り'];
  const person = ['ポーズ', '顔', '表情', '手', '足', '体バランス', '衣装'];
  const landscape = ['パース・遠近感', '光と影', '色彩・配色', '質感表現', '空気感・奥行き'];
  const presets = ['根気強く描けた', '妥協して描いた', '正しく描けた', '資料を見て描けた', '資料を見ずに描いた', '好みに描けた', '好みの絵にならなかった', '集中できなかった', '時間をかけられた'];
  const items = document.getElementById('evaluation-items');
  const addButton = document.getElementById('add-evaluation');
  const dateInput = form.elements.reflectionDate;
  const illustrationSelect = form.elements.illustrationId;
  const overallScore = form.elements.score;
  const evaluationDataInput = form.querySelector('input[name="evaluationData"]') || document.getElementById('evaluation-data');
  const reflectionView = form.closest('[data-view="reflection"]');
  const mobilePreview = document.getElementById('reflection-image-mobile');
  const mobileTitle = document.getElementById('reflection-image-mobile-title');
  const mobileImage = document.getElementById('reflection-image-mobile-img');
  const mobileToggle = document.getElementById('reflection-image-mobile-toggle');
  const desktopPreview = document.getElementById('reflection-image-desktop');
  const desktopTitle = document.getElementById('reflection-image-desktop-title');
  const desktopImage = document.getElementById('reflection-image-desktop-img');
  const desktopClose = document.getElementById('reflection-image-desktop-close');
  const desktopReopen = document.getElementById('reflection-image-desktop-reopen');
  const imageDialog = document.getElementById('reflection-image-dialog');
  const dialogTitle = document.getElementById('reflection-image-dialog-title');
  const dialogImage = document.getElementById('reflection-image-dialog-img');
  const dialogCanvas = document.getElementById('reflection-image-dialog-canvas');
  const zoomSlider = document.getElementById('reflection-image-zoom');
  const zoomOutput = document.getElementById('reflection-image-zoom-value');
  let selectedImage = '';
  let selectedTitle = '';
  let desktopPreviewClosed = false;
  let imageScale = 1;
  let imageX = 0;
  let imageY = 0;
  let pointerDistance = 0;
  const activePointers = new Map();

  function syncImagePreviews() {
    const active = reflectionView?.classList.contains('is-active');
    const hasImage = Boolean(selectedImage);
    [mobileImage, desktopImage, dialogImage].forEach((image) => {
      if (!image) return;
      if (hasImage) {
        image.src = selectedImage;
      } else {
        image.removeAttribute('src');
      }
      image.alt = selectedTitle;
    });
    if (mobileTitle) mobileTitle.textContent = selectedTitle;
    if (desktopTitle) desktopTitle.textContent = selectedTitle;
    if (dialogTitle) dialogTitle.textContent = selectedTitle || '選択中のイラスト';
    if (mobilePreview) mobilePreview.hidden = !hasImage;
    if (desktopPreview) desktopPreview.hidden = !(active && hasImage) || desktopPreviewClosed;
    if (desktopReopen) desktopReopen.hidden = !(active && hasImage) || !desktopPreviewClosed;
  }

  function selectIllustration() {
    const selected = illustrationSelect?.selectedOptions[0];
    selectedImage = selected?.dataset.imageSrc || '';
    selectedTitle = selected?.textContent?.trim().replace(/^.*?・/, '') || '';
    desktopPreviewClosed = false;
    syncImagePreviews();
    if (selected?.dataset.date && dateInput) dateInput.value = selected.dataset.date;
  }

  function updateImageTransform() {
    if (!dialogCanvas) return;
    dialogCanvas.style.setProperty('--reflection-image-scale', String(imageScale));
    dialogCanvas.style.setProperty('--reflection-image-x', `${imageX}px`);
    dialogCanvas.style.setProperty('--reflection-image-y', `${imageY}px`);
    if (zoomSlider) zoomSlider.value = String(Math.round(imageScale * 100));
    if (zoomOutput) zoomOutput.value = `${Math.round(imageScale * 100)}%`;
  }

  function resetImageZoom() {
    imageScale = 1;
    imageX = 0;
    imageY = 0;
    updateImageTransform();
  }

  function setImageScale(nextScale) {
    const next = Math.min(5, Math.max(0.5, nextScale));
    if (next <= 1) {
      imageX = 0;
      imageY = 0;
    }
    imageScale = next;
    updateImageTransform();
  }

  function openImageDialog() {
    resetImageZoom();
    imageDialog?.showModal();
    dialogCanvas?.focus();
  }

  function syncEvaluationData() {
    if (!items || !evaluationDataInput) return;
    const evaluations = [...items.querySelectorAll('.evaluation-item')].map((item) => ({
      name: (item.querySelector('.evaluation-name')?.value || '').trim(),
      score: Number(item.querySelector('.item-score')?.dataset.score || 3),
      reason: (item.querySelector('.evaluation-reason')?.value || '').trim(),
      presets: [...item.querySelectorAll('.reason-presets input:checked')].map((input) => input.value)
    })).filter((item) => item.name);
    evaluationDataInput.value = JSON.stringify(evaluations);
  }

  function scoreButtons(container, score) {
    return [1, 2, 3, 4, 5].map((value) => `<button type="button" class="score-dot ${value <= score ? 'is-selected' : ''}" data-score="${value}" aria-label="${value}点" aria-pressed="${value <= score}">${value <= score ? '★' : '☆'}</button>`).join('');
  }

  function addItem(name = '', type = 'custom', evaluation = null) {
    const entry = document.createElement('fieldset');
    entry.className = 'evaluation-item';
    entry.dataset.type = type;
    entry.innerHTML = `
      <div class="evaluation-item-header"><button type="button" class="evaluation-toggle" aria-label="開閉">▼</button><input type="text" class="evaluation-name" value="${name}" maxlength="7" required /><button type="button" class="secondary remove-evaluation">削除</button></div>
      <div class="evaluation-body">
        <div class="score-picker item-score" data-score="${evaluation?.score || 3}">${scoreButtons(null, evaluation?.score || 3)}</div>
        <label>評価理由<textarea class="evaluation-reason" rows="2">${evaluation?.reason || ''}</textarea></label>
        <div class="reason-presets">${presets.map((preset) => `<label><input type="checkbox" value="${preset}" ${evaluation?.presets?.includes(preset) ? 'checked' : ''} /> ${preset}</label>`).join('')}</div>
      </div>`;
    items.append(entry);
    if (type === 'default' && items.querySelectorAll('.evaluation-item').length > 1 && window.innerWidth <= 700) {
      entry.classList.add('is-collapsed');
      entry.querySelector('.evaluation-toggle').textContent = '▶';
    }
    syncEvaluationData();
  }

  function syncTypeItems(type, names) {
    const checked = form.querySelector(`[data-type="${type}"]`)?.checked;
    if (checked) {
      names.forEach((name) => {
        if (![...items.querySelectorAll('.evaluation-item')].some((item) => item.dataset.type === type && item.querySelector('.evaluation-name').value === name)) addItem(name, type);
      });
    } else {
      items.querySelectorAll(`.evaluation-item[data-type="${type}"]`).forEach((item) => item.remove());
    }
    syncEvaluationData();
  }

  const draft = window.reflectionDraft;
  if (draft?.evaluations?.length) {
    draft.evaluations.forEach((evaluation) => {
      const type = person.includes(evaluation.name) ? 'person' : (landscape.includes(evaluation.name) ? 'landscape' : (defaults.includes(evaluation.name) ? 'default' : 'custom'));
      addItem(evaluation.name, type, evaluation);
    });
    const personCb = form.querySelector('[data-type="person"]');
    if (personCb) personCb.checked = draft.evaluations.some((evaluation) => person.includes(evaluation.name));
    const landscapeCb = form.querySelector('[data-type="landscape"]');
    if (landscapeCb) landscapeCb.checked = draft.evaluations.some((evaluation) => landscape.includes(evaluation.name));
  } else {
    defaults.forEach((name) => addItem(name, 'default'));
  }

  form.querySelectorAll('[data-type]').forEach((input) => input.addEventListener('change', () => {
    syncTypeItems('person', person);
    syncTypeItems('landscape', landscape);
  }));
  addButton?.addEventListener('click', () => addItem('新しい評価項目'));

  form.addEventListener('input', syncEvaluationData);
  form.addEventListener('change', syncEvaluationData);

  form.addEventListener('click', (event) => {
    const remove = event.target.closest('.remove-evaluation');
    if (remove) {
      remove.closest('.evaluation-item')?.remove();
      syncEvaluationData();
    }
    const toggle = event.target.closest('.evaluation-toggle');
    if (toggle) {
      const item = toggle.closest('.evaluation-item');
      const collapsed = item?.classList.toggle('is-collapsed');
      toggle.textContent = collapsed ? '▶' : '▼';
    }
    const scoreButton = event.target.closest('.score-dot');
    if (scoreButton) {
      const picker = scoreButton.closest('.item-score');
      const score = Number(scoreButton.dataset.score);
      if (picker) {
        picker.dataset.score = score;
        picker.innerHTML = scoreButtons(null, score);
        syncEvaluationData();
      }
    }
  });

  form.querySelector('[data-score-picker]')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-score]');
    if (!button) return;
    const score = Number(button.dataset.score);
    if (overallScore) overallScore.value = score;
    event.currentTarget.innerHTML = scoreButtons(null, score);
  });

  illustrationSelect?.addEventListener('change', selectIllustration);
  document.addEventListener('illustrations:updated', selectIllustration);
  if (reflectionView) {
    new MutationObserver(syncImagePreviews).observe(reflectionView, { attributes: true, attributeFilter: ['class'] });
  }

  mobileToggle?.addEventListener('click', () => {
    const collapsed = mobilePreview.classList.toggle('is-collapsed');
    mobileToggle.textContent = collapsed ? '画像を表示' : '折りたたむ';
    mobileToggle.setAttribute('aria-expanded', String(!collapsed));
  });
  desktopClose?.addEventListener('click', () => {
    desktopPreviewClosed = true;
    syncImagePreviews();
  });
  desktopReopen?.addEventListener('click', () => {
    desktopPreviewClosed = false;
    syncImagePreviews();
  });
  document.querySelectorAll('[data-reflection-image-fullscreen]').forEach((button) => {
    button.addEventListener('click', openImageDialog);
  });
  document.getElementById('reflection-image-dialog-close')?.addEventListener('click', () => imageDialog?.close());
  document.getElementById('reflection-image-zoom-in')?.addEventListener('click', () => setImageScale(imageScale + 0.25));
  document.getElementById('reflection-image-zoom-out')?.addEventListener('click', () => setImageScale(imageScale - 0.25));
  document.getElementById('reflection-image-zoom-reset')?.addEventListener('click', resetImageZoom);
  zoomSlider?.addEventListener('input', () => setImageScale(Number(zoomSlider.value) / 100));
  dialogCanvas?.addEventListener('wheel', (event) => {
    event.preventDefault();
    setImageScale(imageScale + (event.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
  dialogCanvas?.addEventListener('dblclick', resetImageZoom);
  dialogCanvas?.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setImageScale(imageScale + 0.25);
    } else if (event.key === '-') {
      event.preventDefault();
      setImageScale(imageScale - 0.25);
    } else if (event.key === '0') {
      event.preventDefault();
      resetImageZoom();
    }
  });
  dialogCanvas?.addEventListener('pointerdown', (event) => {
    dialogCanvas.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 2) {
      const [first, second] = [...activePointers.values()];
      pointerDistance = Math.hypot(second.x - first.x, second.y - first.y);
    }
    dialogCanvas.classList.add('is-dragging');
  });
  dialogCanvas?.addEventListener('pointermove', (event) => {
    const previous = activePointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    activePointers.set(event.pointerId, current);
    if (activePointers.size === 2) {
      const [first, second] = [...activePointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (pointerDistance > 0) setImageScale(imageScale * (distance / pointerDistance));
      pointerDistance = distance;
    } else if (imageScale > 1) {
      imageX += current.x - previous.x;
      imageY += current.y - previous.y;
      updateImageTransform();
    }
  });
  const endPointer = (event) => {
    activePointers.delete(event.pointerId);
    pointerDistance = 0;
    if (activePointers.size === 0) dialogCanvas.classList.remove('is-dragging');
  };
  dialogCanvas?.addEventListener('pointerup', endPointer);
  dialogCanvas?.addEventListener('pointercancel', endPointer);
  imageDialog?.addEventListener('click', (event) => {
    if (event.target === imageDialog) imageDialog.close();
  });

  updateImageTransform();
  selectIllustration();
  if (!draft && illustrationSelect?.selectedOptions[0]?.dataset.date && dateInput) {
    dateInput.value = illustrationSelect.selectedOptions[0].dataset.date;
  }

  form.addEventListener('submit', () => {
    syncEvaluationData();
  });
});
