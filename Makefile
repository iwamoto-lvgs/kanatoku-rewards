# かなトク進捗管理アプリ 開発用タスク
# 使い方: `make` または `make help` で一覧を表示

PORT       ?= 8000
PUBLIC_DIR ?= public

.DEFAULT_GOAL := help
.PHONY: help serve open build test check clean

help: ## このヘルプを表示
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-8s\033[0m %s\n", $$1, $$2}'

serve: ## ローカルサーバを起動 (既定 http://localhost:8000/, 変更は PORT=...)
	@echo "http://localhost:$(PORT)/ で配信中 (Ctrl+C で停止)"
	@python3 -m http.server $(PORT)

open: ## 既定ブラウザでアプリを開く (別ターミナルで serve 起動後に使用)
	@open "http://localhost:$(PORT)/" 2>/dev/null || open index.html

build: ## 公開用ディレクトリ (public/) を生成
	@test -n "$(PUBLIC_DIR)" || { echo "PUBLIC_DIR が空です" >&2; exit 1; }
	@rm -rf "$(PUBLIC_DIR)"
	@mkdir -p "$(PUBLIC_DIR)"
	@cp index.html "$(PUBLIC_DIR)/"
	@touch "$(PUBLIC_DIR)/.nojekyll"
	@echo "built -> $(PUBLIC_DIR)/"

test: ## 計算ロジックのテストを実行 (仕様 §2)
	@node --test test/*.test.js

check: build test ## build と test をまとめて実行 (CI 相当)

clean: ## 生成物を削除
	@rm -rf "$(PUBLIC_DIR)"
