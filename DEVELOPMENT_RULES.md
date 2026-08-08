# ⚠️ 開発・デプロイにおける絶対遵守ルール (CRITICAL DEVELOPMENT RULES)

このプロジェクト（MeisiScan / gekiren）を開発するすべてのAIエージェントおよび開発者は、以下のワークフローおよびルールを無条件で完全に遵守しなければなりません。

## 5. AIモデル仕様および API 利用ルール (Gemini 3.6 Flash & DeepSeek V4 Flash)

### ① 使用する最新モデルの絶対的な指定
- **Gemini API 最新モデル**: **`gemini-3.6-flash`**
  - **API仕様上の注意事項 (重要)**: Gemini 3.6 Flash では `temperature` や `top_p` などのサンプリングパラメータが廃止・非推奨となっています。リクエスト時の `generationConfig` 内に `temperature` を含めると API から HTTP 400 エラーが返却されるため、`generationConfig` には `temperature` 等を含めず呼び出してください。
- **DeepSeek API 最新モデル**: **`deepseek-v4-flash`** (284B MoEモデル)
  - **API仕様上の注意事項 (重要)**: 公式 DeepSeek API (`https://api.deepseek.com`) はテキスト・コード専用モデルです。`image_url` 等のマルチモーダル画像データを直接送信すると API から HTTP 400 エラーが返却されるため、画像認識は Gemini 等に任せ、テキストデータ構造化・思考推論フェーズで `deepseek-v4-flash` を使用してください。

### ② サーバー（Worker）接続仕様
- サーバー（Cloudflare Workers プロキシ）およびクライアント側接続先は、上記の最新モデル (`gemini-3.6-flash` ⇄ `deepseek-v4-flash`) を指定・維持してください。

## 6. OTA 配信・ビルドに関する絶対遵守ルール

- **デフォルト環境の原則 (ステージング統一)**: ユーザーから個別に明示的な環境・ブランチ等の指定がない限り、アプリのビルド、デプロイ、OTA配信（`eas update`）などは**すべて「ステージング (`staging`)」環境をデフォルトとして使用する**こと。
- **デフォルト配信先ブランチ**: ユーザーから個別に明示的なブランチ指定がない限り、OTA配信（`eas update`）は原則として **`staging` ブランチ (`--branch staging`)** をデフォルトの配信先とすること。
- **標準配信コマンド**:
  ```powershell
  eas update --platform android --branch staging --message "<更新内容>" --environment preview
  ```
- **デバッグ用ビルド使用禁止の原則**: 本プロジェクトでは、PC側で開発サーバー（Metro等）の起動が必要となるデバッグ用アプリ/ビルド（`assembleDebug` 等）は、ユーザーから個別に明示的な指示がない限り使用しないこと。ローカルビルドを行う際は、JavaScript バンドルがアプリ内に埋め込まれ、PCサーバーなしで単体動作するビルド（`assembleRelease` 等）を必ず使用すること。
- **iOS OTA 配信制限**: iOS版へのステージングOTA (`eas update -p ios`) はユーザーから個別の明確な実行指示がない限り絶対に実行しない（通常の検証配信は Android のみ）。

