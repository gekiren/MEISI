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
