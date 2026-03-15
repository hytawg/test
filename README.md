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

## 使い方

### 1. ソースを選ぶ（Source）

左サイドバーの **Source** アイコンをクリックし、録画するディスプレイまたはウィンドウを選択します。

### 2. 見た目を整える（Canvas）

**Canvas** パネルで背景・パディング・角丸・アスペクト比を調整します。

| 項目 | 説明 |
|---|---|
| Padding | 録画映像の周囲の余白サイズ |
| Corner Radius | 映像の角の丸み |
| Background | グラジェント / 単色 / ブラー / なし |
| Aspect Ratio | 16:9 / 4:3 / 1:1 / 9:16 / Fill |

### 3. カメラを設定する（Camera）※任意

**Camera** パネルでウェブカメラのオーバーレイを有効にできます。形（円・角丸・四角）・位置・サイズを調整できます。

### 4. 録画する

画面下部の赤い **Record** ボタンをクリックすると 3 秒カウントダウン後に録画開始。

| ボタン | 動作 |
|---|---|
| Record | 録画開始 |
| ⏸ | 一時停止 |
| ▶ | 再開 |
| Stop & Edit | 録画停止してエディタへ |
| ✕ | 録画キャンセル |

### 5. 編集する

録画停止後、自動的にエディタ画面に遷移します。

#### ✂ Trim（トリム）
タイムライン上の紫色のハンドルをドラッグして開始・終了点を調整します。または **Set In** / **Set Out** ボタンでプレイヘッド位置をそのまま設定できます。

#### 🔍 Zoom（ズーム/パン）
**Add at XX:XX** ボタンで現在時刻にキーフレームを追加。ズーム倍率とフォーカス点（2D ピッカー）を設定すると、キーフレーム間がスムーズに補間されます。

#### T Text（テキスト注釈）
テキストツールに切り替えてプレビュー上をクリックするとテキストを配置できます。表示時間・フォントサイズ・色・背景・太字・揃えを個別に設定できます。

### 6. エクスポートする

エディタ左パネル下部の **Export** ボタンをクリック。エクスポート設定は録画前の **Export** パネルで変更できます。

| 設定 | 選択肢 |
|---|---|
| Format | MP4 / WebM |
| Quality | High (8Mbps) / Medium (4Mbps) / Low (2Mbps) |
| FPS | 24 / 30 / 60 |
| 保存先 | Downloads 自動保存 / ダイアログで選択 |

---

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
