import { analyzeBusinessCardWithGemini } from './geminiService';

/**
 * DeepSeek V4 API (OpenAI互換) による名刺画像・テキスト構造化サービス
 * 最新モデル: deepseek-v4-flash
 */
export async function analyzeBusinessCardWithDeepSeek(base64Image, apiKey, modelName = 'deepseek-v4-flash') {
  if (!apiKey) {
    throw new Error('DeepSeek APIキーが設定されていません。');
  }

  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const prompt = `
あなたは名刺情報の高精度解析AIです。名刺画像データから記載されている情報を正確に抽出して指定のJSONフォーマットで返却してください。

【出力ルール】
- 余計な説明テキストやMarkdown修飾 (例: \`\`\`json) は除外し、純粋なJSONオブジェクトのみを出力してください。
- 判別できない項目は空文字 "" にしてください。

【返却JSONフォーマット】
{
  "name": "氏名",
  "reading": "フリガナ",
  "company": "会社名",
  "department": "部署名",
  "title": "役職",
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

  const url = 'https://api.deepseek.com/chat/completions';

  const requestBody = {
    model: modelName,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: base64Image.startsWith('data:') ? base64Image : `data:${mimeType};base64,${cleanBase64}`
            }
          }
        ]
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `DeepSeek V4 APIエラー (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek V4 APIから有効な応答が得られませんでした。');
  }

  return JSON.parse(content.trim());
}

/**
 * Gemini 3.6 Flash を優先し、混雑・エラー時に DeepSeek V4 へ自動フォールバックする統合関数
 */
export async function analyzeBusinessCardWithFallback(base64Image, geminiApiKey, deepSeekApiKey, onFallbackNotice) {
  // 1. まず Gemini 3.6 Flash API を呼び出し
  if (geminiApiKey) {
    try {
      console.log('Attempting analysis with Gemini 3.6 Flash...');
      return await analyzeBusinessCardWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash');
    } catch (geminiError) {
      console.warn('Gemini 3.6 Flash API failed or congested:', geminiError);

      if (deepSeekApiKey) {
        if (onFallbackNotice) {
          onFallbackNotice(`Gemini 3.6 Flash 混雑のため、DeepSeek V4 API に自動切り替えして解析中...`);
        }
        console.log('Falling back to DeepSeek V4 API...');
        return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash');
      } else {
        throw new Error(`Gemini 3.6 Flash エラー: ${geminiError.message}。DeepSeek V4 APIキーを設定することをお勧めします。`);
      }
    }
  }

  // 2. DeepSeek V4 キーのみある場合
  if (deepSeekApiKey) {
    console.log('Gemini key absent, using DeepSeek V4 API directly...');
    return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash');
  }

  throw new Error('Gemini 3.6 Flash または DeepSeek V4 の API キーを設定してください。');
}
