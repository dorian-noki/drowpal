document.addEventListener('DOMContentLoaded', async () => {
  const STORAGE_KEY = 'drowpal-static-v1';
  const DB_NAME = 'drowpal-static-files';
  const DEFAULT_IMAGES = {
    normal: './assets/default.png'
  };
  const DEFAULT_GENERATED_CONTENT = {
    startup_lines: [
      { text: 'おかえり。今日は見たい場所から少し始めよう。' },
      { text: '準備できたら一緒に。まずは今日の気持ちを確認しよう。' },
      { text: '今日も来てくれてうれしい。小さな一歩で大丈夫。' }
    ],
    menu_lines: [
      { menu: 'home', text: '今日は、描く・残す・相談する。その中から選んでみよう。' },
      { menu: 'reflection', text: 'できたところと、次に試すことを一つずつ見つけよう。' },
      { menu: 'calendar', text: '続けた日を見返すと、気づきの変化が見えるよ。' },
      { menu: 'illustrations', text: '完成していなくても大丈夫。描いた過程も大切に残そう。' },
      { menu: 'settings', text: '話し方や見た目を、自分が安心できる形に整えよう。' }
    ],
    notification_lines: [
      { condition: 'settings_saved', text: '設定を保存したよ。新しい雰囲気でまた一緒に進もう。' },
      { condition: 'reflection_saved', text: '振り返りを残せたね。気づきが次の一枚につながるよ。' },
      { condition: 'illustration_saved', text: '一枚を保存したよ。描いた事実をちゃんと残せたね。' },
      { condition: 'todo_added', text: '次にすることを決められたね。小さく進めよう。' },
      { condition: 'goal_changed', text: '目標を更新したよ。いまの自分に合う分量で続けよう。' }
    ],
    idle_lines: [
      { text: '少し休憩しても大丈夫。目と手をゆるめてから戻ろう。' },
      { text: '迷ったら、いま見えている一番大きな課題だけにしてみよう。' },
      { text: '完璧を急がなくてもいい。今日は一つだけ試してみよう。' }
    ],
    greeting_lines: [
      { period: 'morning', text: 'おはよう。まずは今日の一番小さな一歩から始めよう。' },
      { period: 'afternoon', text: 'おかえり。短い時間でも、描いたことはちゃんと積み重なるよ。' },
      { period: 'evening', text: '夕方だね。今日の絵を振り返って、良かった点を一つ残そう。' },
      { period: 'night', text: '今日もおつかれさま。無理をせず、一つだけ気づきを書いてもいいよ。' }
    ],
    reaction_lines: [
      { situation: 'happy', text: 'うれしい。そこまで考えて描けたのは、とても大きな一歩だね。' },
      { situation: 'sad', text: '思うようにいかない日もあるよ。難しかったことを一つだけ言葉にしよう。' },
      { situation: 'focused', text: 'いい集中だね。今の手順を覚えて、次も使えるようにしよう。' },
      { situation: 'consult', text: '何に困っているか、一緒に小さく分けて考えよう。' },
      { situation: 'normal', text: 'ここにいるよ。今日は何を試してみたい？' }
    ]
  };
  const DEFAULT_EXPRESSIONS = [
    { key: 'normal', name: '通常', fixed: true }
  ];
  for (const [type, items] of Object.entries(DEFAULT_GENERATED_CONTENT)) {
    for (const item of items) {
      item.expression = type === 'reaction_lines' ? item.situation : 'normal';
    }
  }
  const normalizeExpressions = (expressions) => {
    const source = Array.isArray(expressions) ? expressions : DEFAULT_EXPRESSIONS;
    const seen = new Set();
    const normalized = source
      .map((expression) => {
        const key = /^[a-z][a-z0-9_-]{0,39}$/i.test(String(expression?.key || ''))
          ? String(expression.key)
          : '';
        const name = String(expression?.name || '').trim().slice(0, 20);
        if (!key || !name || seen.has(key)) return null;
        seen.add(key);
        return { key, name, fixed: key === 'normal' };
      })
      .filter(Boolean);
    if (!seen.has('normal')) normalized.unshift({ ...DEFAULT_EXPRESSIONS[0] });
    return normalized;
  };
  const removeUnusedDefaultExpressions = (expressions, images) => expressions.filter((expression) =>
    !['happy', 'sad', 'focused'].includes(expression.key) || Boolean(images?.[expression.key])
  );
  const defaultState = {
    version: 1,
    character: {
      name: 'ソラ',
      personality: '優しく励ましてくれる',
      style: 'やさしく短く、前向き',
      greeting: 'こんにちは。今日の気持ちを一緒に整理しよう。',
      user_name: 'あなた',
      interaction_style: '寄り添いながら次の一歩を提案する',
      profile: '',
      examplesList: []
    },
    statusMessage: '一緒に続けよう',
    weeklyGoal: 3,
    todos: [],
    illustrations: [],
    reflections: [],
    promptHistory: [],
    promptLog: [],
    study: {
      participantId: '',
      baseline: { start: '', end: '', days: '', count: '', hours: '' },
      period: { start: '', end: '' }
    },
    generatedContent: {
      startup_lines: [],
      menu_lines: [],
      notification_lines: [],
      idle_lines: [],
      greeting_lines: [],
      reaction_lines: [],
      discord_notifications: []
    },
    discordNotifications: {
      enabled: true,
      webhookUrl: '',
      days: [1, 2, 3, 4, 5],
      time: '09:00',
      lastSentSlot: '',
      lastSentAt: '',
      lastError: ''
    },
    characterImages: {},
    characterExpressions: DEFAULT_EXPRESSIONS.map((expression) => ({ ...expression })),
    palMotion: null,
    appearance: {
      backgroundImage: '',
      headerImage: '',
      stickerImage1: '',
      stickerImage2: '',
      stickerImage3: '',
      uiFont: 'standard'
    }
  };

  const normalizeStudy = (study) => ({
    participantId: String(study?.participantId || '').slice(0, 20),
    baseline: { ...defaultState.study.baseline, ...(study?.baseline || {}) },
    period: { ...defaultState.study.period, ...(study?.period || {}) }
  });

  let state = { ...defaultState };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1) {
      state = {
        ...defaultState,
        ...saved,
        characterExpressions: removeUnusedDefaultExpressions(
          normalizeExpressions(saved.characterExpressions),
          saved.characterImages
        ),
        character: { ...defaultState.character, ...(saved.character || {}) },
        appearance: { ...defaultState.appearance, ...(saved.appearance || {}) },
        generatedContent: { ...defaultState.generatedContent, ...(saved.generatedContent || {}) },
        promptLog: Array.isArray(saved.promptLog) ? saved.promptLog : [],
        study: normalizeStudy(saved.study),
        discordNotifications: window.DrowpalDiscordNotifications.normalizeConfig({
          ...defaultState.discordNotifications,
          ...(saved.discordNotifications || {})
        })
      };
    }
  } catch (error) {
    console.warn('[Static] 保存データを読み込めませんでした。', error);
  }

  const saveState = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      alert('端末の保存容量が不足しています。不要な画像を削除してから再度お試しください。');
      throw error;
    }
  };
  window.DrowpalReflectionHistory = () => state.reflections;
  const nextId = (items) => Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const escapeText = (value) => String(value ?? '');

  function openFileDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('files')) {
          request.result.createObjectStore('files');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const fileDb = await openFileDb();
  const imageUrls = new Map();
  const putImage = (key, file) => new Promise((resolve, reject) => {
    const transaction = fileDb.transaction('files', 'readwrite');
    transaction.objectStore('files').put(file, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  const deleteImage = (key) => new Promise((resolve, reject) => {
    if (!key) {
      resolve();
      return;
    }
    const transaction = fileDb.transaction('files', 'readwrite');
    transaction.objectStore('files').delete(key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  const getImageUrl = async (key, fallback = '') => {
    if (!key) return fallback;
    if (imageUrls.has(key)) return imageUrls.get(key);
    const blob = await new Promise((resolve, reject) => {
      const transaction = fileDb.transaction('files', 'readonly');
      const request = transaction.objectStore('files').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!blob) return fallback;
    const url = URL.createObjectURL(blob);
    imageUrls.set(key, url);
    return url;
  };
  const setFile = async (input, prefix) => {
    const file = input?.files?.[0];
    if (!file) return '';
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('画像は5MB以下にしてください。');
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      throw new Error('PNG、JPEG、WebP画像を選択してください。');
    }
    const key = `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    await putImage(key, file);
    return key;
  };
  const COMPRESS_THRESHOLD = 1024 * 1024;
  const previewObjectUrls = new WeakMap();
  const replaceInputFile = (input, file) => {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
  };
  const compressImageFile = async (file) => {
    const bitmap = window.createImageBitmap
      ? await createImageBitmap(file)
      : await new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {
          URL.revokeObjectURL(url);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('画像を読み込めませんでした。'));
        };
        image.src = url;
      });
    const width = bitmap.width;
    const height = bitmap.height;
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('画像を圧縮できませんでした。')), 'image/webp', 0.82);
    });
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
  };
  const updateFilePreview = (input) => {
    const file = input.files?.[0];
    if (!file) return;
    const container = input.closest('.pal-image-option, .appearance-image-option, .upload-zone');
    if (!container) return;
    const previousUrl = previewObjectUrls.get(input);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const url = URL.createObjectURL(file);
    previewObjectUrls.set(input, url);
    let image = container.querySelector('img');
    if (!image) {
      image = document.createElement('img');
      image.alt = `${file.name}のプレビュー`;
      input.before(image);
    }
    image.src = url;
    image.hidden = false;
    container.querySelector('.appearance-placeholder')?.remove();
  };
  const enhanceImageInput = (input) => {
    if (input.dataset.compressionEnhanced) return;
    input.dataset.compressionEnhanced = 'true';
    const host = input.closest('.pal-image-option, .appearance-image-option, .upload-zone') || input.parentElement;
    const status = document.createElement('small');
    status.className = 'image-file-status';
    host?.append(status);
    const refresh = () => {
      updateFilePreview(input);
      host?.querySelector('.image-compress-button')?.remove();
      const file = input.files?.[0];
      if (!file) {
        status.textContent = '';
        return;
      }
      status.textContent = `${file.name}・${(file.size / 1024 / 1024).toFixed(2)}MB`;
      if (file.size <= COMPRESS_THRESHOLD) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary image-compress-button';
      button.textContent = '画像を圧縮して使う';
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        button.textContent = '圧縮中…';
        try {
          const compressed = await compressImageFile(file);
          replaceInputFile(input, compressed);
          input.dispatchEvent(new Event('change', { bubbles: true }));
          status.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressed.size / 1024 / 1024).toFixed(2)}MB に圧縮しました。`;
        } catch (error) {
          status.textContent = error.message;
        } finally {
          button.disabled = false;
          button.textContent = '画像を圧縮して使う';
        }
      });
      host?.append(button);
    };
    input.addEventListener('change', refresh);
  };
  const enhanceImageInputs = () => {
    document.querySelectorAll('input[type="file"][accept*="image/"]').forEach(enhanceImageInput);
  };
  enhanceImageInputs();
  new MutationObserver(enhanceImageInputs).observe(document.body, { childList: true, subtree: true });
  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const getStoredDataUrl = async (key) => {
    if (!key) return '';
    const blob = await new Promise((resolve, reject) => {
      const request = fileDb.transaction('files', 'readonly').objectStore('files').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return blob ? blobToDataUrl(blob) : '';
  };
  const dataUrlToKey = async (dataUrl, prefix) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return '';
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('取り込む画像は1枚5MB以下にしてください。');
    }
    const key = `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    await putImage(key, blob);
    return key;
  };

  const views = [...document.querySelectorAll('[data-view]')];
  const menuButtons = [...document.querySelectorAll('[data-view-target]')];
  const menuToggle = document.getElementById('menu-toggle');
  const menuList = document.getElementById('menu-list');
  const scrollToTopButton = document.getElementById('scroll-to-top');
  const characterSpeechBubble = document.getElementById('character-speech-bubble');
  characterSpeechBubble?.addEventListener('click', () => {
    characterSpeechBubble.hidden = true;
  });
  const setPalExpression = (expression = 'normal') => {
    const image = document.getElementById('pal-image');
    const source = window.palImages?.[expression] || window.palImages?.normal;
    if (!image || !source) return;
    if (new URL(image.src, location.href).href !== new URL(source, location.href).href) image.src = source;
    image.dataset.expression = window.palImages?.[expression] ? expression : 'normal';
  };
  const getGeneratedItem = (type, matcher = () => true) => {
    const customItems = state.generatedContent[type] || [];
    const items = (customItems.length > 0 ? customItems : DEFAULT_GENERATED_CONTENT[type] || []).filter(matcher);
    return items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
  };
  const getGeneratedLine = (type, matcher = () => true) => getGeneratedItem(type, matcher)?.text || '';
  const showGeneratedMessage = (type, matcher = () => true) => {
    const item = getGeneratedItem(type, matcher);
    if (!item?.text) return false;
    const speech = document.getElementById('character-speech-bubble');
    speech.textContent = item.text;
    speech.hidden = false;
    setPalExpression(item.expression || 'normal');
    return true;
  };
  const getGreetingPeriod = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  };
  const showView = (name) => {
    views.forEach((view) => {
      view.classList.remove('is-entering');
      view.classList.toggle('is-active', view.dataset.view === name);
    });
    const activeView = views.find((view) => view.dataset.view === name);
    if (activeView && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void activeView.offsetWidth;
      activeView.classList.add('is-entering');
      activeView.addEventListener('animationend', () => {
        activeView.classList.remove('is-entering');
      }, { once: true });
    }
    menuButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === name));
    if (menuList) menuList.hidden = true;
    menuToggle?.setAttribute('aria-expanded', 'false');
    document.querySelectorAll('.feature-view').forEach((view) => { view.scrollTop = 0; });
    document.dispatchEvent(new CustomEvent('view:shown', { detail: { name } }));
    const menuItem = getGeneratedItem('menu_lines', (item) => item.menu === name);
    if (menuItem) {
      const speech = document.getElementById('character-speech-bubble');
      speech.textContent = menuItem.text;
      speech.hidden = false;
      setPalExpression(menuItem.expression || 'normal');
    }
  };
  const panelStates = {
    chat: localStorage.getItem('drowpal-chat-panel-collapsed') === 'true'
  };
  const characterCaption = document.querySelector('.character-caption');
  const characterCaptionToggle = document.getElementById('character-caption-toggle');
  const setCharacterCaptionCollapsed = (collapsed) => {
    characterCaption?.classList.toggle('is-collapsed', collapsed);
    characterCaptionToggle?.setAttribute('aria-expanded', String(!collapsed));
    characterCaptionToggle?.setAttribute(
      'aria-label',
      collapsed ? 'キャラクター情報を展開する' : 'キャラクター情報を折りたたむ'
    );
    if (characterCaptionToggle) characterCaptionToggle.textContent = collapsed ? '▼' : '▲';
    localStorage.setItem('drowpal-character-caption-collapsed', String(collapsed));
  };
  characterCaptionToggle?.addEventListener('click', () => {
    setCharacterCaptionCollapsed(!characterCaption.classList.contains('is-collapsed'));
  });
  setCharacterCaptionCollapsed(
    localStorage.getItem('drowpal-character-caption-collapsed') === 'true'
  );
  const chatPanel = document.querySelector('.chat-panel');
  const chatPanelToggle = document.getElementById('chat-panel-toggle');
  const setChatCollapsed = (collapsed) => {
    chatPanel?.classList.toggle('is-collapsed', collapsed);
    chatPanelToggle?.setAttribute('aria-expanded', String(!collapsed));
    chatPanelToggle?.setAttribute('aria-label', collapsed ? 'AI相談パネルを展開する' : 'AI相談パネルを折りたたむ');
    if (chatPanelToggle) chatPanelToggle.textContent = collapsed ? 'AIに相談を開く' : '▲';
    localStorage.setItem('drowpal-chat-panel-collapsed', String(collapsed));
  };
  chatPanelToggle?.addEventListener('click', () => {
    panelStates.chat = !panelStates.chat;
    setChatCollapsed(panelStates.chat);
  });
  setChatCollapsed(panelStates.chat);
  menuButtons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.viewTarget)));
  menuToggle?.addEventListener('click', () => {
    const open = menuList.hidden;
    menuList.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  const getScrollableContent = () => {
    const activeView = document.querySelector('.feature-view.is-active');
    if (window.innerWidth > 700 && activeView && getComputedStyle(activeView).overflowY === 'auto' &&
        activeView.scrollHeight > activeView.clientHeight) {
      return activeView;
    }
    return document.scrollingElement || document.documentElement;
  };
  const updateScrollToTop = () => {
    const target = getScrollableContent();
    const scrollTop = target === document.scrollingElement || target === document.documentElement
      ? window.scrollY
      : target.scrollTop;
    scrollToTopButton.hidden = window.innerWidth > 700 || scrollTop < 320;
  };
  window.addEventListener('scroll', updateScrollToTop, { passive: true });
  views.forEach((view) => view.addEventListener('scroll', updateScrollToTop, { passive: true }));
  window.addEventListener('resize', updateScrollToTop);
  scrollToTopButton.addEventListener('click', () => {
    const target = getScrollableContent();
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (target === document.scrollingElement || target === document.documentElement) {
      window.scrollTo({ top: 0, behavior });
    } else {
      target.scrollTo({ top: 0, behavior });
    }
  });
  updateScrollToTop();

  const weeklySummary = () => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = localDate(monday);
    const end = localDate(sunday);
    const count = state.illustrations.filter((item) => item.date >= start && item.date <= end).length;
    return { start, end, count, goal: state.weeklyGoal, percent: Math.min(100, Math.round(count / state.weeklyGoal * 100)) };
  };

  const renderTodos = () => {
    const list = document.getElementById('todo-list');
    const empty = document.getElementById('todo-empty');
    list.replaceChildren(...state.todos.map((todo) => {
      const item = document.createElement('li');
      item.className = `todo-item${todo.done ? ' is-done' : ''}`;
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'todo-check';
      toggle.textContent = todo.done ? '✓' : '';
      toggle.dataset.todoToggle = String(todo.id);
      toggle.setAttribute('aria-label', `${todo.title}を完了切り替え`);
      const title = document.createElement('span');
      title.className = 'todo-title';
      title.textContent = todo.title;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'todo-delete';
      remove.textContent = '×';
      remove.dataset.todoDelete = String(todo.id);
      remove.setAttribute('aria-label', `${todo.title}を削除`);
      item.append(toggle, title, remove);
      return item;
    }));
    empty.hidden = state.todos.length > 0;
  };

  const renderWeeklyGoal = () => {
    const summary = weeklySummary();
    document.getElementById('weekly-goal-count').textContent = String(summary.count);
    document.querySelector('.goal-count').lastChild.textContent = ` / ${summary.goal} 枚`;
    document.querySelector('.goal-percent').textContent = `${summary.percent}%`;
    document.querySelector('.goal-date').textContent = `${summary.start} 〜 ${summary.end}`;
    const progress = document.querySelector('.progress');
    progress.setAttribute('aria-valuenow', String(summary.percent));
    progress.querySelector('span').style.width = `${summary.percent}%`;
    const input = document.querySelector('[name="weeklyGoal"]');
    input.value = String(summary.goal);
    return summary;
  };

  const renderRecent = () => {
    const recent = document.querySelector('.recent-reflections');
    if (!recent) return;
    const items = [...state.reflections].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    recent.replaceChildren(...items.map((reflection) => {
      const card = document.createElement('article');
      card.className = 'recent-card';
      const date = document.createElement('strong');
      date.textContent = reflection.date;
      const score = document.createElement('div');
      score.className = 'small';
      score.textContent = `評価 ${reflection.score} / 5・${reflection.hours}h`;
      const note = document.createElement('p');
      note.textContent = reflection.note || 'メモはありません。';
      card.append(date, score, note);
      return card;
    }));
    document.querySelector('.section-count').textContent = `${items.length}件`;
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'small empty-message';
      empty.textContent = 'まだ記録がありません。';
      recent.append(empty);
    }
  };

  const renderIllustrations = async () => {
    const sorted = [...state.illustrations].sort((a, b) => b.date.localeCompare(a.date));
    const select = document.querySelector('[name="illustrationId"]');
    select.replaceChildren(new Option('選択してください', ''));
    const grid = document.querySelector('.illustration-grid');
    grid.replaceChildren();
    const count = document.querySelector('[data-view="illustrations"] .section-title-with-note span');
    if (count) count.textContent = `${sorted.length}件`;
    for (const illustration of sorted) {
      const option = new Option(`${illustration.date || '日付未設定'}・${illustration.title}`, illustration.id);
      option.dataset.date = illustration.date;
      if (illustration.hours > 0) option.dataset.hours = String(illustration.hours);
      option.dataset.imageSrc = await getImageUrl(illustration.imageKey);
      select.append(option);
      const card = document.createElement('div');
      card.className = 'card small-card';
      card.innerHTML = `<strong></strong><div class="small"></div><img class="uploaded" />`;
      card.querySelector('strong').textContent = illustration.title;
      card.querySelector('.small').textContent = `${illustration.date || '日付未設定'}・${illustration.type || '練習'}${illustration.hours > 0 ? `・${illustration.hours}h` : ''}`;
      card.querySelector('img').src = await getImageUrl(illustration.imageKey);
      card.querySelector('img').alt = illustration.title;
      grid.append(card);
    }
    document.dispatchEvent(new CustomEvent('illustrations:updated'));
  };

  const renderReflectionHistory = async () => {
    const view = document.querySelector('[data-view="reflection"]');
    view.querySelector('.reflection-history-source')?.remove();
    [...view.children].forEach((element) => {
      if (element.tagName === 'P' && element.textContent.trim() === 'まだ記録がありません。') {
        element.remove();
      }
    });
    const old = view.querySelector('.static-reflection-history');
    old?.remove();
    const wrapper = document.createElement('div');
    wrapper.className = 'static-reflection-history';
    const sorted = [...state.reflections].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) {
      wrapper.innerHTML = '<p class="small">まだ記録がありません。</p>';
    } else {
      for (const reflection of sorted) {
        const illustration = state.illustrations.find((item) => String(item.id) === String(reflection.illustrationId));
        const details = document.createElement('details');
        details.className = 'card small-card';
        const summary = document.createElement('summary');
        summary.textContent = `${reflection.date}・${illustration?.title || '未選択のイラスト'}（${'★'.repeat(reflection.score)}${'☆'.repeat(5 - reflection.score)}・${reflection.hours}h）`;
        details.append(summary);
        if (illustration?.imageKey) {
          const image = document.createElement('img');
          image.className = 'uploaded';
          image.src = await getImageUrl(illustration.imageKey);
          image.alt = illustration.title;
          details.append(image);
        }
        const note = document.createElement('p');
        note.textContent = reflection.note || 'メモはありません。';
        details.append(note);
        reflection.evaluations?.forEach((evaluation) => {
          const row = document.createElement('div');
          row.className = 'small';
          row.textContent = `${evaluation.name}: ${'★'.repeat(evaluation.score)}${'☆'.repeat(5 - evaluation.score)}${evaluation.reason ? ` - ${evaluation.reason}` : ''}`;
          details.append(row);
        });
        wrapper.append(details);
      }
    }
    const existingHeading = view.querySelector('.section-title-with-note');
    existingHeading.after(wrapper);
    view.querySelectorAll('.static-reflection-history ~ details').forEach((element) => element.remove());
  };

  const renderCalendar = async () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const heading = document.querySelector('[data-view="calendar"] h2');
    heading.textContent = `${now.getFullYear()}年 ${now.getMonth() + 1}月`;
    const grid = document.querySelector('.calendar-grid');
    grid.replaceChildren();
    ['日', '月', '火', '水', '木', '金', '土'].forEach((day) => {
      const cell = document.createElement('div');
      cell.className = 'calendar-day calendar-heading';
      cell.innerHTML = `<strong>${day}</strong>`;
      grid.append(cell);
    });
    for (let blank = 0; blank < first.getDay(); blank += 1) {
      const cell = document.createElement('div');
      cell.className = 'calendar-day is-empty';
      grid.append(cell);
    }
    for (let day = 1; day <= last.getDate(); day += 1) {
      const date = localDate(new Date(now.getFullYear(), now.getMonth(), day));
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      const label = document.createElement('div');
      label.className = 'date';
      label.textContent = day;
      cell.append(label);
      const illustration = state.illustrations.find((item) => item.date === date);
      if (illustration) {
        const image = document.createElement('img');
        image.src = await getImageUrl(illustration.imageKey);
        image.alt = illustration.title;
        const link = document.createElement('a');
        link.className = 'calendar-illustration';
        link.href = '#';
        link.addEventListener('click', (event) => {
          event.preventDefault();
          showView('reflection');
          const select = document.querySelector('[name="illustrationId"]');
          select.value = String(illustration.id);
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        link.append(image);
        cell.append(link);
      }
      grid.append(cell);
    }
  };

  const applyAppearance = async () => {
    const appearance = state.appearance;
    const uiFont = appearance.uiFont === 'soft' ? 'soft' : 'standard';
    appearance.uiFont = uiFont;
    document.documentElement.dataset.font = uiFont;
    document.body.dataset.font = uiFont;
    Object.assign(appearance, window.DrowpalTheme.apply(document.body, appearance));
    const backgroundUrl = await getImageUrl(appearance.backgroundImage);
    document.body.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : '';
    document.body.classList.toggle('has-custom-background', Boolean(backgroundUrl));

    const header = document.getElementById('home-header-image');
    const headerUrl = await getImageUrl(appearance.headerImage);
    header.hidden = !headerUrl;
    header.querySelector('img')?.remove();
    if (headerUrl) {
      const image = document.createElement('img');
      image.src = headerUrl;
      image.alt = 'ホームヘッダー';
      header.prepend(image);
    }
    const headerToggle = document.getElementById('home-header-toggle');
    if (headerToggle) {
      const collapsed = headerUrl && localStorage.getItem('drowpal-home-header-collapsed') === 'true';
      header.classList.toggle('is-collapsed', Boolean(collapsed));
      headerToggle.hidden = !headerUrl;
      headerToggle.setAttribute('aria-expanded', String(!collapsed));
      headerToggle.setAttribute('aria-label', collapsed ? 'ヘッダー画像を表示する' : 'ヘッダー画像を折りたたむ');
      headerToggle.textContent = collapsed ? '▼ 画像を表示' : '▲ 画像を閉じる';
    }

    const stickers = [...document.querySelectorAll('[data-sticker-number]')];
    for (const sticker of stickers) {
      const number = sticker.dataset.stickerNumber;
      const url = await getImageUrl(appearance[`stickerImage${number}`]);
      sticker.hidden = !url;
      sticker.replaceChildren();
      if (url) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = `ステッカー${number}`;
        image.draggable = false;
        sticker.append(image);
      }
      document.querySelector(`[data-sticker-remove="${number}"]`)?.toggleAttribute('hidden', !url);
    }
  };
  document.getElementById('home-header-toggle')?.addEventListener('click', () => {
    const header = document.getElementById('home-header-image');
    const collapsed = !header.classList.contains('is-collapsed');
    header.classList.toggle('is-collapsed', collapsed);
    const toggle = document.getElementById('home-header-toggle');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'ヘッダー画像を表示する' : 'ヘッダー画像を折りたたむ');
    toggle.textContent = collapsed ? '▼ 画像を表示' : '▲ 画像を閉じる';
    localStorage.setItem('drowpal-home-header-collapsed', String(collapsed));
  });

  const renderCharacter = async () => {
    document.querySelector('.summary-card-character strong').textContent = state.character.name || '未設定';
    document.querySelector('.character-caption strong').textContent = state.character.name || 'AIキャラクター';
    const startupMessage = getGeneratedLine('startup_lines')
      || getGeneratedLine('greeting_lines', (item) => item.period === getGreetingPeriod())
      || state.statusMessage
      || '一緒に続けよう';
    document.getElementById('character-status-message').textContent = startupMessage;
    const pal = document.getElementById('pal-image');
    pal.src = await getImageUrl(state.characterImages.normal, DEFAULT_IMAGES.normal);
    pal.alt = state.character.name || 'AIキャラクター';
    window.palImages = {};
    for (const expression of state.characterExpressions) {
      window.palImages[expression.key] = await getImageUrl(
        state.characterImages[expression.key],
        DEFAULT_IMAGES[expression.key] || ''
      );
    }
    setPalExpression('normal');
  };

  const expressionDeleteKeys = new Set();
  const expressionResetKeys = new Set();
  const renderExpressionSettings = async () => {
    const grid = document.getElementById('pal-image-grid');
    grid.replaceChildren();
    for (const expression of state.characterExpressions) {
      const option = document.createElement('div');
      option.className = 'pal-image-option';
      option.dataset.expressionKey = expression.key;
      const name = document.createElement('input');
      name.type = 'text';
      name.className = 'pal-expression-name';
      name.name = `expressionName_${expression.key}`;
      name.value = expression.name;
      name.maxLength = 20;
      name.required = true;
      name.setAttribute('aria-label', `${expression.name}の表情名`);
      if (expression.fixed) name.readOnly = true;
      const image = document.createElement('img');
      image.alt = `${expression.name}のプレビュー`;
      image.src = await getImageUrl(
        state.characterImages[expression.key],
        DEFAULT_IMAGES[expression.key] || DEFAULT_IMAGES.normal
      );
      const file = document.createElement('input');
      file.type = 'file';
      file.name = `palImage_${expression.key}`;
      file.accept = 'image/png,image/jpeg,image/webp';
      const actions = document.createElement('div');
      actions.className = 'pal-expression-actions';
      if (DEFAULT_IMAGES[expression.key] && state.characterImages[expression.key]) {
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'secondary pal-expression-reset';
        reset.textContent = '未設定に戻す';
        reset.addEventListener('click', () => {
          expressionResetKeys.add(expression.key);
          image.src = DEFAULT_IMAGES[expression.key];
          file.value = '';
          reset.hidden = true;
          document.getElementById('pal-expression-status').textContent = '「設定を保存」で画像の初期化が確定します。';
        });
        actions.append(reset);
      }
      if (!expression.fixed) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'secondary pal-expression-remove';
        remove.textContent = '削除';
        remove.addEventListener('click', () => {
          expressionDeleteKeys.add(expression.key);
          option.remove();
          document.getElementById('pal-expression-status').textContent = '「設定を保存」で削除が確定します。';
        });
        actions.append(remove);
      }
      option.append(name, image, file, actions);
      grid.append(option);
    }
  };

  const renderSettings = async () => {
    const form = document.querySelector('[data-view="settings"] form[action="#"]');
    const names = {
      name: state.character.name,
      personality: state.character.personality,
      style: state.character.style,
      userName: state.character.user_name,
      interactionStyle: state.character.interaction_style,
      profile: state.character.profile
    };
    Object.entries(names).forEach(([name, value]) => {
      const input = form.elements[name];
      if (input) input.value = value || '';
    });
    [...form.querySelectorAll('[name="examples"]')].forEach((input, index) => {
      input.value = state.character.examplesList[index] || '';
    });
    Object.entries(window.DrowpalTheme.normalize(state.appearance)).forEach(([key, value]) => {
      const input = form.elements[key];
      if (input) input.value = value;
    });
    form.querySelectorAll('[name="uiFont"]').forEach((input) => {
      input.checked = input.value === (state.appearance.uiFont === 'soft' ? 'soft' : 'standard');
    });
    for (const option of form.querySelectorAll('.appearance-image-option')) {
      const input = option.querySelector('input[type="file"]');
      if (!input) continue;
      const url = await getImageUrl(state.appearance[input.name]);
      const placeholder = option.querySelector('.appearance-placeholder');
      let image = option.querySelector('img');
      if (url) {
        placeholder?.remove();
        if (!image) {
          image = document.createElement('img');
          input.before(image);
        }
        image.alt = `${option.firstElementChild?.textContent || '画像'}のプレビュー`;
        image.src = url;
      } else if (image) {
        image.remove();
        const empty = document.createElement('span');
        empty.className = 'appearance-placeholder';
        empty.textContent = '未設定';
        input.before(empty);
      }
    }
    document.querySelectorAll('[data-sticker-remove]').forEach((removeForm) => {
      const number = removeForm.dataset.stickerRemove;
      removeForm.hidden = !state.appearance[`stickerImage${number}`];
    });
    await renderExpressionSettings();
  };

  const renderPromptHistory = () => {
    const output = document.getElementById('chat-comments');
    output.replaceChildren();
    const history = state.promptHistory.slice(-20);
    if (history.length === 0) {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ai';
      bubble.textContent = `${state.character.name}: 相談したいことを入力すると、外部AIへ渡すプロンプトを作ります。`;
      output.append(bubble);
      return;
    }
    history.forEach((message) => {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.textContent = `あなた: ${message}`;
      output.append(bubble);
    });
  };

  const currentContext = () => ({
    character: state.character,
    expressions: state.characterExpressions,
    weeklyGoal: renderWeeklyGoal(),
    todos: state.todos,
    reflections: state.reflections
  });

  const renderCounts = () => {
    const summaries = document.querySelectorAll('.summary-card strong');
    summaries[1].innerHTML = `${state.reflections.length}<small>件</small>`;
    summaries[2].innerHTML = `${state.illustrations.length}<small>件</small>`;
  };

  await renderCharacter();
  applyAppearance();
  await renderIllustrations();
  await renderCalendar();
  renderTodos();
  renderWeeklyGoal();
  renderRecent();
  await renderReflectionHistory();
  renderPromptHistory();
  renderCounts();
  await renderSettings();

  const stickerDefaults = [
    { x: 78, y: 18, size: 100 },
    { x: 84, y: 48, size: 100 },
    { x: 18, y: 72, size: 100 }
  ];
  const stickerLayouts = [...document.querySelectorAll('[data-sticker-number]')].map((sticker, index) => {
    const number = Number(sticker.dataset.stickerNumber);
    const storageKey = `drowpal-sticker-${number}-position`;
    let layout = { ...stickerDefaults[index] };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved) {
        layout = {
          x: Math.min(92, Math.max(8, Number(saved.x) || layout.x)),
          y: Math.min(94, Math.max(6, Number(saved.y) || layout.y)),
          size: Math.min(160, Math.max(60, Number(saved.size) || 100))
        };
      }
    } catch (error) {
      console.warn(`[Static Sticker ${number}] 保存位置を読み込めませんでした。`, error);
    }
    return { sticker, number, layout, storageKey };
  });
  const applyStickerLayout = ({ sticker, number, layout, storageKey }, save = true) => {
    sticker.style.left = `${layout.x}%`;
    sticker.style.top = `${layout.y}%`;
    sticker.style.setProperty('--sticker-scale', String(layout.size / 100));
    const sizeInput = document.querySelector(`[data-sticker-size="${number}"]`);
    const sizeOutput = document.querySelector(`[data-sticker-size-output="${number}"]`);
    if (sizeInput) sizeInput.value = String(layout.size);
    if (sizeOutput) sizeOutput.textContent = `${layout.size}%`;
    if (save) localStorage.setItem(storageKey, JSON.stringify(layout));
  };
  stickerLayouts.forEach((entry) => {
    applyStickerLayout(entry, false);
    let drag = null;
    entry.sticker.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: entry.layout.x,
        startY: entry.layout.y
      };
      entry.sticker.setPointerCapture(event.pointerId);
      entry.sticker.classList.add('is-dragging');
    });
    entry.sticker.addEventListener('pointermove', (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      const bounds = document.querySelector('.app-shell').getBoundingClientRect();
      entry.layout.x = Math.min(92, Math.max(8, drag.startX + ((event.clientX - drag.x) / bounds.width) * 100));
      entry.layout.y = Math.min(94, Math.max(6, drag.startY + ((event.clientY - drag.y) / bounds.height) * 100));
      applyStickerLayout(entry);
    });
    const finishDrag = (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      drag = null;
      entry.sticker.classList.remove('is-dragging');
    };
    entry.sticker.addEventListener('pointerup', finishDrag);
    entry.sticker.addEventListener('pointercancel', finishDrag);
    entry.sticker.addEventListener('dblclick', () => {
      entry.layout = { ...stickerDefaults[entry.number - 1] };
      applyStickerLayout(entry);
    });
    entry.sticker.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 3 : 1;
      const movements = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step]
      };
      if (!movements[event.key]) return;
      event.preventDefault();
      entry.layout.x = Math.min(92, Math.max(8, entry.layout.x + movements[event.key][0]));
      entry.layout.y = Math.min(94, Math.max(6, entry.layout.y + movements[event.key][1]));
      applyStickerLayout(entry);
    });
    const sizeInput = document.querySelector(`[data-sticker-size="${entry.number}"]`);
    sizeInput?.addEventListener('input', () => {
      entry.layout.size = Number(sizeInput.value);
      applyStickerLayout(entry);
    });
  });

  document.getElementById('pal-expression-add')?.addEventListener('click', () => {
    const grid = document.getElementById('pal-image-grid');
    const key = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const option = document.createElement('div');
    option.className = 'pal-image-option';
    option.dataset.expressionKey = key;
    option.dataset.newExpression = 'true';
    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'pal-expression-name';
    name.maxLength = 20;
    name.placeholder = '表情名（例: 照れ）';
    name.required = true;
    name.setAttribute('aria-label', '新しい表情名');
    const image = document.createElement('img');
    image.className = 'pal-expression-placeholder';
    image.alt = '新しい表情のプレビュー';
    image.src = DEFAULT_IMAGES.normal;
    const file = document.createElement('input');
    file.type = 'file';
    file.name = `palImage_${key}`;
    file.accept = 'image/png,image/jpeg,image/webp';
    file.required = true;
    file.addEventListener('change', () => {
      if (file.files?.[0]) image.src = URL.createObjectURL(file.files[0]);
    });
    const actions = document.createElement('div');
    actions.className = 'pal-expression-actions';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary pal-expression-remove';
    remove.textContent = '追加をやめる';
    remove.addEventListener('click', () => option.remove());
    actions.append(remove);
    option.append(name, image, file, actions);
    grid.append(option);
    name.focus();
  });

  const palImage = document.getElementById('pal-image');
  const palImageStage = document.getElementById('pal-image-stage');
  const palAdjustToggle = document.getElementById('character-adjust-toggle');
  const palAdjustControls = document.getElementById('character-adjust-controls');
  const palZoom = document.getElementById('pal-image-zoom');
  const palReset = document.getElementById('pal-image-reset');
  const Motion = window.DrowpalMotion;
  const motionEnabledInput = document.getElementById('pal-motion-enabled');
  const motionSpeedInput = document.getElementById('pal-motion-speed');
  const motionStrengthInput = document.getElementById('pal-motion-strength');
  const motionOpenButton = document.getElementById('pal-motion-open');
  const motionAutoButton = document.getElementById('pal-motion-auto');
  const motionStatus = document.getElementById('pal-motion-status');
  const palMotionKey = () => state.characterImages.normal || 'default';
  const isSameUrl = (a, b) => {
    try {
      return new URL(a, location.href).href === new URL(b, location.href).href;
    } catch (error) {
      return false;
    }
  };
  const renderMotionSettings = () => {
    const config = Motion.normalizeConfig(state.palMotion || {});
    motionEnabledInput.checked = config.enabled;
    motionSpeedInput.value = String(config.bpm);
    motionStrengthInput.value = String(Math.round(config.strength * 100));
    document.getElementById('pal-motion-speed-value').textContent = `${config.bpm}回/分`;
    document.getElementById('pal-motion-strength-value').textContent = `${Math.round(config.strength * 100)}%`;
    const unavailable = !palMotion;
    [motionEnabledInput, motionSpeedInput, motionStrengthInput, motionOpenButton, motionAutoButton]
      .forEach((element) => { element.disabled = unavailable; });
    if (unavailable) {
      motionStatus.textContent = 'この端末ではWebGLが使えないため、呼吸モーションは表示されません。';
    } else if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      motionStatus.textContent = '端末の「動きを減らす」設定が有効なため、ホームでは動きを止めています。';
    } else if (!config.enabled) {
      motionStatus.textContent = '呼吸モーションはオフです。';
    } else {
      motionStatus.textContent = `${config.regions.length}個の範囲で呼吸しています。`;
    }
  };
  // Auto-generates breathing for a newly loaded normal image; existing settings for the same image are kept.
  const ensurePalMotion = () => {
    if (!palMotion || !palImage.naturalWidth || !isSameUrl(palImage.src, window.palImages?.normal)) return;
    const current = state.palMotion ? Motion.normalizeConfig(state.palMotion) : null;
    if (!current || current.imageKey !== palMotionKey()) {
      state.palMotion = Motion.createAutoConfig(palImage, {
        enabled: current?.enabled ?? true,
        imageKey: palMotionKey()
      });
      saveState();
    }
    palMotion.setConfig(state.palMotion);
    renderMotionSettings();
  };
  const updatePalMotion = (changes) => {
    if (!state.palMotion) return;
    state.palMotion = Motion.normalizeConfig({ ...state.palMotion, ...changes });
    saveState();
    palMotion?.setConfig(state.palMotion);
    renderMotionSettings();
  };
  let palMotion = null;
  palMotion = Motion?.mountStage({
    stage: palImageStage,
    image: palImage,
    onImageLoad: () => {
      if (palMotion) ensurePalMotion();
    }
  }) || null;
  ensurePalMotion();
  renderMotionSettings();
  const palTargets = () => (palMotion ? [palImage, palMotion.canvas] : [palImage]);
  const setPalClass = (name, enabled) => palTargets().forEach((element) => element.classList.toggle(name, enabled));
  motionEnabledInput.addEventListener('change', () => updatePalMotion({ enabled: motionEnabledInput.checked }));
  motionSpeedInput.addEventListener('input', () => updatePalMotion({ bpm: Number(motionSpeedInput.value) }));
  motionStrengthInput.addEventListener('input', () => updatePalMotion({ strength: Number(motionStrengthInput.value) / 100 }));
  motionAutoButton.addEventListener('click', () => {
    if (!confirm('通常画像から、速度・強さを含む呼吸モーションを自動生成し直します。現在の動きは置き換わります。よろしいですか？')) return;
    const enabled = Motion.normalizeConfig(state.palMotion || {}).enabled;
    state.palMotion = Motion.createAutoConfig(palImage, {
      enabled,
      imageKey: palMotionKey()
    });
    saveState();
    palMotion?.setConfig(state.palMotion);
    renderMotionSettings();
  });
  motionOpenButton.addEventListener('click', async () => {
    try {
      await window.DrowpalMotionEditor.open({
        imageUrl: window.palImages.normal,
        config: state.palMotion || {},
        onSave: (config) => {
          state.palMotion = { ...config, imageKey: palMotionKey() };
          saveState();
          palMotion?.setConfig(state.palMotion);
          renderMotionSettings();
        }
      });
    } catch (error) {
      alert('調整画面を開けませんでした。画像を確認してください。');
    }
  });
  const defaultPalScale = state.characterImages.normal ? 1.28 : 0.9;
  let palView = { scale: defaultPalScale, x: 0, y: 0 };
  try {
    const savedPalView = JSON.parse(localStorage.getItem('drowpal-pal-view'));
    if (savedPalView) {
      palView = {
        scale: Math.min(2.2, Math.max(
          0.9,
          state.characterImages.normal || savedPalView.imageKey === 'default'
            ? Number(savedPalView.scale) || defaultPalScale
            : defaultPalScale
        )),
        x: Math.min(35, Math.max(-35, Number(savedPalView.x) || 0)),
        y: Math.min(35, Math.max(-35, Number(savedPalView.y) || 0))
      };
    }
  } catch (error) {
    console.warn('[Static Pal] 表示調整を読み込めませんでした。', error);
  }
  const applyPalView = (save = false) => {
    palTargets().forEach((element) => {
      element.style.setProperty('--pal-scale', String(palView.scale));
      element.style.setProperty('--pal-x', `${palView.x}%`);
      element.style.setProperty('--pal-y', `${palView.y}%`);
    });
    palMotion?.setViewScale(palView.scale);
    palZoom.value = String(Math.round(palView.scale * 100));
    if (save) {
      localStorage.setItem('drowpal-pal-view', JSON.stringify({
        ...palView,
        imageKey: state.characterImages.normal ? 'custom' : 'default'
      }));
    }
  };
  applyPalView();
  palAdjustToggle.addEventListener('click', () => {
    const isOpen = !palAdjustControls.hidden;
    palAdjustControls.hidden = isOpen;
    palAdjustToggle.setAttribute('aria-expanded', String(!isOpen));
    palImageStage.classList.toggle('is-editing', !isOpen);
    palImageStage.setAttribute(
      'aria-label',
      isOpen ? 'パルをタップすると反応します。' : '表示調整中。画像をドラッグして位置を変更できます。'
    );
  });
  palZoom.addEventListener('input', () => {
    palView.scale = Number(palZoom.value) / 100;
    applyPalView(true);
  });
  palReset.addEventListener('click', () => {
    palView = { scale: defaultPalScale, x: 0, y: 0 };
    applyPalView(true);
  });

  let palDrag = null;
  const playPalReaction = () => {
    if (palImageStage.classList.contains('is-editing') ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    setPalClass('is-pressed', false);
  };
  palImageStage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (!palImageStage.classList.contains('is-editing')) {
      setPalExpression('normal');
      setPalClass('is-reacting', false);
      setPalClass('is-pressed', true);
      return;
    }
    palDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: palView.x,
      startY: palView.y
    };
    palImageStage.setPointerCapture(event.pointerId);
    palImageStage.classList.add('is-dragging');
  });
  palImageStage.addEventListener('pointermove', (event) => {
    if (!palDrag || palDrag.pointerId !== event.pointerId) return;
    const bounds = palImageStage.getBoundingClientRect();
    palView.x = Math.min(35, Math.max(-35, palDrag.startX + (event.clientX - palDrag.x) / bounds.width * 100));
    palView.y = Math.min(35, Math.max(-35, palDrag.startY + (event.clientY - palDrag.y) / bounds.height * 100));
    applyPalView(true);
  });
  const finishPalPointer = (event) => {
    if (palDrag?.pointerId === event.pointerId) {
      palDrag = null;
      palImageStage.classList.remove('is-dragging');
      return;
    }
    setPalClass('is-pressed', false);
    playPalReaction();
  };
  palImageStage.addEventListener('pointerup', finishPalPointer);
  palImageStage.addEventListener('pointercancel', () => {
    palDrag = null;
    setPalClass('is-pressed', false);
    palImageStage.classList.remove('is-dragging');
  });
  palImageStage.addEventListener('pointerleave', () => {
    if (!palImageStage.classList.contains('is-editing')) {
      setPalClass('is-pressed', false);
    }
  });
  palImageStage.addEventListener('wheel', (event) => {
    if (!palImageStage.classList.contains('is-editing')) return;
    event.preventDefault();
    palView.scale = Math.min(2.2, Math.max(0.9, palView.scale + (event.deltaY < 0 ? 0.08 : -0.08)));
    applyPalView(true);
  }, { passive: false });

  const themeColorInputs = [...document.querySelectorAll('input[data-theme-var]')];
  const previewThemeColors = () => window.DrowpalTheme.apply(
    document.body,
    Object.fromEntries(themeColorInputs.map((input) => [input.name, input.value]))
  );
  document.querySelectorAll('.theme-preset').forEach((preset) => {
    preset.addEventListener('click', () => {
      const { colors } = window.DrowpalTheme.PRESETS.find((item) => item.id === preset.dataset.themePreset);
      themeColorInputs.forEach((input) => {
        input.value = colors[input.name];
      });
      document.querySelectorAll('.theme-preset').forEach((button) => {
        button.classList.toggle('is-active', button === preset);
      });
      previewThemeColors();
    });
  });
  themeColorInputs.forEach((input) => input.addEventListener('input', previewThemeColors));
  document.querySelectorAll('[name="uiFont"]').forEach((input) => {
    input.addEventListener('change', () => {
      const font = input.value === 'soft' ? 'soft' : 'standard';
      document.documentElement.dataset.font = font;
      document.body.dataset.font = font;
    });
  });

  let pendingAiImport = null;
  let aiImportMode = 'single';
  let aiImportBatchCount = 5;
  const aiImport = window.DrowpalAiImport;
  const aiType = document.getElementById('ai-import-type');
  Object.entries(aiImport.TYPES).forEach(([type, definition]) => {
    aiType.append(new Option(definition.label, type));
  });

  const renderAiPreview = (preview) => {
    const container = document.getElementById('ai-import-preview-content');
    container.replaceChildren();
    if (preview.byType) {
      Object.entries(preview.byType).forEach(([type, typePreview]) => {
        const section = document.createElement('section');
        section.className = 'ai-import-preview-group';
        const heading = document.createElement('h5');
        heading.textContent = `${aiImport.TYPES[type].label}（新規${typePreview.additions.length}件・重複${typePreview.duplicates.length}件）`;
        section.append(heading);
        [...typePreview.additions, ...typePreview.duplicates].forEach((item) => {
          const row = document.createElement('div');
          row.className = 'ai-import-preview-item';
          const detail = document.createElement('span');
          detail.textContent = item.text || Object.values(item).filter(Boolean).join(' / ');
          const note = document.createElement('small');
          note.textContent = typePreview.additions.includes(item)
            ? '確認後に端末内へ追加します。'
            : '同じ内容が既にあるため追加しません。';
          row.append(detail, note);
          section.append(row);
        });
        container.append(section);
      });
      return;
    }
    const group = (title, items, description) => {
      if (items.length === 0) return;
      const section = document.createElement('section');
      section.className = 'ai-import-preview-group';
      const heading = document.createElement('h5');
      heading.textContent = `${title}（${items.length}件）`;
      section.append(heading);
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'ai-import-preview-item';
        const detail = document.createElement('span');
        detail.textContent = item.text || Object.values(item).filter(Boolean).join(' / ');
        const note = document.createElement('small');
        note.textContent = description;
        row.append(detail, note);
        section.append(row);
      });
      container.append(section);
    };
    group('新しく追加', preview.additions, '確認後に端末内へ追加します。');
    group('重複のため対象外', preview.duplicates, '同じ内容が既にあるため追加しません。');
    if (preview.changes.length > 0) {
      const section = document.createElement('section');
      section.className = 'ai-import-preview-group';
      section.innerHTML = '<h5>既存設定の変更</h5>';
      preview.changes.forEach((change) => {
        const row = document.createElement('div');
        row.className = 'ai-import-preview-item';
        const label = document.createElement('strong');
        label.textContent = change.label;
        const detail = document.createElement('span');
        detail.textContent = `${JSON.stringify(change.current)} → ${JSON.stringify(change.next)}`;
        row.append(label, detail);
        section.append(row);
      });
      container.append(section);
    }
  };

  const renderImportedContent = () => {
    const container = document.getElementById('ai-import-existing');
    container.replaceChildren();
    const messageTypes = Object.keys(aiImport.TYPES).filter((type) => type !== 'character_profile');
    messageTypes.forEach((type) => {
      const items = state.generatedContent[type] || [];
      if (items.length === 0) return;
      const definition = aiImport.TYPES[type];
      const group = document.createElement('section');
      group.className = 'ai-import-preview-group';
      const title = document.createElement('h5');
      title.textContent = `${definition.label}（${items.length}件）`;
      group.append(title);
      items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'ai-import-existing-item';
        const textarea = document.createElement('textarea');
        const editable = { ...item };
        delete editable.id;
        textarea.value = JSON.stringify(editable);
        const actions = document.createElement('div');
        actions.className = 'ai-import-existing-actions';
        const save = document.createElement('button');
        save.type = 'button';
        save.textContent = '更新';
        save.addEventListener('click', () => {
          let parsed;
          try {
            parsed = aiImport.parseAndValidate(type, JSON.stringify({ type, items: [JSON.parse(textarea.value)] }));
          } catch (error) {
            textarea.setCustomValidity(`JSONとして解析できません: ${error.message}`);
            textarea.reportValidity();
            return;
          }
          textarea.setCustomValidity('');
          if (parsed.errors.length > 0) {
            textarea.setCustomValidity(parsed.errors.join('\n'));
            textarea.reportValidity();
            return;
          }
          state.generatedContent[type] = state.generatedContent[type].map((existing) =>
            existing.id === item.id ? { id: item.id, ...parsed.data.items[0] } : existing
          );
          saveState();
          renderImportedContent();
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'secondary';
        remove.textContent = '削除';
        remove.addEventListener('click', () => {
          if (!confirm('この取り込みデータを削除しますか？')) return;
          state.generatedContent[type] = state.generatedContent[type].filter((existing) => existing.id !== item.id);
          saveState();
          renderImportedContent();
        });
        actions.append(save, remove);
        row.append(textarea, actions);
        group.append(row);
      });
      container.append(group);
    });
    if (container.children.length === 0) {
      container.innerHTML = '<p class="small">まだAI生成データはありません。</p>';
    }
  };

  document.getElementById('ai-import-generate').addEventListener('click', () => {
    aiImportMode = 'single';
    const prompt = aiImport.buildGenerationPrompt(aiType.value, Number(document.getElementById('ai-import-count').value), state.character);
    document.getElementById('ai-import-prompt').value = prompt;
    document.getElementById('ai-import-prompt-box').hidden = false;
    document.getElementById('ai-import-validation').textContent = '';
  });
  document.getElementById('ai-import-generate-all').addEventListener('click', () => {
    aiImportMode = 'batch';
    const count = Math.min(10, Math.max(1, Number(document.getElementById('ai-import-count').value) || 1));
    aiImportBatchCount = count;
    document.getElementById('ai-import-count').value = String(count);
    document.getElementById('ai-import-prompt').value = aiImport.buildBatchGenerationPrompt(count, state.character);
    document.getElementById('ai-import-prompt-box').hidden = false;
    document.getElementById('ai-import-validation').textContent = '全種類のJSONを1回だけ貼り付けてください。';
    document.getElementById('ai-import-validation').className = 'ai-import-validation';
  });
  document.getElementById('ai-import-prompt-copy').addEventListener('click', async () => {
    await window.DrowpalPrompt.copyText(document.getElementById('ai-import-prompt').value);
    document.getElementById('ai-import-validation').textContent = 'プロンプトをコピーしました。外部AIへ貼り付けてください。';
    document.getElementById('ai-import-validation').className = 'ai-import-validation is-success';
  });
  aiType.addEventListener('change', () => {
    const isProfile = aiType.value === 'character_profile';
    const maxItems = aiImport.TYPES[aiType.value]?.maxItems || 20;
    document.getElementById('ai-import-count').disabled = isProfile;
    document.getElementById('ai-import-count').max = String(maxItems);
    document.getElementById('ai-import-count').value = isProfile ? '1' : String(Math.min(5, maxItems));
  });

  document.getElementById('ai-import-validate').addEventListener('click', () => {
    const raw = document.getElementById('ai-import-answer').value;
    const validation = aiImportMode === 'batch'
      ? aiImport.parseAndValidateBatch(raw, aiImportBatchCount)
      : aiImport.parseAndValidate(aiType.value, raw);
    const message = document.getElementById('ai-import-validation');
    const fixButton = document.getElementById('ai-import-fix-copy');
    if (validation.errors.length > 0) {
      message.className = 'ai-import-validation is-error';
      message.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = '形式に問題があります。';
      const list = document.createElement('ul');
      list.className = 'ai-import-error-list';
      validation.errors.forEach((error) => {
        const item = document.createElement('li');
        item.textContent = error;
        list.append(item);
      });
      message.append(title, list);
      fixButton.hidden = false;
      fixButton.onclick = async () => {
        const prompt = aiImportMode === 'batch'
          ? aiImport.buildBatchFixPrompt(raw, validation.errors, aiImportBatchCount)
          : aiImport.buildFixPrompt(aiType.value, raw, validation.errors);
        await window.DrowpalPrompt.copyText(prompt);
        message.textContent = '修正依頼プロンプトをコピーしました。外部AIへ貼り付けてください。';
      };
      document.getElementById('ai-import-preview').hidden = true;
      document.getElementById('ai-import-confirm').disabled = true;
      return;
    }
    const preview = aiImportMode === 'batch'
      ? aiImport.previewBatch(validation.data, state.generatedContent)
      : aiImport.preview(
        aiType.value,
        validation.data,
        state.generatedContent[aiType.value] || [],
        state.character
      );
    pendingAiImport = { mode: aiImportMode, type: aiType.value, data: validation.data, preview };
    message.className = 'ai-import-validation is-success';
    message.textContent = aiImportMode === 'batch'
      ? `全種類の形式は正しいです。新規${preview.additions}件、重複${preview.duplicates}件です。`
      : aiType.value === 'character_profile'
      ? `形式は正しいです。既存設定に${preview.changes.length}件の変更があります。`
      : `形式は正しいです。新規${preview.additions.length}件、重複${preview.duplicates.length}件です。`;
    fixButton.hidden = true;
    renderAiPreview(preview);
    document.getElementById('ai-import-preview').hidden = false;
    document.getElementById('ai-import-confirm').disabled =
      aiImportMode === 'batch'
        ? preview.additions === 0
        : preview.additions.length === 0 && preview.changes.length === 0;
  });

  document.getElementById('ai-import-confirm').addEventListener('click', () => {
    if (!pendingAiImport) return;
    const { mode, type, data, preview } = pendingAiImport;
    if (mode === 'batch') {
      Object.entries(preview.byType).forEach(([itemType, typePreview]) => {
        const baseId = nextId(state.generatedContent[itemType]);
        state.generatedContent[itemType].push(...typePreview.additions.map((item, index) => ({
          id: baseId + index,
          ...item
        })));
      });
    } else if (type === 'character_profile') {
      state.character = {
        ...state.character,
        ...data.item,
        examplesList: data.item.examples
      };
      delete state.character.examples;
    } else {
      const baseId = nextId(state.generatedContent[type]);
      state.generatedContent[type].push(...preview.additions.map((item, index) => ({
        id: baseId + index,
        ...item
      })));
    }
    saveState();
    pendingAiImport = null;
    document.getElementById('ai-import-preview').hidden = true;
    document.getElementById('ai-import-validation').textContent = '端末内データへ取り込みました。';
    document.getElementById('ai-import-answer').value = '';
    renderImportedContent();
    renderCharacter();
    renderSettings();
    renderDiscordNotificationSettings();
  });
  document.getElementById('ai-import-cancel').addEventListener('click', () => {
    pendingAiImport = null;
    document.getElementById('ai-import-answer').value = '';
    document.getElementById('ai-import-preview').hidden = true;
    document.getElementById('ai-import-validation').textContent = '';
  });
  document.getElementById('ai-import-refresh').addEventListener('click', renderImportedContent);
  renderImportedContent();

  const discord = window.DrowpalDiscordNotifications;
  const discordWebhookInput = document.getElementById('discord-notification-webhook');
  const discordEnabledInput = document.getElementById('discord-notification-enabled');
  const discordTimeInput = document.getElementById('discord-notification-time');
  const discordStatus = document.getElementById('discord-notification-status');
  let discordSendRunning = false;

  function getDiscordConfigFromForm() {
    return discord.normalizeConfig({
      ...state.discordNotifications,
      enabled: discordEnabledInput.checked,
      webhookUrl: discordWebhookInput.value,
      time: discordTimeInput.value,
      days: [...document.querySelectorAll('.discord-notification-days input:checked')].map((input) => Number(input.value))
    });
  }

  function renderDiscordNotificationSettings() {
    const config = discord.normalizeConfig(state.discordNotifications);
    discordEnabledInput.checked = config.enabled;
    discordWebhookInput.value = config.webhookUrl;
    discordTimeInput.value = config.time;
    document.querySelectorAll('.discord-notification-days input').forEach((input) => {
      input.checked = config.days.includes(Number(input.value));
    });
    const candidates = state.generatedContent.discord_notifications || [];
    document.getElementById('discord-notification-candidates').textContent = `通知候補: ${candidates.length}件`;
    document.getElementById('discord-notification-last-sent').textContent = config.lastSentAt
      ? `最終送信: ${new Date(config.lastSentAt).toLocaleString('ja-JP')}`
      : '未送信';
    discordStatus.textContent = config.lastError || '';
    discordStatus.className = `discord-notification-status${config.lastError ? ' is-error' : ''}`;
  }

  async function sendDiscordMessage(content, slot = '') {
    const config = getDiscordConfigFromForm();
    await discord.sendWebhook(config, content, state.character.name || 'Drowpal');
    state.discordNotifications = {
      ...config,
      lastSentSlot: slot || config.lastSentSlot,
      lastSentAt: new Date().toISOString(),
      lastError: ''
    };
    saveState();
    renderDiscordNotificationSettings();
  }

  async function sendRandomDiscordNotification(slot = '') {
    const candidates = state.generatedContent.discord_notifications || [];
    if (candidates.length === 0) throw new Error('先にAI生成データからDiscord通知文を取り込んでください。');
    const candidate = discord.chooseRandom(candidates);
    await sendDiscordMessage(candidate.text, slot);
    return candidate.text;
  }

  document.getElementById('discord-notification-save').addEventListener('click', () => {
    const config = getDiscordConfigFromForm();
    if (config.webhookUrl && !discord.validateWebhookUrl(config.webhookUrl)) {
      discordStatus.textContent = 'Discord Webhook URLの形式が正しくありません。';
      discordStatus.className = 'discord-notification-status is-error';
      return;
    }
    if (config.days.length === 0) {
      discordStatus.textContent = '送信する曜日を1つ以上選んでください。';
      discordStatus.className = 'discord-notification-status is-error';
      return;
    }
    state.discordNotifications = config;
    saveState();
    renderDiscordNotificationSettings();
    discordStatus.textContent = 'Discord通知設定を保存しました。Drowpalを開いている間に送信されます。';
    discordStatus.className = 'discord-notification-status is-success';
  });

  document.getElementById('discord-notification-test').addEventListener('click', async () => {
    if (discordSendRunning) return;
    discordSendRunning = true;
    try {
      await sendDiscordMessage('DrowpalとDiscordの接続テストです。通知の設定が完了しました。');
      discordStatus.textContent = 'Discordへの接続テストを送信しました。';
      discordStatus.className = 'discord-notification-status is-success';
    } catch (error) {
      discordStatus.textContent = error.message;
      discordStatus.className = 'discord-notification-status is-error';
    } finally {
      discordSendRunning = false;
    }
  });

  document.getElementById('discord-notification-send').addEventListener('click', async () => {
    if (discordSendRunning) return;
    discordSendRunning = true;
    try {
      const text = await sendRandomDiscordNotification();
      discordStatus.textContent = `通知を送信しました: ${text}`;
      discordStatus.className = 'discord-notification-status is-success';
    } catch (error) {
      discordStatus.textContent = error.message;
      discordStatus.className = 'discord-notification-status is-error';
    } finally {
      discordSendRunning = false;
    }
  });

  async function checkDiscordSchedule() {
    if (discordSendRunning || !discord.isDue(state.discordNotifications)) return;
    discordSendRunning = true;
    const slot = discord.scheduleSlot();
    try {
      await sendRandomDiscordNotification(slot);
      discordStatus.textContent = '定時通知をDiscordへ送信しました。';
      discordStatus.className = 'discord-notification-status is-success';
    } catch (error) {
      state.discordNotifications.lastSentSlot = slot;
      state.discordNotifications.lastError = error.message;
      saveState();
      discordStatus.textContent = error.message;
      discordStatus.className = 'discord-notification-status is-error';
    } finally {
      discordSendRunning = false;
    }
  }

  renderDiscordNotificationSettings();
  checkDiscordSchedule();
  window.setInterval(checkDiscordSchedule, 15000);

  document.getElementById('todo-list').addEventListener('click', (event) => {
    const toggleId = Number(event.target.closest('[data-todo-toggle]')?.dataset.todoToggle);
    if (toggleId) {
      const todo = state.todos.find((item) => item.id === toggleId);
      if (todo) todo.done = !todo.done;
      saveState();
      renderTodos();
      return;
    }
    const deleteId = Number(event.target.closest('[data-todo-delete]')?.dataset.todoDelete);
    if (deleteId) {
      state.todos = state.todos.filter((item) => item.id !== deleteId);
      saveState();
      renderTodos();
    }
  });

  document.querySelector('.goal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    state.weeklyGoal = Math.max(1, Number(new FormData(event.currentTarget).get('weeklyGoal')) || 3);
    saveState();
    renderWeeklyGoal();
    showGeneratedMessage('notification_lines', (item) => item.condition === 'goal_changed');
  });

  document.querySelector('.todo-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = new FormData(event.currentTarget).get('title').trim();
    if (!title) return;
    if (state.todos.length >= 100) {
      alert('Todoは100件までです。');
      return;
    }
    state.todos.push({ id: nextId(state.todos), title, done: false });
    event.currentTarget.reset();
    saveState();
    renderTodos();
    showGeneratedMessage('notification_lines', (item) => item.condition === 'todo_added');
  });

  const illustrationForm = document.querySelector('[data-view="illustrations"] form');
  const illustrationImageInput = document.getElementById('illustration-image');
  const illustrationPreview = document.getElementById('illustration-preview');
  let illustrationPreviewUrl = '';
  illustrationImageInput?.addEventListener('change', () => {
    if (illustrationPreviewUrl) URL.revokeObjectURL(illustrationPreviewUrl);
    const file = illustrationImageInput.files?.[0];
    if (!file) {
      illustrationPreview.hidden = true;
      illustrationPreview.removeAttribute('src');
      return;
    }
    illustrationPreviewUrl = URL.createObjectURL(file);
    illustrationPreview.src = illustrationPreviewUrl;
    illustrationPreview.hidden = false;
  });
  illustrationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const imageInput = illustrationForm.querySelector('[name="image"]');
      const imageKey = await setFile(imageInput, 'illustration');
      if (!imageKey) throw new Error('画像ファイルを選択してください。');
      const formData = new FormData(illustrationForm);
      state.illustrations.push({
        id: nextId(state.illustrations),
        title: String(formData.get('title') || '今日の一枚').trim(),
        date: String(formData.get('illustrationDate') || localDate()),
        type: String(formData.get('illustrationType') || '練習'),
        hours: Math.max(0, Number(formData.get('illustrationHours')) || 0),
        imageKey
      });
      saveState();
      illustrationForm.reset();
      illustrationPreview.hidden = true;
      illustrationPreview.removeAttribute('src');
      if (illustrationPreviewUrl) {
        URL.revokeObjectURL(illustrationPreviewUrl);
        illustrationPreviewUrl = '';
      }
      await renderIllustrations();
      await renderCalendar();
      renderCounts();
      renderWeeklyGoal();
      showGeneratedMessage('notification_lines', (item) => item.condition === 'illustration_saved');
      alert('イラストをこの端末に保存しました。');
    } catch (error) {
      alert(error.message);
    }
  });

  const reflectionForm = document.getElementById('reflection-form');
  reflectionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(reflectionForm);
    const evaluations = [...reflectionForm.querySelectorAll('.evaluation-item')].map((item) => ({
      name: item.querySelector('.evaluation-name')?.value.trim() || '',
      score: Number(item.querySelector('.item-score')?.dataset.score || 3),
      reason: item.querySelector('.evaluation-reason')?.value.trim() || '',
      presets: [...item.querySelectorAll('.reason-presets input:checked')].map((input) => input.value)
    })).filter((item) => item.name);
    state.reflections.push({
      id: nextId(state.reflections),
      date: String(formData.get('reflectionDate') || localDate()),
      illustrationId: Number(formData.get('illustrationId')) || null,
      score: Number(formData.get('score')) || 3,
      hours: Math.max(0, Number(formData.get('hours')) || 0),
      note: String(formData.get('note') || ''),
      evaluations
    });
    saveState();
    renderRecent();
    await renderReflectionHistory();
    renderCounts();
    document.dispatchEvent(new CustomEvent('reflections:updated'));
    showGeneratedMessage('notification_lines', (item) => item.condition === 'reflection_saved');
    alert('振り返りをこの端末に保存しました。');
  });

  const characterForm = [...document.querySelectorAll('[data-view="settings"] form')].find((form) => form.elements.name);
  characterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(characterForm);
      const hadImageChanges = [...characterForm.querySelectorAll('input[type="file"]')]
        .some((input) => input.files?.length > 0)
        || expressionDeleteKeys.size > 0
        || expressionResetKeys.size > 0;
      state.character = {
        name: String(formData.get('name') || 'ソラ'),
        personality: String(formData.get('personality') || ''),
        style: String(formData.get('style') || ''),
        greeting: state.character.greeting,
        user_name: String(formData.get('userName') || ''),
        interaction_style: String(formData.get('interactionStyle') || ''),
        profile: String(formData.get('profile') || ''),
        examplesList: formData.getAll('examples').map((value) => String(value).trim()).filter(Boolean).slice(0, 9)
      };
      const nextExpressions = [];
      const names = new Set();
      for (const option of characterForm.querySelectorAll('#pal-image-grid .pal-image-option')) {
        const key = option.dataset.expressionKey;
        const name = key === 'normal'
          ? '通常'
          : String(option.querySelector('.pal-expression-name')?.value || '').trim();
        if (!name || names.has(name)) throw new Error('表情名は空欄や重複にしないでください。');
        names.add(name);
        const input = option.querySelector('input[type="file"]');
        const previous = state.characterImages[key];
        const fallback = DEFAULT_IMAGES[key] || '';
        if (!fallback && !previous && !input?.files?.[0]) {
          throw new Error(`「${name}」の画像を選択してください。`);
        }
        if (input?.files?.[0]) {
          expressionResetKeys.delete(key);
          state.characterImages[key] = await setFile(input, `pal-${key}`);
          await deleteImage(previous);
        } else if (expressionResetKeys.has(key)) {
          await deleteImage(previous);
          delete state.characterImages[key];
        }
        nextExpressions.push({ key, name, fixed: key === 'normal' });
      }
      for (const key of expressionDeleteKeys) {
        if (key === 'normal') continue;
        await deleteImage(state.characterImages[key]);
        delete state.characterImages[key];
      }
      state.characterExpressions = nextExpressions;
      expressionDeleteKeys.clear();
      expressionResetKeys.clear();
      for (const field of ['backgroundImage', 'headerImage', 'stickerImage1', 'stickerImage2', 'stickerImage3']) {
        const input = characterForm.elements[field];
        if (input?.files?.[0]) {
          const previous = state.appearance[field];
          state.appearance[field] = await setFile(input, field);
          await deleteImage(previous);
        }
      }
      for (const { field } of window.DrowpalTheme.FIELDS) {
        state.appearance[field] = String(formData.get(field) || state.appearance[field]);
      }
      state.appearance.uiFont = formData.get('uiFont') === 'soft' ? 'soft' : 'standard';
      state.statusMessage = getGeneratedLine(
        'notification_lines',
        (item) => item.condition === 'settings_saved'
      ) || `${state.character.name}の設定を更新したよ。これからも一緒に進めよう。`;
      saveState();
      await renderCharacter();
      await applyAppearance();
      await renderSettings();
      showGeneratedMessage('notification_lines', (item) => item.condition === 'settings_saved');
      alert(hadImageChanges
        ? '画像を含む設定を保存しました。表示が正しく更新されない場合は、このページを再読み込みしてください。'
        : '設定をこの端末に保存しました。');
    } catch (error) {
      alert(error.message);
    }
  });

  document.querySelectorAll('.appearance-remove-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const action = form.action;
      const key = action.split('/').filter(Boolean).at(-2);
      const mapping = {
        home_background_image: 'backgroundImage',
        home_header_image: 'headerImage',
        home_sticker_image_1: 'stickerImage1',
        home_sticker_image_2: 'stickerImage2',
        home_sticker_image_3: 'stickerImage3'
      };
      const field = mapping[key];
      if (!field) return;
      await deleteImage(state.appearance[field]);
      state.appearance[field] = '';
      saveState();
      await applyAppearance();
      await renderSettings();
    });
  });

  const study = window.DrowpalStudy;
  const studyView = document.querySelector('[data-view="growth"]');
  const studyFields = [...studyView.querySelectorAll('[data-study-field]')];
  const studyData = () => ({ illustrations: state.illustrations, reflections: state.reflections, promptLog: state.promptLog });
  const roundStudy = (value) => Math.round(value * 100) / 100;
  const formatStudyValue = (value, unit) => (value === null || value === undefined ? '—' : `${roundStudy(value)}${unit}`);
  const formatStudyDiff = (value, unit) => {
    if (value === null || value === undefined) return '—';
    return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${roundStudy(Math.abs(value))}${unit}`;
  };
  const getStudyValue = (fieldPath) => fieldPath.split('.').reduce((value, key) => value?.[key], state.study);
  const setStudyValue = (fieldPath, value) => {
    const keys = fieldPath.split('.');
    const last = keys.pop();
    keys.reduce((target, key) => target[key], state.study)[last] = value;
  };
  const studyPeriodLength = (start, end) => (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start
    ? Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1
    : 0);

  const fillStudyTable = (table, headers, rows) => {
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach((text) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = text;
      headRow.append(cell);
    });
    head.append(headRow);
    const body = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.className) tr.className = row.className;
      row.cells.forEach((cellData, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        const { text, className } = typeof cellData === 'object' ? cellData : { text: cellData };
        cell.textContent = text;
        if (className) cell.className = className;
        tr.append(cell);
      });
      body.append(tr);
    });
    table.replaceChildren(head, body);
  };

  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  };

  const renderStudyTrend = () => {
    const select = document.getElementById('study-trend-item');
    const container = document.getElementById('study-trend');
    const previous = select.value || study.OVERALL;
    const names = study.evaluationNames(state.reflections);
    select.replaceChildren(new Option('総合評価', study.OVERALL), ...names.map((name) => new Option(name, name)));
    select.value = [study.OVERALL, ...names].includes(previous) ? previous : study.OVERALL;
    const points = study.trend(state.reflections, select.value);
    container.replaceChildren();
    if (points.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'small';
      empty.textContent = 'まだ振り返りの記録がありません。';
      container.append(empty);
      return;
    }
    const first = points[0].score;
    const last = points[points.length - 1].score;
    const average = roundStudy(points.reduce((sum, point) => sum + point.score, 0) / points.length);
    const summary = document.createElement('p');
    summary.className = 'study-trend-summary';
    summary.textContent = `${points.length}回の記録・最初 ${first} → 最新 ${last}（${formatStudyDiff(last - first, '')}）・平均 ${average}`;

    const width = 320;
    const height = 150;
    const left = 26;
    const right = 10;
    const top = 12;
    const bottom = 26;
    const x = (index) => (points.length === 1 ? (left + width - right) / 2 : left + index * (width - left - right) / (points.length - 1));
    const y = (score) => top + (5 - score) * (height - top - bottom) / 4;
    const chart = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, class: 'study-trend-chart', role: 'img', 'aria-label': `${select.selectedOptions[0]?.textContent || ''}の評価の推移` });
    for (let score = 1; score <= 5; score += 1) {
      chart.append(svgElement('line', { x1: left, x2: width - right, y1: y(score), y2: y(score), class: 'study-trend-grid' }));
      const label = svgElement('text', { x: left - 8, y: y(score) + 4, class: 'study-trend-label', 'text-anchor': 'end' });
      label.textContent = String(score);
      chart.append(label);
    }
    if (points.length > 1) {
      chart.append(svgElement('polyline', { points: points.map((point, index) => `${x(index)},${y(point.score)}`).join(' '), class: 'study-trend-line' }));
    }
    points.forEach((point, index) => {
      const dot = svgElement('circle', { cx: x(index), cy: y(point.score), r: 4, class: 'study-trend-dot' });
      const title = svgElement('title');
      title.textContent = `${point.date}: ${point.score}`;
      dot.append(title);
      chart.append(dot);
    });
    const dateLabels = points.length === 1 ? [[0, 'middle']] : [[0, 'start'], [points.length - 1, 'end']];
    dateLabels.forEach(([index, anchor]) => {
      const label = svgElement('text', { x: x(index), y: height - 6, class: 'study-trend-label', 'text-anchor': anchor });
      label.textContent = points[index].date;
      chart.append(label);
    });

    const list = document.createElement('ol');
    list.className = 'study-trend-list';
    points.slice(-10).reverse().forEach((point) => {
      const item = document.createElement('li');
      const date = document.createElement('span');
      date.textContent = point.date;
      const stars = document.createElement('span');
      stars.className = 'study-trend-stars';
      stars.textContent = `${'★'.repeat(point.score)}${'☆'.repeat(5 - point.score)}`;
      item.append(date, stars);
      list.append(item);
    });
    container.append(summary, chart, list);
  };

  const renderStudy = () => {
    studyFields.forEach((input) => {
      if (document.activeElement !== input) input.value = getStudyValue(input.dataset.studyField) ?? '';
    });
    const data = studyData();
    const period = study.resolvePeriod(data, state.study.period, localDate());
    const summary = study.summarize(data, period.start, period.end);
    document.getElementById('study-period-length').textContent = period.length
      ? `集計期間: ${period.start} 〜 ${period.end}（${period.length}日間）`
      : '終了日が開始日より前になっています。';

    const { baseline } = state.study;
    const baselineLength = studyPeriodLength(baseline.start, baseline.end);
    const warnings = [];
    if (baselineLength && period.length && Math.abs(baselineLength - period.length) > 3) {
      warnings.push(`期間の長さが違います（利用前${baselineLength}日・利用後${period.length}日）。そろえると比較しやすくなります。`);
    }
    if (baselineLength && period.length && baseline.end >= period.start && baseline.start <= period.end) {
      warnings.push('利用前と利用後の期間が重なっています。');
    }
    const warning = document.getElementById('study-period-warning');
    warning.textContent = warnings.join(' ');
    warning.hidden = warnings.length === 0;

    fillStudyTable(document.getElementById('study-compare-table'), ['項目', '利用前', '利用後', '変化'], study.compare(baseline, summary).map((row) => ({
      cells: [
        row.label,
        formatStudyValue(row.before, row.unit),
        formatStudyValue(row.after, row.unit),
        { text: formatStudyDiff(row.diff, row.unit), className: row.diff > 0 ? 'is-up' : row.diff < 0 ? 'is-down' : '' }
      ]
    })));

    const weeks = period.length ? study.weekly(data, period.start, period.end) : [];
    fillStudyTable(document.getElementById('study-weekly-table'), ['週', '描いた日数', '枚数', '制作時間', '振り返り', 'AI相談'], weeks.map((week) => ({
      className: week.days === 0 ? 'is-empty' : '',
      cells: [
        `${week.start.slice(5).replace('-', '/')}〜${week.end.slice(5).replace('-', '/')}`,
        `${week.days}日`,
        `${week.count}枚`,
        `${roundStudy(week.hours)}h`,
        `${week.reflections}回`,
        `${week.prompts}回`
      ]
    })));

    const undatedPrompts = Math.max(0, state.promptHistory.length - state.promptLog.length);
    const promptNote = document.getElementById('study-prompt-note');
    promptNote.textContent = `集計機能を追加する前の相談（${undatedPrompts}件）は日付がないため、AI相談回数に含まれていません。`;
    promptNote.hidden = undatedPrompts === 0;
    renderStudyTrend();
  };

  const onStudyFieldChange = (event) => {
    const input = event.target.closest('[data-study-field]');
    if (!input) return;
    const value = input.dataset.studyField === 'participantId' ? input.value.trim().slice(0, 20) : input.value;
    setStudyValue(input.dataset.studyField, value);
    saveState();
    renderStudy();
  };
  studyView.addEventListener('input', onStudyFieldChange);
  studyView.addEventListener('change', onStudyFieldChange);
  document.getElementById('study-trend-item').addEventListener('change', renderStudyTrend);
  document.addEventListener('view:shown', (event) => {
    if (event.detail?.name === 'growth') renderStudy();
  });

  const downloadText = (content, type, fileName) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  const studyFileName = (extension) => {
    const id = state.study.participantId.replace(/[^\w-]/g, '');
    return `drowpal-study-${id ? `${id}-` : ''}${localDate()}.${extension}`;
  };
  const studyFeedback = document.getElementById('study-export-feedback');
  document.getElementById('study-export-csv').addEventListener('click', () => {
    const exported = study.anonymize(studyData(), state.study, localDate());
    downloadText(study.comparisonCsv(exported), 'text/csv;charset=utf-8', studyFileName('csv'));
    studyFeedback.textContent = '集計表をCSVで保存しました。Excelなどで開けます。';
  });
  document.getElementById('study-export-json').addEventListener('click', () => {
    const exported = study.anonymize(studyData(), state.study, localDate());
    downloadText(JSON.stringify(exported, null, 2), 'application/json', studyFileName('json'));
    studyFeedback.textContent = '詳細データをJSONで保存しました。';
  });
  renderStudy();

  const exportButton = document.getElementById('static-data-export');
  const importInput = document.getElementById('static-data-import');
  const importButton = document.getElementById('static-data-import-button');
  const dataFeedback = document.getElementById('static-data-feedback');
  exportButton?.addEventListener('click', async () => {
    try {
      const backup = {
        version: 1,
        source: 'drowpal-static',
        exportedAt: new Date().toISOString(),
        ...state,
        discordNotifications: { ...state.discordNotifications, webhookUrl: '' },
        characterImages: {},
        appearance: { ...state.appearance },
        illustrations: await Promise.all(state.illustrations.map(async (item) => ({
          ...item,
          imageData: await getStoredDataUrl(item.imageKey),
          imageKey: undefined
        })))
      };
      for (const expression of state.characterExpressions) {
        backup.characterImages[expression.key] = await getStoredDataUrl(state.characterImages[expression.key]);
      }
      for (const field of ['backgroundImage', 'headerImage', 'stickerImage1', 'stickerImage2', 'stickerImage3']) {
        backup.appearance[field] = await getStoredDataUrl(state.appearance[field]);
      }
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `drowpal-backup-${localDate()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      dataFeedback.textContent = 'バックアップファイルを保存しました。';
    } catch (error) {
      dataFeedback.textContent = error.message || 'バックアップを作成できませんでした。';
    }
  });

  importButton?.addEventListener('click', async () => {
    const file = importInput.files?.[0];
    if (!file) {
      dataFeedback.textContent = 'バックアップJSONを選択してください。';
      return;
    }
    try {
      const backup = JSON.parse(await file.text());
      if (backup.version !== 1 || !backup.character || !Array.isArray(backup.todos)
          || !Array.isArray(backup.illustrations) || !Array.isArray(backup.reflections)) {
        throw new Error('対応していないバックアップ形式です。');
      }
      if (!confirm('現在の端末内データをバックアップ内容で置き換えます。よろしいですか？')) return;
      const characterExpressions = normalizeExpressions(backup.characterExpressions || DEFAULT_EXPRESSIONS);
      const characterImages = {};
      for (const expression of characterExpressions) {
        characterImages[expression.key] = await dataUrlToKey(
          backup.characterImages?.[expression.key],
          `import-pal-${expression.key}`
        );
      }
      const illustrations = [];
      for (const item of backup.illustrations) {
        illustrations.push({
          ...item,
          id: Number(item.id) || nextId(illustrations),
          imageKey: await dataUrlToKey(item.imageData, 'import-illustration')
        });
      }
      const appearance = { ...defaultState.appearance };
      for (const field of ['backgroundImage', 'headerImage', 'stickerImage1', 'stickerImage2', 'stickerImage3']) {
        appearance[field] = await dataUrlToKey(backup.appearance?.[field], `import-${field}`);
      }
      for (const { field } of window.DrowpalTheme.FIELDS) {
        if (window.DrowpalTheme.isColor(backup.appearance?.[field])) {
          appearance[field] = backup.appearance[field];
        }
      }
      appearance.uiFont = backup.appearance?.uiFont === 'soft' ? 'soft' : 'standard';
      state = {
        ...defaultState,
        ...backup,
        version: 1,
        character: { ...defaultState.character, ...backup.character },
        characterImages,
        characterExpressions: removeUnusedDefaultExpressions(characterExpressions, characterImages),
        palMotion: backup.palMotion?.regions
          ? { ...backup.palMotion, imageKey: characterImages.normal || 'default' }
          : null,
        appearance,
        discordNotifications: discord.normalizeConfig({
          ...defaultState.discordNotifications,
          ...(backup.discordNotifications || {}),
          webhookUrl: ''
        }),
        generatedContent: { ...defaultState.generatedContent, ...(backup.generatedContent || {}) },
        illustrations,
        reflections: backup.reflections,
        todos: backup.todos,
        weeklyGoal: Number(backup.weeklyGoal) || 3,
        promptHistory: Array.isArray(backup.promptHistory) ? backup.promptHistory : [],
        promptLog: Array.isArray(backup.promptLog) ? backup.promptLog : [],
        study: normalizeStudy(backup.study)
      };
      saveState();
      dataFeedback.textContent = 'バックアップを取り込みました。再読み込みします。';
      window.setTimeout(() => location.reload(), 500);
    } catch (error) {
      dataFeedback.textContent = error.message || 'バックアップを取り込めませんでした。';
    }
  });

  [...document.querySelectorAll('form.reset-form')].at(-1)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirm('この端末のDrowpalデータを全て削除します。よろしいですか？')) return;
    const transaction = fileDb.transaction('files', 'readwrite');
    transaction.objectStore('files').clear();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(window.DrowpalPrompt.SNAPSHOT_KEY);
    location.reload();
  });

  const welcomeCard = document.getElementById('welcome-card');
  const welcomeRestore = document.getElementById('welcome-restore');
  const welcomeKey = 'drowpal-static-welcome-hidden';
  const setWelcomeVisible = (visible) => {
    welcomeCard.hidden = !visible;
    welcomeRestore.hidden = visible;
    localStorage.setItem(welcomeKey, String(!visible));
  };
  setWelcomeVisible(window.innerWidth > 700 || localStorage.getItem(welcomeKey) !== 'true');
  document.getElementById('welcome-close')?.addEventListener('click', () => setWelcomeVisible(false));
  welcomeRestore?.addEventListener('click', () => {
    setWelcomeVisible(true);
    showView('home');
  });

  document.getElementById('home-sticker-settings')?.addEventListener('click', () => {
    showView('settings');
    document.querySelector('.appearance-fieldset')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.querySelectorAll('[data-chat-focus]').forEach((button) => button.addEventListener('click', () => {
    document.querySelector('#chat-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('message').focus();
  }));

  const promptBuilder = window.DrowpalPrompt.createBuilder({
    getContext: currentContext,
    copiedMessage: 'コピーしました。ChatGPTなどへ貼り付けてください。'
  });
  const showPrompt = (message) => {
    promptBuilder.show(message);
    if (!showGeneratedMessage('reaction_lines', (item) => item.situation === 'consult')) {
      showGeneratedMessage('reaction_lines', (item) => item.situation === 'normal');
    }
  };
  document.getElementById('chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('message');
    const message = input.value.trim();
    if (!message) return;
    state.promptHistory.push(message);
    if (state.promptHistory.length > 30) state.promptHistory.shift();
    state.promptLog.push(localDate());
    saveState();
    renderPromptHistory();
    showPrompt(message);
    input.value = '';
    const speech = document.getElementById('character-speech-bubble');
    speech.textContent = '相談の準備ができたよ。コピーして外部AIに貼り付けてね。';
    speech.hidden = false;
  });
  document.querySelectorAll('[data-ai-consult]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelector('#chat-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.DrowpalPrompt.insertTemplate(document.getElementById('message'), button.dataset.aiConsult.trim());
    });
  });

  for (const sticker of document.querySelectorAll('[data-sticker-number]')) {
    const number = sticker.dataset.stickerNumber;
    const key = `drowpal-static-sticker-${number}`;
    let position = { x: 15 + Number(number) * 25, y: 35 + Number(number) * 15 };
    try {
      position = JSON.parse(localStorage.getItem(key)) || position;
    } catch (error) {
      console.warn('[Static sticker] 位置を読み込めませんでした。', error);
    }
    const apply = () => {
      sticker.style.left = `${position.x}%`;
      sticker.style.top = `${position.y}%`;
    };
    apply();
    let drag = null;
    sticker.addEventListener('pointerdown', (event) => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: { ...position } };
      sticker.setPointerCapture(event.pointerId);
    });
    sticker.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const shell = document.querySelector('.app-shell').getBoundingClientRect();
      position.x = Math.min(92, Math.max(8, drag.start.x + (event.clientX - drag.x) / shell.width * 100));
      position.y = Math.min(94, Math.max(6, drag.start.y + (event.clientY - drag.y) / shell.height * 100));
      apply();
    });
    sticker.addEventListener('pointerup', () => {
      drag = null;
      localStorage.setItem(key, JSON.stringify(position));
    });
  }

  let idleTimer = null;
  const resetIdleTimer = () => {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      showGeneratedMessage('idle_lines');
    }, 60000);
  };
  ['pointerdown', 'keydown', 'scroll'].forEach((eventName) => {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  showView(new URLSearchParams(location.search).get('view') || 'home');
});
