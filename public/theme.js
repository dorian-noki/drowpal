(function () {
  // Every color in style.css derives from these CSS variables.
  const FIELDS = [
    { field: 'themeAccent', key: 'theme_accent', cssVar: '--accent', label: 'アクセント', hint: 'ボタン・リンク' },
    { field: 'themeAccentStrong', key: 'theme_accent_strong', cssVar: '--accent-strong', label: '濃いアクセント', hint: '強調・フォーカス' },
    { field: 'themeAccentSub', key: 'theme_accent_sub', cssVar: '--accent-sub', label: 'サブアクセント', hint: 'グラデーション' },
    { field: 'themeBackground', key: 'theme_background', cssVar: '--theme-bg', label: '背景色', hint: '画面の背景' },
    { field: 'themeSurface', key: 'theme_surface', cssVar: '--theme-surface', label: 'パネル色', hint: 'カード・入力欄' },
    { field: 'themeText', key: 'theme_text', cssVar: '--theme-text', label: '文字色', hint: '本文' },
    { field: 'themeMuted', key: 'theme_muted', cssVar: '--theme-muted', label: '補足文字色', hint: '説明・日付' },
    { field: 'themeBorder', key: 'theme_border', cssVar: '--theme-border', label: '枠線色', hint: '区切り線' },
    { field: 'themeOnAccent', key: 'theme_on_accent', cssVar: '--on-accent', label: 'ボタン文字色', hint: 'アクセント上の文字' },
    { field: 'themeSuccess', key: 'theme_success', cssVar: '--success', label: '成功色', hint: '完了・OK' },
    { field: 'themeDanger', key: 'theme_danger', cssVar: '--danger', label: '警告色', hint: '削除・エラー' },
    { field: 'themeShadow', key: 'theme_shadow', cssVar: '--theme-shadow', label: '影の色', hint: 'カードの影' }
  ];

  const PRESETS = [
    {
      id: 'lavender',
      name: 'やさしいパープル',
      note: 'ロゴカラー',
      colors: {
        themeAccent: '#7a70c4',
        themeAccentStrong: '#4a4398',
        themeAccentSub: '#d9b2ec',
        themeBackground: '#f4f2f8',
        themeSurface: '#fcfbfe',
        themeText: '#2e2b40',
        themeMuted: '#6d6982',
        themeBorder: '#e1ddec',
        themeOnAccent: '#ffffff',
        themeSuccess: '#5b9a78',
        themeDanger: '#b9566a',
        themeShadow: '#4a4398'
      }
    },
    {
      id: 'sakura',
      name: '桜ピンク',
      note: 'ふんわり',
      colors: {
        themeAccent: '#d9779f',
        themeAccentStrong: '#b64f7b',
        themeAccentSub: '#f3c3a8',
        themeBackground: '#fff5f9',
        themeSurface: '#fffbfd',
        themeText: '#392d35',
        themeMuted: '#7a6670',
        themeBorder: '#f0dce5',
        themeOnAccent: '#ffffff',
        themeSuccess: '#5b9a78',
        themeDanger: '#c0485a',
        themeShadow: '#b64f7b'
      }
    },
    {
      id: 'suiro',
      name: 'すいろ',
      note: 'さわやか',
      colors: {
        themeAccent: '#4389c9',
        themeAccentStrong: '#2469a8',
        themeAccentSub: '#9fd3e6',
        themeBackground: '#f1f8ff',
        themeSurface: '#fbfdff',
        themeText: '#203142',
        themeMuted: '#5d6f82',
        themeBorder: '#d8e5f1',
        themeOnAccent: '#ffffff',
        themeSuccess: '#4f9a78',
        themeDanger: '#c05060',
        themeShadow: '#2469a8'
      }
    },
    {
      id: 'mori',
      name: 'もり',
      note: '落ち着き',
      colors: {
        themeAccent: '#6b946b',
        themeAccentStrong: '#477447',
        themeAccentSub: '#c9d99a',
        themeBackground: '#f5f8f0',
        themeSurface: '#fcfdf9',
        themeText: '#2a3829',
        themeMuted: '#627062',
        themeBorder: '#dde6d4',
        themeOnAccent: '#ffffff',
        themeSuccess: '#4f8f5a',
        themeDanger: '#b5574f',
        themeShadow: '#477447'
      }
    },
    {
      id: 'night',
      name: 'ナイト',
      note: 'ダーク',
      colors: {
        themeAccent: '#8b86d9',
        themeAccentStrong: '#6f69c5',
        themeAccentSub: '#c79ad6',
        themeBackground: '#202331',
        themeSurface: '#2a2e40',
        themeText: '#f0f1f7',
        themeMuted: '#a9adc2',
        themeBorder: '#3b4058',
        themeOnAccent: '#ffffff',
        themeSuccess: '#7cc59a',
        themeDanger: '#e88a96',
        themeShadow: '#000000'
      }
    }
  ];

  const DEFAULTS = { ...PRESETS[0].colors };
  // The previous built-in default, which was too saturated; treat it as "use the current default".
  const LEGACY_DEFAULTS = {
    themeAccent: '#6c63ff',
    themeAccentStrong: '#5246f7',
    themeBackground: '#f7f5ff',
    themeText: '#1f2430'
  };

  const isColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ''));

  const mixHex = (a, b, weightA) => {
    const channels = [1, 3, 5].map((index) => Math.round(
      parseInt(a.slice(index, index + 2), 16) * weightA + parseInt(b.slice(index, index + 2), 16) * (1 - weightA)
    ));
    return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  };

  const normalize = (values) => {
    const source = values || {};
    const isLegacyDefault = Object.entries(LEGACY_DEFAULTS)
      .every(([field, value]) => String(source[field] || '').toLowerCase() === value);
    if (isLegacyDefault) {
      return { ...DEFAULTS };
    }
    const result = {};
    FIELDS.forEach(({ field }) => {
      if (isColor(source[field])) {
        result[field] = String(source[field]).toLowerCase();
      }
    });
    const base = {
      themeAccent: result.themeAccent || DEFAULTS.themeAccent,
      themeAccentStrong: result.themeAccentStrong || DEFAULTS.themeAccentStrong,
      themeBackground: result.themeBackground || DEFAULTS.themeBackground,
      themeText: result.themeText || DEFAULTS.themeText
    };
    const hasCustomBase = Object.keys(base).some((field) => result[field]);
    // Themes saved before the extra fields existed only have four colors; derive the rest from them.
    const derived = hasCustomBase
      ? {
        themeAccentSub: mixHex(base.themeAccent, '#ffffff', 0.55),
        themeSurface: mixHex(base.themeBackground, '#ffffff', 0.88),
        themeMuted: mixHex(base.themeText, base.themeBackground, 0.68),
        themeBorder: mixHex(base.themeText, base.themeBackground, 0.13),
        themeShadow: base.themeAccentStrong
      }
      : {};
    return { ...DEFAULTS, ...base, ...derived, ...result };
  };

  const toStyle = (values) => {
    const colors = normalize(values);
    return FIELDS.map(({ field, cssVar }) => `${cssVar}: ${colors[field]};`).join(' ');
  };

  const apply = (element, values) => {
    const colors = normalize(values);
    FIELDS.forEach(({ field, cssVar }) => element.style.setProperty(cssVar, colors[field]));
    return colors;
  };

  const api = { FIELDS, PRESETS, DEFAULTS, isColor, normalize, toStyle, apply };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.DrowpalTheme = api;
  }
}());
