# Drowpal

## GitHub Pages公開版

通常の公開版は `docs/` の静的アプリです。mainへのPush時、GitHub Actionsが `npm run build:static` を実行してGitHub Pagesへデプロイします。

静的版の特徴:

- サーバー、SQLite、Gemini APIを使用しない
- APIキーを必要としない
- キャラクター設定、Todo、振り返り、週または月単位の制作目標をlocalStorageへ保存
- 画像をIndexedDBへ保存
- 会話欄は外部AI向けプロンプトを生成
- ChatGPT・Gemini・Claudeへプロンプトをコピーして利用
- 一度コピーした後は「会話の続き」モードで、前回コピー時からの変更点（キャラクター設定・制作目標・Todo・振り返り）と相談内容だけを渡せる
- 制作目標・Todoの「AIに相談」ボタンは相談欄へテンプレ文を挿入する（プロンプト本文は折りたたみ表示）
- 設定画面から、AI生成のセリフ・キャラクター設定を検証して取り込み
- ブラウザーのサイトデータまたはキャッシュを消すと端末内データも消える

設定画面の「端末内データ」からバックアップJSONを保存できます。

利用者向けの説明は、アプリ内のメニュー「使い方」（`?view=help` を付けたURLで直接開ける）にまとめています。はじめての人に案内するときは、公開URLの末尾に `?view=help` を付けて送ると、使い方ガイドが最初に表示されます。

AI生成データは「起動」「メニュー」「通知」「待機」「時間帯挨拶」「状況反応」「キャラクター設定」の7種類に対応します。AI回答はJSON検証と重複プレビューを通し、ユーザーが確定したものだけを保存します。取り込み済みのメッセージは設定画面で編集・削除できます。

## フォント

「Rounded Mplus 1c」はSIL Open Font License 1.1で提供され、著作権表示とライセンスの同梱によりアプリと一緒に再配布できます。フォント単体での販売はできません。[同梱ライセンス](public/assets/fonts/OFL-MPLUSRounded1c.txt) / [公式配布元](https://github.com/google/fonts/tree/main/ofl/roundedmplus1c)

ローカル確認:

```sh
npm install
npm run build:static
npm run serve:static
```

`http://localhost:4173` を開きます。

## 既存サーバーデータの移行

静的版は設定画面から自身のバックアップJSONを保存・復元できます。旧サーバー移行用のコードは公開版には含めません。

## API接続コードの保持

旧Express/Geminiコードはローカル開発環境にのみ保持し、公開リポジトリの追跡対象から除外します。静的版からは読み込まれず、通常公開版にもAPIキー入力、AI通信ボタン、外部AI API呼び出しはありません。

通常の公開にはGitHub Pagesを使用してください。
