# CLAUDE.md

このリポジトリで作業する際のガイドです。ユーザーのグローバル設定（`~/.claude/CLAUDE.md`）の規約も併せて遵守してください。

## プロジェクト概要

かなトク（神奈川県のキャッシュレス還元キャンペーン）の還元上限を、決済サービスごとに管理する単一HTML Webアプリ。複数の決済アプリを併用したときに「どのサービスであと何円分の還元を受けられるか」を横断的に把握する用途。

- サーバー不要・ブラウザ単体で動作（オフライン可）。データは端末内の localStorage にのみ保存。
- バニラ HTML / CSS / JavaScript。フレームワーク・ビルドツール・依存パッケージは不使用。

## 開発コマンド

Node.js と Python3 があれば動作する（`npm install` 不要）。

```sh
make            # タスク一覧（help）
make serve      # ローカルサーバ起動（既定 http://localhost:8000/、PORT= で変更）
make test       # 計算ロジック・データ初期化のテスト（node --test）
make build      # 公開用 public/ を生成（index.html + .nojekyll）
make check      # build + test（CI 相当）
make clean      # public/ を削除
```

## コード構成

```
index.html                          # アプリ本体。単一ファイルで、これが公開対象
test/calc.test.js                   # 計算ロジックのテスト（仕様 §2）
test/data.test.js                   # freshData（初期状態）のテスト
.github/workflows/                  # ci.yml / deploy.yml / preview.yml
design_handoff_kanatoku_tracker/    # 設計・仕様の引き継ぎ資料（非公開・公開物に含めない）
  IMPLEMENTATION_SPEC.md            # 機能・計算ロジックの確定仕様（正本）
```

仕様で迷ったら `design_handoff_kanatoku_tracker/IMPLEMENTATION_SPEC.md` を正本として参照する。

## アーキテクチャ（index.html 内）

すべて `index.html` の `<script>` 内にある。おおまかな層は以下の順で並ぶ。

- 定数（`SERVICES`、各種上限・還元率、`STORAGE_KEY`）と純粋な計算ロジック。
- 保存層ラッパー（`loadData` / `saveData`。localStorage 依存はここに閉じる）。
- アプリ状態（`STATE`：`tab` / `recordForm` / `historyFilter`、`DATA`：`version` / `activeUserId` / `users[]` / `payments[]`）。
- 集計（`replay` / `commit` / `serviceTotals` / `previewPrior`）。
- 描画（`render` がタブに応じて `renderHome` / `renderRecord` / `renderHistory` / `renderSettings` を呼び、`innerHTML` 後に各 `bind*()` を実行）。
- イベント処理（`document` への click 委譲。要素の `data-action` 属性で分岐）。
- 起動（`init`）。

主なデータフロー：

- 入力 → `STATE.recordForm` を更新 → `saveRecord` が `DATA.payments` を変更 → `commit()` が全ユーザーの `grantedAmount` を再計算して `saveData`。
- `init()` は `loadData()` を試み、データが無ければ `freshData()`（既定ユーザー1名・記録なしの初期状態）で開始する。
- UI を増やすときは `data-action` を付けてイベント委譲の `switch` に分岐を足すのが既存パターン。

## 計算ロジック（仕様 §2 由来・順序固定）

実付与額は次の順で算出し、端数は切り捨てる（`calcGrant`）。

1. 理論付与 = 支払額 × 還元率
2. 1回上限（`PER_TX_CAP` = 1,500円）で頭打ち
3. サービス残枠（`SERVICE_CAP` = 2,500円 − 既付与累計）で頭打ち
4. 0未満は 0 とし、`Math.floor` で整数化

累計付与は `replay()` が「日付昇順 → id昇順（登録順）」で確定的に再生する。`previewPrior` と `commit` はこの並びと一致させる必要がある。`calcBreakdown` はプレビュー用に途中経過と丸め・上限到達フラグを返す。

## 実装上の注意

- 実装を行ったら、/review:loopコマンドを利用してチェックと修正 / PR作成まで行う。
- 単一ファイル構成を維持する。モジュール分割やビルド導入はしない（公開物は `index.html` 単体）。
- テスト抽出マーカーを壊さないこと。`test/*.test.js` は `index.html` を正規表現で読み、`vm` で評価する。
  - 計算ロジック・定数は `@test:start` 〜 `@test:end` の区間に置く。この区間は `document` / `localStorage` 等に依存させない（純粋関数のみ）。
  - `freshData` は `@test:data:start` 〜 `@test:data:end` の区間に置く。
- ユーザー入力を `innerHTML` テンプレートへ差し込む箇所は `esc()` でエスケープする。
- `<button>` をカードとして使う場合、`display:block` でも幅は内容に合わせて縮む（fit-content）。親幅まで広げるには明示的に `width` を指定する（`.svc-card` は `width:100%`、`.summary` は左右マージン分を引いた `width:calc(100% - 40px)`）。

## デプロイ

GitHub Pages は gh-pages ブランチ（ルート）運用。

- 本番（`deploy.yml`）：main への push で `make build` の成果物を gh-pages のルートへ公開。
- プレビュー（`preview.yml`）：PR ごとに `pr-preview/pr-<番号>/` へ公開し、URL を PR にコメント。

## コミット・PR

ユーザーのグローバル設定に従う（コミットは1行・トレーラ無し・意味の単位で分割、PR はユーザー主導で原則 draft）。コミットメッセージは日本語で、`feat:` / `fix:` / `docs:` / `test:` / `ci:` / `chore:` のプレフィックスを用いる慣習。
