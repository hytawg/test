# ScreenStudio

Mac 向け画面収録・編集デスクトップアプリ。無音デモ動画（X へのポストなど）の作成に特化しています。

---

## 機能

| カテゴリ | 内容 |
|---|---|
| 画面収録 | ディスプレイ全体 / ウィンドウ単位 / カスタム領域 |
| カメラオーバーレイ | 円形・角丸・四角の PiP |
| キャンバスカスタマイズ | グラジェント34種 / macOS壁紙 / 単色 / ブラー / カスタム画像 |
| カーソルオーバーレイ | 録画中のマウス位置を白い円で可視化 |
| スムースカーソル | 移動平均フィルタでカーソルの揺れを補正 |
| クリックエフェクト | クリック位置にリップルリングをアニメーション表示 |
| スポットライト | カーソル周辺を明るく残し背景を暗くするオーバーレイ |
| キーボード表示 | 押下したキーショートカットを動画下部にバッジ表示 |
| トリム・カット | 開始／終了点の調整 + 途中区間のカット |
| ズーム | 区間ごとに倍率・フォーカス点を設定 |
| テキスト注釈 | 任意の位置・時間帯にテキストを表示 |
| 速度調整 | 区間ごとに 0.25×〜4.0× に変更 |
| Auto Zoom | カーソル軌跡から自動カメラワークを生成 |
| 動画インポート | 外部動画ファイルをエディタで開いて編集 |
| 録画履歴 | 過去のエクスポートをいつでも再編集 |
| エクスポート | MP4 / WebM / GIF、品質・FPS 選択 |

---

## 必要環境

- macOS（画面収録権限が必要）
- Node.js 18 以上

> **クリックエフェクト・キーボード表示を使う場合**
> グローバルな入力キャプチャに [uiohook-napi](https://github.com/nicehash/uiohook-napi) を使用します。
> macOS 10.15 以降では `システム設定 → プライバシーとセキュリティ → 入力監視` でアプリを許可してください。

---

## セットアップ

```bash
git clone https://github.com/hytawg/test.git
cd test
npm install
npm run dev
```

初回起動時にmacOSから「画面収録」の許可を求められます。
`システム設定 → プライバシーとセキュリティ → 画面収録` でアプリを許可してください。

---

## スクリプト一覧

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run build:mac` | macOS用 `.app` を生成（`out/` に出力） |
| `npm run check` | TypeScript 型チェック |
| `npm run lint` | ESLint |

---

## ディレクトリ構成

```
screenstudio/
├── src/
│   ├── main/                   # Electron メインプロセス
│   │   ├── index.ts            # エントリーポイント・IPCハンドラ
│   │   ├── mouseTracker.ts     # マウス位置・クリック・キー入力のログ
│   │   └── focusEngine.ts      # Auto Zoom 用フォーカス計算
│   ├── preload/
│   │   └── index.ts            # レンダラー↔メイン間の IPC ブリッジ
│   └── renderer/               # React UI（レンダラープロセス）
│       ├── components/
│       │   ├── editor/         # 編集ツール（Trim / Zoom / Text / Speed / Overlay）
│       │   └── ui/             # 汎用UIパーツ（Slider, Toggle）
│       ├── hooks/              # カスタムフック
│       ├── styles/             # グローバル CSS
│       ├── types/              # TypeScript 型定義
│       ├── utils/              # ユーティリティ
│       ├── App.tsx
│       └── main.tsx
├── build/
│   └── entitlements.mac.plist  # macOS コード署名エンタイトルメント
├── public/                     # 静的アセット
├── electron-vite.config.ts
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 使い方

### 1. ソースを選ぶ

左サイドバーの **Source** パネルで録画対象を選択します。

- **Displays** — 画面全体
- **Windows** — 特定アプリのウィンドウ（ブラウザはアドレスバーを自動クロップ）
- **Region** — 任意の矩形領域

### 2. 見た目を整える

**Canvas** パネルで背景・パディング・角丸・シャドウ・アスペクト比を調整します。

### 3. 録画する

画面下部の **Record** ボタン → 3秒カウントダウン後に開始。
録画中は画面上部に **コントロールバー** が表示されます。

| ボタン | 動作 |
|---|---|
| ⏸ | 一時停止 |
| ▶ | 再開 |
| Stop & Edit | 停止してエディタへ |

録画中はマウスの位置・クリック・キー入力が自動でログされ、編集時のオーバーレイに使用されます。

### 4. 編集する

録画停止後、自動的にエディタへ遷移します。

| ツール | 内容 |
|---|---|
| ✂ Trim | 開始・終了点の調整、途中区間のカット |
| 🔍 Zoom | 区間ごとにズームイン・フォーカス点を設定 |
| T Text | テキスト注釈を配置 |
| Canvas | 背景・パディングをエディタ内で変更 |
| ⏱ Speed | 区間ごとに再生速度を変更 |
| ✨ Overlay | 4つのオーバーレイエフェクトを設定（下記参照） |
| Auto Zoom | カーソル軌跡から自動カメラワーク（フォーカスログ有効時） |

#### ✨ Overlay エフェクト

エディタ左ツールバーの **Overlay（✨）** から設定できます。

| エフェクト | 内容 |
|---|---|
| **Smooth Cursor** | 移動平均フィルタでカーソルの揺れを自動補正。Screen.studio 相当の滑らかさ。 |
| **Click Effect** | クリック位置にリップルリングを 0.65 秒かけてアニメーション表示。無音デモでも操作が伝わる。 |
| **Spotlight** | カーソル周辺だけ明るく残し、背景を暗くする放射状グラジェントオーバーレイ。暗くする強さはスライダーで調整。 |
| **Keyboard Display** | 押下したショートカット（例: `⌘C`、`⇧Tab`）を動画下部にバッジ表示。1.4 秒後にフェードアウト。 |

> クリックエフェクトとキーボード表示は録画中に収集されたデータが必要です。インポートした動画では "No data" として無効化されます。

### 5. 動画をインポート・再編集する

左サイドバーの **Files** パネルから既存の動画ファイルを読み込んで編集できます。

| 操作 | 動作 |
|---|---|
| ドラッグ&ドロップ | 動画ファイルをエディタで開く |
| Browse File… | ファイル選択ダイアログ |
| ↩ ボタン（履歴） | 過去のエクスポートを再編集 |

対応形式: `MP4` / `WebM` / `MOV` / `MKV` / `AVI` / `M4V`

### 6. エクスポートする

右パネル下部の **Export** ボタンで出力。全編集内容が反映されます。

| 設定 | 選択肢 |
|---|---|
| Format | MP4 / WebM / GIF |
| Quality | High (8Mbps) / Medium (4Mbps) / Low (2Mbps) |
| FPS | 24 / 30 / 60 |
| 保存先 | Downloads 自動保存 / ダイアログで選択 |

---

## 技術スタック

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide React](https://lucide.dev/)
- [mp4-muxer](https://github.com/Vanilagy/mp4-muxer)（WebCodecs API による H.264 MP4 エクスポート）
- [electron-store](https://github.com/sindresorhus/electron-store)（録画履歴の永続化）
- [uiohook-napi](https://github.com/nicehash/uiohook-napi)（グローバルマウス・キーボードイベントのキャプチャ）
