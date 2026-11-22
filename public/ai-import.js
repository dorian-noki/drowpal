(function () {
  const TYPES = {
    startup_lines: {
      label: '起動時のセリフ',
      description: 'アプリを開いたときにキャラクターから表示する短いセリフです。',
      fields: [{ name: 'text', label: 'セリフ', type: 'string', min: 1, max: 120 }],
      example: { type: 'startup_lines', items: [{ text: '今日も少しずつ進めていこう。' }] }
    },
    menu_lines: {
      label: 'メニュー画面の固定セリフ',
      description: '各画面を開いたときの短いセリフです。',
      fields: [
        { name: 'menu', label: '画面', type: 'enum', values: ['home', 'reflection', 'calendar', 'illustrations', 'settings'] },
        { name: 'text', label: 'セリフ', type: 'string', min: 1, max: 120 }
      ],
      example: { type: 'menu_lines', items: [{ menu: 'reflection', text: '今日の気づきを一緒に残そう。' }] }
    },
    notification_lines: {
      label: '通知・保存完了のセリフ',
      description: '設定保存や記録保存などの完了時に表示するセリフです。',
      fields: [
        { name: 'condition', label: '発生条件', type: 'enum', values: ['settings_saved', 'reflection_saved', 'illustration_saved', 'todo_added', 'goal_changed'] },
        { name: 'text', label: 'セリフ', type: 'string', min: 1, max: 120 }
      ],
      example: { type: 'notification_lines', items: [{ condition: 'settings_saved', text: '設定を保存したよ。' }] }
    },
    idle_lines: {
      label: '待機中の独り言',
      description: '一定時間操作がないときに、元気をくれる短い独り言です。',
      fields: [{ name: 'text', label: 'セリフ', type: 'string', min: 1, max: 100 }],
      example: { type: 'idle_lines', items: [{ text: 'ひと休みしてからでも大丈夫だよ。' }] }
    },
    greeting_lines: {
      label: '時間帯別の挨拶',
      description: '朝・昼・夕方・夜の挨拶です。',
      fields: [
        { name: 'period', label: '時間帯', type: 'enum', values: ['morning', 'afternoon', 'evening', 'night'] },
        { name: 'text', label: 'セリフ', type: 'string', min: 1, max: 100 }
      ],
      example: { type: 'greeting_lines', items: [{ period: 'morning', text: 'おはよう。今日も少しだけ始めよう。' }] }
    },
    reaction_lines: {
      label: '状況別の反応',
      description: '喜び、落ち込み、集中、相談などの状況に合う反応です。',
      fields: [
        { name: 'situation', label: '状況', type: 'enum', values: ['happy', 'sad', 'focused', 'consult', 'normal'] },
        { name: 'text', label: 'セリフ', type: 'string', min: 1, max: 120 }
      ],
      example: { type: 'reaction_lines', items: [{ situation: 'focused', text: 'いい集中だね。この調子でいこう。' }] }
    },
    discord_notifications: {
      label: 'Discord通知文',
      description: '指定時刻にDrowpalからDiscordへ送る、描画や休息を促す自然な通知文です。内容は毎回異なるものにします。',
      maxItems: 10,
      batchHint: '各文は互いに重複させず、押しつけすぎない短い表現にしてください。',
      fields: [{ name: 'text', label: '通知文', type: 'string', min: 1, max: 500 }],
      example: { type: 'discord_notifications', items: [{ text: '今日は10分だけ、気になるところを描いてみませんか。' }] }
    },
    character_profile: {
      label: 'キャラクター設定',
      description: 'キャラクターのプロフィール全体です。確認後に既存設定を更新します。',
      fields: [
        { name: 'name', label: '名前', type: 'string', min: 1, max: 10 },
        { name: 'personality', label: '性格', type: 'string', min: 1, max: 100 },
        { name: 'style', label: '口調', type: 'string', min: 1, max: 100 },
        { name: 'user_name', label: 'ユーザーの呼び方', type: 'string', min: 1, max: 10 },
        { name: 'interaction_style', label: 'ユーザーへの接し方', type: 'string', min: 1, max: 100 },
        { name: 'profile', label: '背景・プロフィール', type: 'string', min: 0, max: 2000 },
        { name: 'examples', label: 'セリフ例', type: 'stringArray', minItems: 0, maxItems: 9, max: 300 }
      ],
      example: {
        type: 'character_profile',
        item: {
          name: 'ソラ',
          personality: '優しく励ます',
          style: '短く前向きな口調',
          user_name: 'あなた',
          interaction_style: '寄り添って具体的な一歩を提案する',
          profile: 'イラスト制作を続けるための小さな相棒',
          examples: ['今日も少しずつ進めよう。']
        }
      }
    }
  };

  function fieldSpec(definition) {
    return definition.fields.map((field) => {
      if (field.type === 'enum') {
        return `- ${field.name}: 文字列。使用可能な値は ${JSON.stringify(field.values)}`;
      }
      if (field.type === 'stringArray') {
        return `- ${field.name}: 文字列の配列。0〜${field.maxItems}件、各${field.max}文字以内`;
      }
      return `- ${field.name}: 文字列。${field.min}〜${field.max}文字`;
    }).join('\n');
  }

  function buildGenerationPrompt(type, count, character) {
    const definition = TYPES[type];
    if (!definition) throw new Error('取り込み種別が正しくありません。');
    const actualCount = type === 'character_profile'
      ? 1
      : Math.min(definition.maxItems || 20, Math.max(1, Number(count) || 1));
    return [
      '次のアプリ用データをJSONで生成してください。',
      'JSONのみを出力し、説明文、前置き、Markdownコードフェンス、コメントを付けないでください。',
      '',
      `対象キャラクター: ${character?.name || 'ソラ'}`,
      `性格: ${character?.personality || ''}`,
      `口調: ${character?.style || ''}`,
      `ユーザーの呼び方: ${character?.user_name || ''}`,
      `接し方: ${character?.interaction_style || ''}`,
      character?.profile ? `背景・プロフィール: ${character.profile}` : '',
      '',
      `生成する種類: ${type}（${definition.label}）`,
      `生成件数: ${actualCount}`,
      `説明: ${definition.description}`,
      '必須項目と型:',
      fieldSpec(definition),
      definition.batchHint || '',
      '',
      '追加の項目は含めないでください。空文字、JSON null、重複内容は出さないでください。',
      '上記のキャラクター設定を守り、自然で短い日本語にしてください。',
      '必ず次の構造に従ってください:',
      JSON.stringify(definition.example)
    ].filter((line) => line !== null).join('\n');
  }

  function stripCodeFence(raw) {
    const trimmed = String(raw || '').trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
  }

  function validateData(type, candidate) {
    const errors = [];
    const definition = TYPES[type];
    if (!definition) return { data: null, errors: ['取り込み種別が正しくありません。'] };
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { data: null, errors: ['JSONの先頭はオブジェクトである必要があります。'] };
    }
    if (candidate.type !== type) {
      errors.push(`type は "${type}" である必要があります。`);
    }
    const sourceItems = type === 'character_profile' ? [candidate.item] : candidate.items;
    if (type === 'character_profile') {
      if (!candidate.item || typeof candidate.item !== 'object' || Array.isArray(candidate.item)) {
        errors.push('character_profile では item オブジェクトが必要です。');
      }
    } else if (!Array.isArray(candidate.items)) {
      errors.push('items は配列である必要があります。');
    } else if (candidate.items.length < 1 || candidate.items.length > (definition.maxItems || 20)) {
      errors.push(`items は1〜${definition.maxItems || 20}件である必要があります。`);
    }

    const normalized = [];
    for (const [index, rawItem] of (Array.isArray(sourceItems) ? sourceItems : []).entries()) {
      const prefix = type === 'character_profile' ? 'item' : `items[${index}]`;
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        errors.push(`${prefix}: オブジェクトである必要があります。`);
        continue;
      }
      const item = {};
      const allowedFields = new Set(definition.fields.map((field) => field.name));
      Object.keys(rawItem).forEach((key) => {
        if (!allowedFields.has(key)) errors.push(`${prefix}.${key}: 使用できない項目です。`);
      });
      for (const field of definition.fields) {
        const value = rawItem[field.name];
        if (field.type === 'stringArray') {
          if (!Array.isArray(value)) {
            errors.push(`${prefix}.${field.name}: 文字列の配列である必要があります。`);
            continue;
          }
          if (value.length < field.minItems || value.length > field.maxItems) {
            errors.push(`${prefix}.${field.name}: ${field.minItems}〜${field.maxItems}件である必要があります。`);
          }
          const strings = value.filter((entry) => typeof entry === 'string');
          if (strings.length !== value.length) {
            errors.push(`${prefix}.${field.name}: すべて文字列である必要があります。`);
          }
          strings.forEach((entry, entryIndex) => {
            if (entry.trim().length < 1 || entry.trim().length > field.max) {
              errors.push(`${prefix}.${field.name}[${entryIndex}]: 1〜${field.max}文字で入力してください。`);
            }
          });
          item[field.name] = strings.map((entry) => entry.trim());
          continue;
        }
        if (typeof value !== 'string') {
          errors.push(`${prefix}.${field.name}: 文字列である必要があります。`);
          continue;
        }
        const trimmed = value.trim();
        if (trimmed.length < field.min || trimmed.length > field.max) {
          errors.push(`${prefix}.${field.name}: ${field.min}〜${field.max}文字で入力してください。`);
        }
        if (field.type === 'enum' && !field.values.includes(trimmed)) {
          errors.push(`${prefix}.${field.name}: 使用可能な値は ${field.values.join(', ')} です。`);
        }
        item[field.name] = trimmed;
      }
      normalized.push(item);
    }
    return {
      data: errors.length === 0
        ? (type === 'character_profile' ? { type, item: normalized[0] } : { type, items: normalized })
        : null,
      errors
    };
  }

  function parseAndValidate(type, raw) {
    try {
      const value = JSON.parse(stripCodeFence(raw));
      return validateData(type, value);
    } catch (error) {
      return { data: null, errors: [`JSONとして解析できません: ${error.message}`] };
    }
  }

  function buildFixPrompt(type, raw, errors) {
    return [
      buildGenerationPrompt(type, 1, {}),
      '',
      '以下は不適切だった回答です。',
      stripCodeFence(raw),
      '',
      '検出された問題:',
      errors.map((error) => `- ${error}`).join('\n'),
      '',
      '問題を修正し、JSONのみを出力してください。説明文やコードフェンスは付けないでください。'
    ].join('\n');
  }

  function messageTypes() {
    return Object.keys(TYPES).filter((type) => type !== 'character_profile');
  }

  function buildBatchGenerationPrompt(count, character) {
    const actualCount = Math.min(10, Math.max(1, Number(count) || 1));
    const types = messageTypes();
    const schema = {
      type: 'all_messages',
      datasets: types.map((type) => ({ ...TYPES[type].example }))
    };
    return [
      '次のDrowpalアプリ用データを、すべての種別についてまとめてJSONで生成してください。',
      'JSONのみを出力し、説明文、前置き、Markdownコードフェンス、コメントを付けないでください。',
      '',
      `対象キャラクター: ${character?.name || 'ソラ'}`,
      `性格: ${character?.personality || ''}`,
      `口調: ${character?.style || ''}`,
      `ユーザーの呼び方: ${character?.user_name || ''}`,
      `接し方: ${character?.interaction_style || ''}`,
      character?.profile ? `背景・プロフィール: ${character.profile}` : '',
      '',
      `各種別の生成件数: ${actualCount}`,
      '以下の全種別を1件も欠けることなく生成してください。',
      ...types.map((type) => {
        const definition = TYPES[type];
        return [
          `${type}（${definition.label}）: ${definition.description}`,
          fieldSpec(definition),
          definition.batchHint || ''
        ].filter(Boolean).join('\n');
      }),
      '',
      '同じ内容を繰り返さず、全種別を横断してキャラクター設定と口調を統一してください。',
      '追加の項目は含めないでください。空文字、JSON null、重複内容は出さないでください。',
      '必ず次の構造に従い、各種別の配列を指定件数にしてください:',
      JSON.stringify(schema)
    ].filter((line) => line !== null).join('\n');
  }

  function parseAndValidateBatch(raw, expectedCount) {
    let candidate;
    try {
      candidate = JSON.parse(stripCodeFence(raw));
    } catch (error) {
      return { data: null, errors: [`JSONとして解析できません: ${error.message}`] };
    }
    const errors = [];
    const normalized = {};
    const requiredTypes = messageTypes();
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return { data: null, errors: ['JSONの先頭はオブジェクトである必要があります。'] };
    }
    if (candidate.type !== 'all_messages') {
      errors.push('type は "all_messages" である必要があります。');
    }
    if (!Array.isArray(candidate.datasets)) {
      errors.push('datasets は配列である必要があります。');
      return { data: null, errors };
    }
    const seen = new Set();
    candidate.datasets.forEach((dataset, index) => {
      const type = dataset?.type;
      if (!requiredTypes.includes(type)) {
        errors.push(`datasets[${index}].type: 使用できない種別です。`);
        return;
      }
      if (seen.has(type)) {
        errors.push(`datasets[${index}].type: ${type} は重複しています。`);
        return;
      }
      seen.add(type);
      const result = validateData(type, dataset);
      if (result.errors.length > 0) {
        errors.push(...result.errors.map((error) => `datasets[${index}]: ${error}`));
      } else {
        const expected = Math.min(10, Math.max(1, Number(expectedCount) || 0));
        if (expected > 0 && result.data.items.length !== expected) {
          errors.push(`datasets[${index}]: ${type} は${expected}件である必要があります。`);
        }
        normalized[type] = result.data;
      }
    });
    requiredTypes.forEach((type) => {
      if (!seen.has(type)) errors.push(`datasets に ${type} がありません。`);
    });
    if (candidate.datasets.length > requiredTypes.length) {
      errors.push(`datasets は${requiredTypes.length}種別だけを含める必要があります。`);
    }
    return { data: errors.length === 0 ? normalized : null, errors };
  }

  function buildBatchFixPrompt(raw, errors, count) {
    return [
      buildBatchGenerationPrompt(count, {}),
      '',
      '以下は不適切だった回答です。',
      stripCodeFence(raw),
      '',
      '検出された問題:',
      errors.map((error) => `- ${error}`).join('\n'),
      '',
      '問題を修正し、JSONのみを出力してください。説明文やコードフェンスは付けないでください。'
    ].join('\n');
  }

  function itemKey(item) {
    return JSON.stringify(item);
  }

  function preview(type, normalized, existing, character) {
    if (type === 'character_profile') {
      const changes = TYPES.character_profile.fields.map((field) => {
        const current = field.name === 'examples'
          ? character.examplesList || []
          : character[field.name] || '';
        const next = normalized.item[field.name];
        return JSON.stringify(current) === JSON.stringify(next)
          ? null
          : { field: field.name, label: field.label, current, next };
      }).filter(Boolean);
      return { additions: [], duplicates: [], changes, ignored: [] };
    }
    const known = new Set((existing || []).map(itemKey));
    const additions = [];
    const duplicates = [];
    const incomingDuplicates = new Set();
    normalized.items.forEach((item) => {
      const key = itemKey(item);
      if (known.has(key) || incomingDuplicates.has(key)) {
        duplicates.push(item);
      } else {
        incomingDuplicates.add(key);
        additions.push(item);
      }
    });
    return { additions, duplicates, changes: [], ignored: [] };
  }

  function previewBatch(normalized, existing) {
    const byType = {};
    messageTypes().forEach((type) => {
      byType[type] = preview(type, normalized[type], existing?.[type] || [], {});
    });
    const additions = Object.values(byType).reduce((sum, result) => sum + result.additions.length, 0);
    const duplicates = Object.values(byType).reduce((sum, result) => sum + result.duplicates.length, 0);
    return { byType, additions, duplicates, changes: [], ignored: [] };
  }

  window.DrowpalAiImport = {
    TYPES,
    buildGenerationPrompt,
    buildBatchGenerationPrompt,
    parseAndValidate,
    parseAndValidateBatch,
    buildFixPrompt,
    buildBatchFixPrompt,
    preview,
    previewBatch,
    messageTypes,
    itemKey
  };
}());
