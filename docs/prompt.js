(function () {
  const SNAPSHOT_KEY = 'drowpal-prompt-snapshot';
  const MODE_KEY = 'drowpal-prompt-mode';
  const PREVIEW_KEY = 'drowpal-prompt-preview-open';
  const CHARACTER_FIELDS = [
    ['name', '名前'],
    ['personality', '性格'],
    ['style', '口調'],
    ['userName', 'ユーザーの呼び方'],
    ['interactionStyle', 'ユーザーへの接し方'],
    ['profile', '背景・プロフィール'],
    ['examples', 'セリフ例']
  ];

  const cleanLines = (lines) => lines.filter((line) => line !== null && line !== undefined && line !== '').join('\n');

  const normalizeCharacter = (character = {}) => {
    const examples = Array.isArray(character.examplesList)
      ? character.examplesList
      : (Array.isArray(character.examples) ? character.examples : []);
    return {
      name: character.name || 'AI制作パートナー',
      personality: character.personality || '',
      style: character.style || '',
      userName: character.user_name || character.userName || '',
      interactionStyle: character.interaction_style || character.interactionStyle || '',
      profile: character.profile || '',
      examples: examples.map((example) => `- ${example}`).join('\n')
    };
  };

  const normalizeExpressions = (expressions) => (Array.isArray(expressions) ? expressions : [])
    .map((expression) => String(expression?.name || '').trim())
    .filter(Boolean);

  const recentReflections = (reflections) => (Array.isArray(reflections) ? reflections : [])
    .map((reflection, index) => ({ reflection, index }))
    .sort((a, b) => String(b.reflection.date || '').localeCompare(String(a.reflection.date || '')) || b.index - a.index)
    .slice(0, 5)
    .map(({ reflection }) => reflection);

  const formatReflection = (reflection) => {
    const details = Array.isArray(reflection.evaluations)
      ? reflection.evaluations.map((evaluation) => `${evaluation.name}: ${evaluation.score}/5${evaluation.reason ? `（${evaluation.reason}）` : ''}`).join('、')
      : '';
    return `- ${reflection.date || '日付未設定'}: 総合${reflection.score || 0}/5、${reflection.hours || 0}時間${details ? `、${details}` : ''}${reflection.note ? `。メモ: ${reflection.note}` : ''}`;
  };

  const formatWeeklyGoal = (weeklyGoal) => {
    const period = weeklyGoal.period === 'month' ? '月' : '週';
    const type = weeklyGoal.type && weeklyGoal.type !== 'all' ? weeklyGoal.type : 'すべての種類';
    return `${period}・${type}: ${weeklyGoal.count || 0}/${weeklyGoal.goal || 0}枚（${weeklyGoal.start || ''}〜${weeklyGoal.end || ''}）`;
  };

  const todoKey = (todo) => (todo.id !== undefined && todo.id !== null ? `id:${todo.id}` : `title:${todo.title}`);
  const reflectionKey = (reflection) => (reflection.id !== undefined && reflection.id !== null
    ? `id:${reflection.id}`
    : `date:${reflection.date}|${reflection.note || ''}`);

  function buildPrompt(context, userMessage) {
    const character = normalizeCharacter(context?.character);
    const expressions = (Array.isArray(context?.expressions) ? context.expressions : [])
      .map((expression) => String(expression?.name || '').trim())
      .filter(Boolean);
    const reflections = recentReflections(context?.reflections);
    const todos = Array.isArray(context?.todos) ? context.todos.slice(0, 20) : [];
    const weeklyGoal = context?.weeklyGoal;

    const reflectionLines = reflections.length > 0
      ? reflections.map(formatReflection).join('\n')
      : '- まだ振り返り記録はありません。';

    const todoLines = todos.length > 0
      ? todos.map((todo) => `- [${todo.done ? '完了' : '未完了'}] ${todo.title}`).join('\n')
      : '- 現在Todoはありません。';

    return cleanLines([
      '以下の設定を守って、イラスト制作の継続を支えるキャラクターとして会話してください。',
      '',
      `【担当するキャラクター】${character.name}`,
      `名前: ${character.name}`,
      character.personality ? `性格: ${character.personality}` : null,
      character.style ? `口調: ${character.style}` : null,
      character.userName ? `ユーザーの呼び方: ${character.userName}` : null,
      character.interactionStyle ? `ユーザーへの接し方: ${character.interactionStyle}` : null,
      character.profile ? `背景・プロフィール: ${character.profile}` : null,
      character.examples ? `セリフ例:\n${character.examples}` : null,
      expressions.length > 0 ? `現在使える表情名: ${expressions.join('、')}` : null,
      '',
      '【守ってほしいこと】',
      '- 既存の性格、口調、呼び方、価値観を会話全体で維持する。',
      `- ${character.name}として一人称で話し、解説文ではなく自然なセリフで返答する。`,
      '- まず気持ちや状況を理解し、必要なら具体的な次の一歩を短く提案する。',
      '- ユーザーを責めず、独学のモチベーションと継続を支援する。',
      '- 個人情報や秘密情報を推測・要求しない。',
      '- 返答は短めにし、必要に応じて2〜3個の実行可能な選択肢を提示する。',
      '- 以降「【Drowpal 追加情報】」で始まるメッセージが届いたら、前回からの変更点として制作状況を更新して会話を続ける。',
      '',
      '【現在の制作状況】',
      weeklyGoal ? `制作目標: ${formatWeeklyGoal(weeklyGoal)}` : null,
      'Todo:',
      todoLines,
      '最近の振り返り:',
      reflectionLines,
      '',
      '【今回の相談】',
      (userMessage || '').trim(),
      '',
      '上記を踏まえ、キャラクターとして会話を開始してください。'
    ]);
  }

  // Captures what the external AI already knows, so a later prompt can send only the changes.
  function createSnapshot(context, savedAt = new Date().toISOString()) {
    const weeklyGoal = context?.weeklyGoal;
    return {
      savedAt,
      character: normalizeCharacter(context?.character),
      expressions: normalizeExpressions(context?.expressions),
      weeklyGoal: weeklyGoal
        ? {
          count: weeklyGoal.count || 0,
          goal: weeklyGoal.goal || 0,
          period: weeklyGoal.period === 'month' ? 'month' : 'week',
          type: weeklyGoal.type || 'all',
          start: weeklyGoal.start || '',
          end: weeklyGoal.end || ''
        }
        : null,
      todos: (Array.isArray(context?.todos) ? context.todos : [])
        .map((todo) => ({ key: todoKey(todo), title: todo.title, done: Boolean(todo.done) })),
      reflections: (Array.isArray(context?.reflections) ? context.reflections : [])
        .map((reflection) => ({ key: reflectionKey(reflection), line: formatReflection(reflection) }))
    };
  }

  function describeChanges(snapshot, context) {
    const current = createSnapshot(context, snapshot.savedAt);
    const changes = [];

    const previousExpressions = snapshot.expressions || [];
    if (JSON.stringify(previousExpressions) !== JSON.stringify(current.expressions)) {
      changes.push(`使える表情名が更新されました: ${current.expressions.join('、') || 'なし'}`);
    }

    const characterChanges = CHARACTER_FIELDS
      .filter(([field]) => (snapshot.character?.[field] || '') !== current.character[field])
      .map(([field, label]) => (field === 'examples'
        ? `${label}:\n${current.character[field] || '（なし）'}`
        : `${label}: ${current.character[field] || '（なし）'}`));
    if (characterChanges.length > 0) {
      changes.push('キャラクター設定が更新されました。以降はこの設定で話してください。', ...characterChanges);
    }

    const before = snapshot.weeklyGoal;
    const after = current.weeklyGoal;
    if (after && (!before || before.start !== after.start || before.period !== after.period || before.type !== after.type)) {
      changes.push(`制作目標を更新しました: ${formatWeeklyGoal(after)}`);
    } else if (after && (before.count !== after.count || before.goal !== after.goal)) {
      changes.push(`制作目標: ${before.count}/${before.goal}枚 → ${after.count}/${after.goal}枚`);
    }

    const previousTodos = new Map((snapshot.todos || []).map((todo) => [todo.key, todo]));
    const currentTodoKeys = new Set(current.todos.map((todo) => todo.key));
    current.todos.forEach((todo) => {
      const previous = previousTodos.get(todo.key);
      if (!previous) {
        changes.push(`Todo追加: [${todo.done ? '完了' : '未完了'}] ${todo.title}`);
      } else if (!previous.done && todo.done) {
        changes.push(`Todo完了: ${todo.title}`);
      } else if (previous.done && !todo.done) {
        changes.push(`Todoを未完了に戻した: ${todo.title}`);
      }
    });
    (snapshot.todos || []).filter((todo) => !currentTodoKeys.has(todo.key))
      .forEach((todo) => changes.push(`Todo削除: ${todo.title}`));

    const previousReflections = new Map((snapshot.reflections || []).map((reflection) => [reflection.key, reflection.line]));
    current.reflections.forEach((reflection) => {
      if (!previousReflections.has(reflection.key)) {
        changes.push(`新しい振り返り: ${reflection.line.slice(2)}`);
      } else if (previousReflections.get(reflection.key) !== reflection.line) {
        changes.push(`更新された振り返り: ${reflection.line.slice(2)}`);
      }
    });

    return changes;
  }

  function buildDiffPrompt(snapshot, context, userMessage) {
    const changes = describeChanges(snapshot, context);
    const name = normalizeCharacter(context?.character).name;
    return cleanLines([
      '【Drowpal 追加情報】',
      `この会話で設定したキャラクター（${name}）のまま続けてください。前回共有した内容から変わった点だけを伝えます。`,
      '',
      '【前回からの変更】',
      changes.length > 0
        ? changes.map((change) => `- ${change}`).join('\n')
        : '- 制作状況に変更はありません。',
      '',
      '【今回の相談】',
      (userMessage || '').trim()
    ]);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) {
      throw new Error('クリップボードへコピーできませんでした。');
    }
  }

  const readStorage = (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const CHATGPT_PREFILL_LIMIT = 12000;
  function buildChatGptUrl(text) {
    const prompt = String(text || '');
    if (!prompt || prompt.length > CHATGPT_PREFILL_LIMIT) return '';
    return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
  }
  const writeStorage = (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); prompts still work without persistence.
    }
  };

  const loadSnapshot = () => {
    try {
      const snapshot = JSON.parse(readStorage(SNAPSHOT_KEY));
      return snapshot && snapshot.character ? snapshot : null;
    } catch {
      return null;
    }
  };

  function insertTemplate(input, template) {
    if (!input || !template) {
      return;
    }
    const current = input.value.trim();
    if (!current.includes(template)) {
      input.value = current ? `${current}\n${template}` : template;
    }
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }

  function createBuilder({ getContext, copiedMessage = 'コピーしました。外部AIの入力欄へ貼り付けてください。' }) {
    const builder = document.getElementById('prompt-builder');
    const output = document.getElementById('prompt-output');
    const copyButton = document.getElementById('prompt-copy');
    const feedback = document.getElementById('prompt-feedback');
    const summary = document.getElementById('prompt-summary');
    const modeNote = document.getElementById('prompt-mode-note');
    const preview = document.getElementById('prompt-preview');
    const modeInputs = [...document.querySelectorAll('input[name="promptMode"]')];
    const chatGptLink = document.getElementById('prompt-open-chatgpt');
    const launchNote = document.getElementById('prompt-launch-note');
    const diffInput = modeInputs.find((radio) => radio.value === 'diff');
    let lastMessage = '';
    let lastContext = null;

    if (preview) {
      preview.open = readStorage(PREVIEW_KEY) === 'true';
      preview.addEventListener('toggle', () => writeStorage(PREVIEW_KEY, String(preview.open)));
    }

    const selectedMode = () => modeInputs.find((radio) => radio.checked)?.value || 'full';

    const render = () => {
      const snapshot = loadSnapshot();
      if (diffInput) {
        diffInput.disabled = !snapshot;
      }
      if (!snapshot && selectedMode() === 'diff') {
        modeInputs.forEach((radio) => { radio.checked = radio.value === 'full'; });
      }
      const mode = selectedMode();
      output.value = mode === 'diff'
        ? buildDiffPrompt(snapshot, lastContext, lastMessage)
        : buildPrompt(lastContext, lastMessage);
      const chatGptUrl = buildChatGptUrl(output.value);
      if (chatGptLink) {
        chatGptLink.href = chatGptUrl || 'https://chatgpt.com/';
        chatGptLink.classList.toggle('is-unavailable', !chatGptUrl);
        chatGptLink.setAttribute('aria-disabled', String(!chatGptUrl));
        chatGptLink.textContent = chatGptUrl ? 'ChatGPTで入力済みの会話を開く' : 'ChatGPTを開く';
      }
      if (launchNote) {
        launchNote.textContent = chatGptUrl
          ? 'ChatGPTはプロンプトをURLへ入れた状態で開きます。送信前に内容を確認してください。GeminiとClaudeはプロンプトをコピーして貼り付けます。'
          : 'プロンプトが長いため、ChatGPT・Gemini・Claudeすべてで「プロンプトをコピー」を使って貼り付けてください。';
      }
      if (modeNote) {
        modeNote.textContent = snapshot
          ? `前回コピー: ${new Date(snapshot.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}。同じ会話に貼るなら「会話の続き」、新しく始めるなら「新しい会話」を選んでください。`
          : 'まだコピーした記録がないため、全文のプロンプトを作成します。';
      }
      if (summary) {
        const count = output.value.length.toLocaleString('ja-JP');
        summary.textContent = mode === 'diff'
          ? `前回からの変更点と相談内容だけをまとめました（${count}文字）。`
          : `キャラクター設定・制作状況・相談内容をまとめました（${count}文字）。`;
      }
    };

    const applySavedMode = () => {
      const savedMode = readStorage(MODE_KEY);
      const mode = savedMode === 'full' || savedMode === 'diff' ? savedMode : (loadSnapshot() ? 'diff' : 'full');
      modeInputs.forEach((radio) => { radio.checked = radio.value === mode; });
    };
    applySavedMode();
    modeInputs.forEach((radio) => {
      radio.addEventListener('change', () => {
        writeStorage(MODE_KEY, selectedMode());
        if (lastContext) {
          render();
        }
      });
    });

    copyButton?.addEventListener('click', async () => {
      try {
        await copyText(output.value);
        writeStorage(SNAPSHOT_KEY, JSON.stringify(createSnapshot(lastContext)));
        // The pasted conversation now knows the full context, so the next prompt defaults to a diff.
        writeStorage(MODE_KEY, 'diff');
        feedback.textContent = copiedMessage;
        copyButton.textContent = 'コピーしました';
        window.setTimeout(() => {
          copyButton.textContent = 'プロンプトをコピー';
        }, 1800);
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
    document.getElementById('prompt-close')?.addEventListener('click', () => {
      builder.hidden = true;
      feedback.textContent = '';
    });

    return {
      show(message) {
        lastMessage = message;
        lastContext = getContext();
        applySavedMode();
        render();
        builder.hidden = false;
        feedback.textContent = '';
        builder.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
  }

  window.DrowpalPrompt = {
    buildPrompt,
    buildDiffPrompt,
    buildChatGptUrl,
    createSnapshot,
    describeChanges,
    copyText,
    insertTemplate,
    createBuilder,
    SNAPSHOT_KEY
  };
}());
