# かなトク進捗管理アプリ（kanatoku-rewards）

かなトク（神奈川県のキャッシュレス還元キャンペーン）の還元上限を、決済サービスごとに管理するための単一HTML Webアプリです。複数の決済アプリを併用したときに「どのサービスであと何円分の還元を受けられるか」を横断的に把握し、取りこぼし・無駄打ちを防ぎます。

- サーバー不要・ブラウザ単体で動作（オフライン可）
- データは端末内の localStorage にのみ保存
- バニラ HTML / CSS / JavaScript（フレームワーク・ビルドツール不使用）

## 公開URL

- 本番（main 反映後）: https://iwamoto-lvgs.github.io/kanatoku-rewards/
- PR プレビュー（PR ごと）: `https://iwamoto-lvgs.github.io/kanatoku-rewards/pr-preview/pr-<PR番号>/`
  - PR を作成・更新すると、プレビューURLが当該 PR にコメントで通知されます。

> 公開URLは GitHub Pages の有効化後に到達可能になります（後述「デプロイ」参照）。

## 主な機能

- 複数ユーザー（家族など）の追加・編集・削除・切り替え
- 支払い記録の登録・編集・削除と、実付与額の自動計算
- 1回上限・サービス上限による丸めや上限到達の明示
- ダッシュボード（6サービスの残枠・進捗・目安支払額・達成バッジ）
- 履歴一覧（日付降順、サービス／ユーザーでのフィルタ）
- JSON エクスポート / インポートによるバックアップ・移行

計算ロジックの詳細仕様は `design_handoff_kanatoku_tracker/IMPLEMENTATION_SPEC.md`（正本）を参照してください。実付与額は「理論付与 → 1回上限(1,500円) → サービス残枠(累計2,500円) → 0未満は0とする」の順で算出し、端数は切り捨てます。

## リポジトリ構成

```
.
├── index.html                         # アプリ本体（単一ファイル。これが公開対象）
├── Makefile                           # 開発用タスク（make help で一覧）
├── README.md                          # 本ファイル
├── test/
│   ├── calc.test.js                   # 計算ロジックのテスト（仕様 §2 を検証）
│   └── data.test.js                   # データ初期化（freshData）のテスト
├── .github/workflows/
│   ├── ci.yml                         # PR / main push でテスト実行
│   ├── deploy.yml                     # main を本番公開（gh-pages ルート）
│   └── preview.yml                    # PR ごとに検証用プレビューを公開・通知
└── design_handoff_kanatoku_tracker/   # 設計・仕様の引き継ぎ資料（公開物には含めない）
    ├── IMPLEMENTATION_SPEC.md         # 機能・計算ロジックの確定仕様（正本）
    ├── README.md                      # ビジュアル/レイアウト仕様
    └── かなトク進捗管理アプリ.dc.html  # デザインリファレンス
```

## ローカル開発

依存パッケージのインストールは不要です（Node.js と Python3 があれば動作します）。

```sh
make            # 利用可能なタスク一覧を表示
make serve      # ローカルサーバを起動（http://localhost:8000/）。PORT=3000 等で変更可
make open       # 既定ブラウザでアプリを開く（別ターミナルで serve 起動後に使用）
make test       # 計算ロジックのテストを実行
make build      # 公開用ディレクトリ public/ を生成（index.html + .nojekyll）
make check      # build と test をまとめて実行（CI 相当）
make clean      # 生成物（public/）を削除
```

`index.html` を直接ブラウザで開いても動作しますが、`make serve` 経由での確認を推奨します。

## テスト

計算ロジックは `index.html` 内の純粋関数部分（`@test:start` 〜 `@test:end` のコメントマーカーで囲まれた定数・計算ロジック）を `test/calc.test.js` が抽出し、Node.js 標準のテストランナー（`node:test`）で検証します。単一HTML構成を保ちつつ、本体の実装とテスト対象が乖離しにくい構成です。

```sh
make test
```

検証内容は `IMPLEMENTATION_SPEC.md §2` の受け入れケース表（必ず通すべき7ケース）に加え、端数切り捨て・非負・累積時の上限頭打ち・丸め/上限到達フラグを含みます。データ初期化機能については、同じマーカー方式（`@test:data:start` 〜 `@test:data:end`）で抽出した `freshData` の不変条件（ユーザー1名・記録なし・再シードガードを満たすこと）を `test/data.test.js` が検証します。これらのテストは CI（`ci.yml`）でも PR と main への push 時に自動実行されます。

## デプロイとプレビューの仕組み

GitHub Pages のソースは gh-pages ブランチ（ルート）運用を前提とします。

- 本番（`deploy.yml`）: main への push で `make build` の成果物を gh-pages のルートへ公開します。`pr-preview/` 配下はクリーン対象から除外し、併走する PR プレビューを保持します。
- プレビュー（`preview.yml`）: PR の作成・更新時に `rossjrw/pr-preview-action` で `pr-preview/pr-<番号>/` に検証用サイトを公開し、プレビューURLを当該 PR にコメントで通知します。PR をクローズするとプレビューは自動削除されます。フォークからの PR は書込トークンが無いため対象外です。

### 初回セットアップ（GitHub Pages の有効化）

リポジトリの Settings → Pages で、Source を「Deploy from a branch」、Branch を `gh-pages` / `/ (root)` に設定します（gh-pages ブランチは最初の workflow 実行時に自動生成されます）。`gh` CLI を使う場合の例:

```sh
echo '{"source":{"branch":"gh-pages","path":"/"}}' \
  | gh api -X POST repos/iwamoto-lvgs/kanatoku-rewards/pages --input -
```

## データ保存に関する注意

- データは利用している端末・ブラウザの localStorage にのみ保存され、サーバーには送信されません。
- ブラウザのデータ削除、プライベートモード、別端末への移行などで失われる場合があります。
- 機種変更や他端末への移行、バックアップのために、設定画面からの JSON エクスポートを定期的に行うことを推奨します。
