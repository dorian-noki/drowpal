(function attachStudy(root) {
  const OVERALL = '__overall__';

  const pad = (value) => String(value).padStart(2, '0');
  const toKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const parseKey = (key) => {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const round = (value) => Math.round(value * 100) / 100;
  const toNumber = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const inRange = (date, start, end) => isDateKey(date)
    && (!start || date >= start)
    && (!end || date <= end);
  const daysBetween = (start, end) => Math.round((parseKey(end) - parseKey(start)) / 86400000) + 1;
  const mondayOf = (key) => {
    const date = parseKey(key);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return toKey(date);
  };
  const addDays = (key, days) => {
    const date = parseKey(key);
    date.setDate(date.getDate() + days);
    return toKey(date);
  };

  const normalizeData = (data = {}) => ({
    illustrations: Array.isArray(data.illustrations) ? data.illustrations : [],
    reflections: Array.isArray(data.reflections) ? data.reflections : [],
    promptLog: Array.isArray(data.promptLog) ? data.promptLog.filter(isDateKey) : []
  });

  // Illustration time falls back to the longest linked reflection time for older records without it.
  const illustrationHours = (illustration, reflections) => {
    const own = Number(illustration?.hours) || 0;
    if (own > 0) return own;
    return reflections
      .filter((reflection) => String(reflection.illustrationId) === String(illustration?.id))
      .reduce((max, reflection) => Math.max(max, Number(reflection.hours) || 0), 0);
  };

  const firstRecordDate = (input) => {
    const data = normalizeData(input);
    const dates = [
      ...data.illustrations.map((item) => item.date),
      ...data.reflections.map((item) => item.date),
      ...data.promptLog
    ].filter(isDateKey).sort();
    return dates[0] || '';
  };

  const resolvePeriod = (input, period = {}, today = toKey(new Date())) => {
    const start = isDateKey(period.start) ? period.start : (firstRecordDate(input) || today);
    const end = isDateKey(period.end) ? period.end : today;
    return { start, end, length: end >= start ? daysBetween(start, end) : 0 };
  };

  const summarize = (input, start, end) => {
    const data = normalizeData(input);
    const illustrations = data.illustrations.filter((item) => inRange(item.date, start, end));
    const reflections = data.reflections.filter((item) => inRange(item.date, start, end));
    return {
      days: new Set(illustrations.map((item) => item.date)).size,
      count: illustrations.length,
      hours: round(illustrations.reduce((sum, item) => sum + illustrationHours(item, data.reflections), 0)),
      reflections: reflections.length,
      reflectionDays: new Set(reflections.map((item) => item.date)).size,
      prompts: data.promptLog.filter((date) => inRange(date, start, end)).length
    };
  };

  const METRICS = [
    { key: 'days', label: '制作日数', unit: '日', baseline: true },
    { key: 'count', label: '制作枚数', unit: '枚', baseline: true },
    { key: 'hours', label: '制作時間', unit: 'h', baseline: true },
    { key: 'reflections', label: '振り返り回数', unit: '回', baseline: false },
    { key: 'reflectionDays', label: '振り返りをした日数', unit: '日', baseline: false },
    { key: 'prompts', label: 'AI相談回数', unit: '回', baseline: false }
  ];

  const compare = (baseline = {}, after = {}) => METRICS.map((metric) => {
    const before = metric.baseline ? toNumber(baseline[metric.key]) : null;
    const value = toNumber(after[metric.key]);
    return {
      ...metric,
      before,
      after: value,
      diff: before === null || value === null ? null : round(value - before)
    };
  });

  const weekly = (input, start, end) => {
    if (!isDateKey(start) || !isDateKey(end) || end < start) return [];
    const weeks = [];
    for (let weekStart = mondayOf(start); weekStart <= end; weekStart = addDays(weekStart, 7)) {
      const from = weekStart < start ? start : weekStart;
      const weekEnd = addDays(weekStart, 6);
      const to = weekEnd > end ? end : weekEnd;
      weeks.push({ start: from, end: to, ...summarize(input, from, to) });
    }
    return weeks;
  };

  const daily = (input, start, end) => {
    const data = normalizeData(input);
    const dates = new Set([
      ...data.illustrations.map((item) => item.date),
      ...data.reflections.map((item) => item.date),
      ...data.promptLog
    ].filter((date) => inRange(date, start, end)));
    return [...dates].sort().map((date) => ({ date, ...summarize(data, date, date) }));
  };

  const evaluationNames = (reflections = []) => {
    const counts = new Map();
    reflections.forEach((reflection) => reflection.evaluations?.forEach((evaluation) => {
      const name = String(evaluation?.name || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  };

  const trend = (reflections = [], name = OVERALL) => reflections
    .map((reflection) => {
      if (name === OVERALL) return { date: reflection.date, score: Number(reflection.score) || 0, id: reflection.id };
      const evaluation = reflection.evaluations?.find((item) => item?.name === name);
      return evaluation ? { date: reflection.date, score: Number(evaluation.score) || 0, id: reflection.id } : null;
    })
    .filter((point) => point && isDateKey(point.date) && point.score >= 1 && point.score <= 5)
    .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.id) || 0) - (Number(b.id) || 0))
    .map(({ date, score }) => ({ date, score }));

  const normalizeBaseline = (baseline = {}) => ({
    start: isDateKey(baseline.start) ? baseline.start : '',
    end: isDateKey(baseline.end) ? baseline.end : '',
    days: toNumber(baseline.days),
    count: toNumber(baseline.count),
    hours: toNumber(baseline.hours)
  });

  // Only dates and numbers leave the device: no images, titles, notes, reasons, or prompt text.
  const anonymize = (input, study = {}, today = toKey(new Date())) => {
    const data = normalizeData(input);
    const period = resolvePeriod(data, study.period, today);
    const baseline = normalizeBaseline(study.baseline);
    const summary = summarize(data, period.start, period.end);
    return {
      format: 'drowpal-study',
      version: 1,
      exportedAt: new Date().toISOString(),
      participantId: String(study.participantId || '').trim(),
      baseline: {
        ...baseline,
        length: baseline.start && baseline.end && baseline.end >= baseline.start ? daysBetween(baseline.start, baseline.end) : null
      },
      period,
      summary,
      comparison: compare(baseline, summary).map(({ key, label, unit, before, after, diff }) => ({ key, label, unit, before, after, diff })),
      weekly: weekly(data, period.start, period.end),
      daily: daily(data, period.start, period.end),
      illustrations: data.illustrations
        .filter((item) => inRange(item.date, period.start, period.end))
        .map((item) => ({ date: item.date, type: item.type || '', hours: round(illustrationHours(item, data.reflections)) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      reflections: data.reflections
        .filter((item) => inRange(item.date, period.start, period.end))
        .map((item) => ({
          date: item.date,
          score: Number(item.score) || null,
          hours: Number(item.hours) || 0,
          evaluations: (item.evaluations || []).map((evaluation) => ({ name: evaluation.name, score: Number(evaluation.score) || null }))
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      prompts: data.promptLog.filter((date) => inRange(date, period.start, period.end)).sort()
    };
  };

  const csvCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const toCsv = (rows) => `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;

  const comparisonCsv = (exported) => toCsv([
    ['参加者ID', '項目', '単位', '利用前', '利用後', '変化', '利用前期間', '利用後期間'],
    ...exported.comparison.map((row) => [
      exported.participantId,
      row.label,
      row.unit,
      row.before,
      row.after,
      row.diff,
      exported.baseline.start && exported.baseline.end ? `${exported.baseline.start}〜${exported.baseline.end}` : '',
      `${exported.period.start}〜${exported.period.end}`
    ])
  ]);

  const api = {
    OVERALL,
    METRICS,
    illustrationHours,
    firstRecordDate,
    resolvePeriod,
    summarize,
    compare,
    weekly,
    daily,
    evaluationNames,
    trend,
    anonymize,
    toCsv,
    comparisonCsv
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DrowpalStudy = api;
}(typeof window !== 'undefined' ? window : globalThis));
