# ScreenStudio

Mac に最適化した画面収録・編集デスクトップアプリ。無音デモ動画（X へのポスト用など）の作成に特化しています。

## 機能

- **画面収録** — ディスプレイ全体またはウィンドウ単位でキャプチャ
- **カメラオーバーレイ** — 円形・角丸・四角のピクチャーインピクチャー
- **キャンバスカスタマイズ** — グラジェント背景、パディング、角丸、ドロップシャドウ
- **録画後エディタ**
  - トリム（開始・終了点の調整）
  - ズーム/パン（キーフレームベースのスムーズ補間）
  - テキスト注釈（位置・表示時間・スタイル）
- **エクスポート** — MP4 / WebM、品質・FPS 選択、Downloads 自動保存

## 必要環境

- macOS
- Node.js 18 以上

## セットアップ

```bash
git clone https://github.com/hytawg/test.git
cd test
git checkout claude/mac-screen-recorder-app-IbU6t
npm install
```

## 起動

### Claude Code から

```
/dev
```

### ターミナルから

```bash
npm run dev
```

## ビルド（配布用 .app の生成）

```bash
npm run build
npm run build:mac
```

`out/` フォルダに `ScreenStudio.app` が生成されます。

## 初回起動時の注意

macOS の画面収録権限が必要です。

`システム設定 → プライバシーとセキュリティ → 画面収録` でアプリを許可してください。

## 技術スタック

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide React](https://lucide.dev/)
