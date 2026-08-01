/**
 * Cloudflare Worker Proxy for MeisiScan AI Analysis
 * Gemini 3.6 Flash ⇄ DeepSeek V4 Automatic Fallback
 */

export default {
  async fetch(request, env, ctx) {
    // CORS ヘッダー
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 名刺解析エンドポイント
    if (url.pathname === '/api/analyze-card' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { image, ocrHintText, scanOptions } = body;

        if (!image) {
          return new Response(JSON.stringify({ error: '名刺画像データ (image) が必要です。' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const result = await analyzeCardWithFallback(image, env, ocrHintText, scanOptions);

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        console.error('Worker Analysis Error:', err);
        return new Response(JSON.stringify({ error: err.message || 'AI解析プロキシでエラーが発生しました。' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ message: 'MeisiScan Cloudflare Worker Proxy API' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

async function analyzeCardWithFallback(base64Image, env, ocrHintText = '', scanOptions = {}) {
  const geminiKey = env.GEMINI_API_KEY;
  const deepSeekKey = env.DEEPSEEK_API_KEY;

  // 1. まず Gemini 3.6 Flash を呼び出し
  if (geminiKey) {
    try {
      console.log('Worker: Calling Gemini 3.6 Flash...');
      return await callGemini36Flash(base64Image, geminiKey, ocrHintText, scanOptions);
    } catch (geminiError) {
      console.warn('Worker: Gemini 3.6 Flash failed:', geminiError.message);
      if (deepSeekKey) {
        console.log('Worker: Falling back to DeepSeek V4...');
        return await callDeepSeekV4(base64Image, deepSeekKey, ocrHintText, scanOptions);
      }
      throw geminiError;
    }
  }

  // 2. Geminiキーがなく DeepSeekキーのみある場合
  if (deepSeekKey) {
    console.log('Worker: Calling DeepSeek V4 directly...');
    return await callDeepSeekV4(base64Image, deepSeekKey, ocrHintText, scanOptions);
  }

  throw new Error('Cloudflare Worker に API キーが設定されていません。');
}

async function callGemini36Flash(base64Image, apiKey, ocrHintText = '', scanOptions = {}) {
  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image || '';

  if (cleanBase64.includes(';base64,')) {
    const parts = cleanBase64.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    cleanBase64 = parts[1];
  } else if (cleanBase64.startsWith('data:')) {
    const parts = cleanBase64.split(',');
    mimeType = parts[0].replace('data:', '').replace(';base64', '') || 'image/jpeg';
    cleanBase64 = parts[1] || '';
  }

  // 余分な改行コードを除去
  cleanBase64 = cleanBase64.trim();

  const hintPrompt = ocrHintText ? `\n【参考：オンデバイスOCR事前抽出テキスト】\n${ocrHintText}\n` : '';

  let modePrompts = [];
  if (scanOptions.isVertical) {
    modePrompts.push('※注意【縦書きレイアウト名刺モード】: この名刺は縦書きで記載されています。文字は上から下、行は右から左の縦方向配置と意識して氏名・役職・会社名を特定してください。');
  }
  if (scanOptions.isDesignCard) {
    modePrompts.push('※注意【デザイン・カラー名刺モード】: この名刺はカラフルな背景・複雑なグラフィックノイズ・ロゴマーク・変形フォントが含まれる場合があります。背景ノイズを分離し、本来のテキスト要素を正確に検出してください。');
  }
  if (scanOptions.isMultiScan) {
    modePrompts.push('※注意【複数名刺モード (最大4枚まで)】: この画像には最大4枚までの名刺が並べて撮影されている可能性があります。画像内の各名刺を個別に検出・区別し、それぞれの名刺情報を `cards` 配列として出力してください。');
  }
  const modeInstruction = modePrompts.length > 0 ? `\n${modePrompts.join('\n')}\n` : '';

  const prompt = scanOptions.isMultiScan ? `
あなたは名刺情報の高精度解析AIです。添付画像に写っている各名刺（最大4枚）から、記載されている情報をそれぞれ正確に抽出して指定のJSONフォーマットで返却してください。
${modeInstruction}${hintPrompt}
余計な説明やMarkdown修飾は含めず、純粋なJSONオブジェクトのみを出力してください。
添付画像が名刺ではない場合（エラー画面のスクリーンショット、スマホ画面、キーボード、風景、書籍、名刺と無関係な写真など）、"isBusinessCard": false, "reason": "名刺画像を検知できませんでした。名刺がはっきりと写っている画像でお試しください。" にしてください。

【返却フォーマット】
{
  "isBusinessCard": true,
  "cards": [
    {
      "name": "氏名",
      "reading": "フリガナ",
      "company": "会社名",
      "department": "部署名",
      "title": "役職名",
      "phone": "固定電話番号",
      "mobile": "携帯電話番号",
      "email": "メールアドレス",
      "postalCode": "郵便番号",
      "address": "住所",
      "website": "WebサイトURL",
      "memo": "その他特記事項",
      "tags": ["検出キーワード"]
    }
  ]
}
` : `
あなたは名刺情報の高精度解析AIです。添付された名刺画像から、記載されている情報を正確に抽出して指定のJSONフォーマットで返却してください。
${modeInstruction}${hintPrompt}
余計な説明やMarkdown修飾は含めず、純粋なJSONオブジェクトのみを出力してください。
添付画像が名刺ではない場合（エラー画面のスクリーンショット、アプリ画面、キーボード、風景、書籍、名刺と無関係な写真など）、"isBusinessCard": false, "reason": "名刺画像を検知できませんでした。名刺がはっきりと写っている画像でお試しください。" にし、各項目は空文字 "" にしてください。
判別できる名刺の場合は "isBusinessCard": true にしてください。

【返却フォーマット】
{
  "isBusinessCard": true,
  "name": "氏名",
  "reading": "フリガナ",
  "company": "会社名",
  "department": "部署名",
  "title": "役職名",
  "phone": "固定電話番号",
  "mobile": "携帯電話番号",
  "email": "メールアドレス",
  "postalCode": "郵便番号",
  "address": "住所",
  "website": "WebサイトURL",
  "memo": "特記事項",
  "tags": ["検出キーワード"]
}
`;

  // モデル名のフォールバックリスト (gemini-3.6-flash -> gemini-1.5-flash)
  const candidateModels = ['gemini-3.6-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: cleanBase64 } }
            ]
          }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API (${modelName}) HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let cleanJson = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }
      return JSON.parse(cleanJson);
    } catch (err) {
      console.warn(`Worker: ${modelName} call failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Gemini API呼び出しに失敗しました。');
}

async function callDeepSeekV4(base64Image, apiKey, ocrHintText = '', scanOptions = {}) {
  let modePrompts = [];
  if (scanOptions.isVertical) {
    modePrompts.push('※注意【縦書きレイアウト名刺モード】: この名刺は縦書きで記載されています。');
  }
  if (scanOptions.isDesignCard) {
    modePrompts.push('※注意【デザイン・カラー名刺モード】');
  }
  if (scanOptions.isMultiScan) {
    modePrompts.push('※注意【複数名刺モード】: このテキストには1枚または複数枚（最大4枚）の名刺情報が含まれています。文字化けやレイアウトの乱れがあっても文脈から判別し、各名刺の要素を区別して `cards` 配列として出力してください。');
  }
  const modeInstruction = modePrompts.length > 0 ? `\n${modePrompts.join('\n')}\n` : '';

  const prompt = scanOptions.isMultiScan ? `
あなたは名刺情報の高精度解析AIです。
以下はオンデバイスOCRで事前抽出された名刺の生テキストです。このテキストから名刺（1枚または複数枚可能）情報を抽出し、指定のJSONフォーマットで返却してください。
${modeInstruction}
【オンデバイスOCR事前抽出テキスト】
${ocrHintText || '(テキスト未検出)'}

OCRテキストに誤字脱字や改行の乱れがあっても、人物名、会社名、役職、電話番号、メールアドレス、住所等の文脈を総合的に分析して各名刺の要素を特定してください。
テキストから名刺要素がどうしても全く検出できない場合のみ "isBusinessCard": false, "reason": "テキスト情報を検知できませんでした。" にしてください。
少しでも名刺要素が読み取れる場合は "isBusinessCard": true にし、推測可能な項目を補完して出力してください。

【返却フォーマット】
{
  "isBusinessCard": true,
  "cards": [
    {
      "name": "氏名",
      "reading": "フリガナ",
      "company": "会社名",
      "department": "部署名",
      "title": "役職名",
      "phone": "固定電話番号",
      "mobile": "携帯電話番号",
      "email": "メールアドレス",
      "postalCode": "郵便番号",
      "address": "住所",
      "website": "WebサイトURL",
      "memo": "特記事項",
      "tags": ["検出キーワード"]
    }
  ]
}
` : `
あなたは名刺情報の高精度解析AIです。
以下はオンデバイスOCRで事前抽出された名刺の生テキストです。このテキストから名刺情報を抽出し、指定のJSONフォーマットで返却してください。
${modeInstruction}
【オンデバイスOCR事前抽出テキスト】
${ocrHintText || '(テキスト未検出)'}

OCRテキストに誤字脱字や改行の乱れがあっても、人物名、会社名、役職、電話番号、メールアドレス、住所等の文脈を総合的に分析して名刺要素を特定してください。
テキストから名刺要素がどうしても全く検出できない場合のみ "isBusinessCard": false, "reason": "テキスト情報を検知できませんでした。" にしてください。
少しでも名刺要素が読み取れる場合は "isBusinessCard": true にし、推測可能な項目を補完して出力してください。

【返却フォーマット】
{
  "isBusinessCard": true,
  "name": "氏名",
  "reading": "フリガナ",
  "company": "会社名",
  "department": "部署名",
  "title": "役職名",
  "phone": "固定電話番号",
  "mobile": "携帯電話番号",
  "email": "メールアドレス",
  "postalCode": "郵便番号",
  "address": "住所",
  "website": "WebサイトURL",
  "memo": "特記事項",
  "tags": ["検出キーワード"]
}
`;

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{
        role: 'user',
        content: prompt
      }],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek V4 HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  let cleanJson = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanJson = jsonMatch[0];
  }
  return JSON.parse(cleanJson);
}
