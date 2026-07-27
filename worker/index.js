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
        const { image } = body;

        if (!image) {
          return new Response(JSON.stringify({ error: '名刺画像データ (image) が必要です。' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const result = await analyzeCardWithFallback(image, env);

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

async function analyzeCardWithFallback(base64Image, env) {
  const geminiKey = env.GEMINI_API_KEY;
  const deepSeekKey = env.DEEPSEEK_API_KEY;

  // 1. まず Gemini 3.6 Flash を呼び出し
  if (geminiKey) {
    try {
      console.log('Worker: Calling Gemini 3.6 Flash...');
      return await callGemini36Flash(base64Image, geminiKey);
    } catch (geminiError) {
      console.warn('Worker: Gemini 3.6 Flash failed:', geminiError.message);
      if (deepSeekKey) {
        console.log('Worker: Falling back to DeepSeek V4...');
        return await callDeepSeekV4(base64Image, deepSeekKey);
      }
      throw geminiError;
    }
  }

  // 2. Geminiキーがなく DeepSeekキーのみある場合
  if (deepSeekKey) {
    console.log('Worker: Calling DeepSeek V4 directly...');
    return await callDeepSeekV4(base64Image, deepSeekKey);
  }

  throw new Error('Cloudflare Worker に API キーが設定されていません。');
}

async function callGemini36Flash(base64Image, apiKey) {
  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const prompt = `
あなたは名刺情報の高精度解析AIです。添付された名刺画像から、記載されている情報を正確に抽出して指定のJSONフォーマットで返却してください。
余計な説明やMarkdown修飾は含めず、純粋なJSONオブジェクトのみを出力してください。
判別できない項目は空文字 "" にしてください。

【返却フォーマット】
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
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

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
      generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  let cleanJson = text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleanJson);
}

async function callDeepSeekV4(base64Image, apiKey) {
  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const prompt = `
名刺画像から情報を抽出してJSONで返却してください。
【返却フォーマット】
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
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${cleanBase64}` } }
        ]
      }],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `DeepSeek V4 HTTP ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content.trim());
}
