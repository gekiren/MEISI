# 🥗 栄養管理アプリ向け 共有コード・機能資産ガイド (SHARED RESOURCES)

このドキュメントは、**名刺管理アプリ（MEISI）**で構築された高度な技術アセット（マルチモーダルAI解析、Cloudflare Workers APIプロキシ、オンデバイスOCR、IndexedDBローカルストレージ、CSVデータ連携など）を、**新規の栄養管理アプリ**にそのまま導入・移植するための技術仕様書および導入手順書です。

---

## 📂 共有モジュール構成 (`shared_modules/`)

プロジェクト内の `shared_modules/` フォルダを、新しい栄養管理アプリのプロジェクトルート（または `src/` 配下）にそのままコピーして利用してください。

```
shared_modules/
├── ai/
│   ├── nutritionAiService.js      # 食事写真/成分表示のAI解析 & PFC自動算出（マルチAI自動フォールバック統合）
│   └── geminiNutritionService.js  # Gemini 3.6 Flash 直打ち用栄養解析プロンプト & マルチモーダル通信
├── worker/
│   └── workerIndex.js             # Cloudflare Workers 用 APIプロキシサーバー（APIキー隠蔽 & 無料枠切替）
├── ocr/
│   └── nutritionOcrService.js     # tesseract.js による栄養成分表示ラベルのオフラインOCR解析
├── db/
│   └── nutritionDb.js             # Dexie.js (IndexedDB) による食事記録・食品マスターローカルDB
└── csv/
    └── nutritionCsvService.js     # 食事記録データのCSVエクスポート / インポート・バックアップモジュール
```

---

## 🚀 1. 主な機能と特徴

### ① 食事写真 & 栄養成分表示のマルチモーダルAI解析
- 食事の写真（料理）を撮影・アップロードするだけで、**料理名、推定総カロリー(kcal)、タンパク質(g)、脂質(g)、炭水化物(g)、推定食材リスト**をJSON形式で自動算出します。
- 市販食品の「栄養成分表示ラベル」の写真を解析し、正確なPFCバランス数値を自動抽出します。
- **Gemini 3.6 Flash** ⇄ **DeepSeek V4** への自動フォールバック通信に対応し、混雑時やエラー発生時も止めずに高速動作します。

### ② セキュアな Cloudflare Workers API プロキシ
- フロントエンドアプリ内に Gemini / DeepSeek の API キーを埋め込まずに、安全にAIと通信する仕組みを提供します。
- ユーザーごとの個人APIキー入力や無料お試し通信にも柔軟に対応します。

### ③ オフライン対応 栄養成分表示OCR (`nutritionOcrService.js`)
- インターネット非接続時やAIサーバー混雑時でも、`tesseract.js` (WebAssembly) を用いてスマホ・ブラウザ内で直接画像をテキスト化。
- 「熱量」「たんぱく質」「脂質」「炭水化物」のキーワードを正規表現ルールで自動抽出します。

### ④ 完全ローカル高速DB (`nutritionDb.js`)
- `Dexie.js` (IndexedDB) により、オフラインでも超高速に食事ログや食品データベースを保存・検索可能。

---

## 📦 2. 新プロジェクト側で必要な依存ライブラリ (`package.json`)

栄養管理アプリの `package.json` の `dependencies` に以下のパッケージを追加・インストールしてください。

```json
{
  "dependencies": {
    "dexie": "^4.0.0",
    "tesseract.js": "^5.0.0",
    "lucide-react": "^0.400.0",
    "canvas-confetti": "^1.9.0"
  }
}
```

※ Expo / React Native アプリの場合は、必要に応じて `@react-native-async-storage/async-storage` や `expo-image-picker` を追加してください。

---

## 💻 3. 各モジュールの使い方例

### 【例1】食事写真からPFCバランスを自動解析する
```javascript
import { analyzeMealPhoto } from './shared_modules/ai/nutritionAiService';

// base64画像データ
const base64Image = 'data:image/jpeg;base64,...';

try {
  const result = await analyzeMealPhoto({
    base64Image,
    workerProxyUrl: 'https://your-worker.workers.dev', // または直打ちAPIキー
    onProgress: (statusText) => console.log(statusText)
  });

  if (result.isFood) {
    console.log('料理名:', result.mealName);
    console.log('カロリー:', result.calories, 'kcal');
    console.log('タンパク質:', result.protein, 'g');
    console.log('脂質:', result.fat, 'g');
    console.log('炭水化物:', result.carbs, 'g');
    console.log('推定食材:', result.ingredients);
  } else {
    console.warn('食品以外の画像です:', result.reason);
  }
} catch (error) {
  console.error('解析失敗:', error);
}
```

---

### 【例2】食事ログのDB保存と取得
```javascript
import { nutritionDb } from './shared_modules/db/nutritionDb';

// 食事ログの登録
await nutritionDb.addMealLog({
  date: '2026-07-28',
  mealType: 'lunch', // breakfast, lunch, dinner, snack
  name: '鶏胸肉とブロッコリーのサラダ',
  calories: 350,
  protein: 42.5,
  fat: 8.0,
  carbs: 12.0,
  photoUrl: base64Image
});

// 本日の食事ログ一覧の取得
const todayMeals = await nutritionDb.getMealLogsByDate('2026-07-28');
```

---

### 【例3】食事ログのCSVバックアップ・インポート
```javascript
import { exportMealsToCSV, importMealsFromCSV } from './shared_modules/csv/nutritionCsvService';

// エクスポート（CSVファイルとして自動ダウンロード）
await exportMealsToCSV();

// CSVファイルからの読み込みインポート
const fileInput = document.getElementById('csv-file');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const count = await importMealsFromCSV(file);
  alert(`${count} 件の食事ログを復元しました`);
});
```

---

## 🔒 4. Cloudflare Worker プロキシのデプロイ手順

`shared_modules/worker/workerIndex.js` を Cloudflare Workers にデプロイする場合：

1. `wrangler.jsonc` を作成：
   ```json
   {
     "name": "nutrition-ai-proxy",
     "main": "workerIndex.js",
     "compatibility_date": "2026-01-01"
   }
   ```
2. APIキーのセット：
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put DEEPSEEK_API_KEY
   ```
3. デプロイ実行：
   ```bash
   npx wrangler deploy
   ```
