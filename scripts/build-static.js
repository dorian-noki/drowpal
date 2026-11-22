const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const theme = require('../public/theme.js');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs');
const today = new Date().toISOString().slice(0, 10);
const now = new Date();
const character = {
  id: 1,
  name: 'ソラ',
  personality: '優しく励ましてくれる',
  style: 'やさしく短く、前向き',
  greeting: 'こんにちは。今日の気持ちを一緒に整理しよう。',
  user_name: 'あなた',
  interaction_style: '寄り添いながら次の一歩を提案する',
  profile: '',
  examples: '[]',
  examplesList: []
};
const characterImages = [
  { key: 'normal', label: '通常', src: './assets/default.png' }
];
const appearance = {
  backgroundImage: '',
  headerImage: '',
  stickerImage1: '',
  stickerImage2: '',
  stickerImage3: '',
  uiFont: 'standard',
  ...theme.DEFAULTS
};

const locals = {
  character,
  reflections: [],
  chatHistory: [],
  weeklyGoal: {
    count: 0,
    goal: 3,
    percent: 0,
    start: today,
    end: today
  },
  todos: [],
  maxWeeklyGoal: 50,
  maxTodoLength: 100,
  illustrations: [],
  reflectionCount: 0,
  illustrationCount: 0,
  appearance,
  themeFields: theme.FIELDS,
  themePresets: theme.PRESETS,
  characterStatusMessage: '一緒に続けよう',
  characterImages,
  palImagesJson: JSON.stringify(Object.fromEntries(characterImages.map((image) => [image.key, image.src]))),
  promptContextJson: JSON.stringify({ character, weeklyGoal: { count: 0, goal: 3 }, todos: [], reflections: [] }),
  year: now.getFullYear(),
  month: now.getMonth(),
  monthData: { firstDay: new Date(now.getFullYear(), now.getMonth(), 1), days: [] },
  toDateKey: (date) => date.toISOString().slice(0, 10),
  calendar: {},
  reflectionHistory: [],
  today,
  selectedIllustrationId: null,
  editReflection: null,
  editReflectionJson: 'null'
};

console.log('Rendering static HTML...');
ejs.renderFile(path.join(root, 'views', 'index.ejs'), locals)
  .then((html) => {
    console.log('Preparing static paths...');
    const staticHtml = html
      .replaceAll('href="/style.css"', 'href="./style.css"')
      .replaceAll('src="/prompt.js"', 'src="./prompt.js"')
      .replaceAll('src="/ai-import.js"', 'src="./ai-import.js"')
      .replaceAll('src="/discord-notifications.js"', 'src="./discord-notifications.js"')
      .replaceAll('src="/theme.js"', 'src="./theme.js"')
      .replaceAll('src="/reflection.js"', 'src="./reflection.js"')
      .replaceAll('src="/pal-motion.js"', 'src="./pal-motion.js"')
      .replaceAll('src="/pal-motion-editor.js"', 'src="./pal-motion-editor.js"')
      .replaceAll('src="/app.js"', 'src="./static-app.js"')
      .replaceAll('src="/assets/', 'src="./assets/')
      .replaceAll('src="/favicon.ico"', 'src="./favicon.ico"')
      .replaceAll('action="/character/expressions/delete"', 'action="#"')
      .replaceAll('action="/reset"', 'action="#"')
      .replaceAll('action="/character"', 'action="#"')
      .replaceAll('action="/reflection"', 'action="#"')
      .replaceAll('action="/illustrations"', 'action="#"')
      .replaceAll('action="/todos"', 'action="#"')
      .replaceAll('action="/goals/weekly"', 'action="#"')
      .replace('id="data-transfer-panel" hidden', 'id="data-transfer-panel"')
      .replace('id="ai-import-panel" hidden', 'id="ai-import-panel"')
      .replace('id="discord-notification-panel" hidden', 'id="discord-notification-panel"')
      .replace(/\s*<a class="server-data-link" href="\/api\/export-local-data">旧サーバー版のデータをJSONでダウンロード<\/a>/, '');

    fs.mkdirSync(output, { recursive: true });
    console.log('Writing HTML...');
    fs.writeFileSync(path.join(output, 'index.html'), staticHtml);
    console.log('Copying runtime files...');
    fs.copyFileSync(path.join(root, 'public', 'style.css'), path.join(output, 'style.css'));
    fs.copyFileSync(path.join(root, 'public', 'prompt.js'), path.join(output, 'prompt.js'));
    fs.copyFileSync(path.join(root, 'public', 'ai-import.js'), path.join(output, 'ai-import.js'));
    fs.copyFileSync(path.join(root, 'public', 'discord-notifications.js'), path.join(output, 'discord-notifications.js'));
    fs.copyFileSync(path.join(root, 'public', 'theme.js'), path.join(output, 'theme.js'));
    fs.copyFileSync(path.join(root, 'public', 'reflection.js'), path.join(output, 'reflection.js'));
    fs.copyFileSync(path.join(root, 'public', 'pal-motion.js'), path.join(output, 'pal-motion.js'));
    fs.copyFileSync(path.join(root, 'public', 'pal-motion-editor.js'), path.join(output, 'pal-motion-editor.js'));
    fs.copyFileSync(path.join(root, 'public', 'favicon.ico'), path.join(output, 'favicon.ico'));
    fs.copyFileSync(path.join(root, 'public', 'site.webmanifest'), path.join(output, 'site.webmanifest'));
    const copyDirectory = (source, destination) => {
      fs.mkdirSync(destination, { recursive: true });
      for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const destinationPath = path.join(destination, entry.name);
        if (entry.isDirectory()) {
          copyDirectory(sourcePath, destinationPath);
        } else {
          fs.copyFileSync(sourcePath, destinationPath);
        }
      }
    };
    copyDirectory(path.join(root, 'public', 'assets'), path.join(output, 'assets'));
    console.log('Static Drowpal build created in docs/.');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
