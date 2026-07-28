/**
 * Gemini Vision API を使用して名刺画像から情報を解析するサービス
 * 最新モデル: gemini-3.6-flash
 */

export async function analyzeBusinessCardWithGemini(
  base64Image,
  apiKey,
  modelName = 'gemini-3.6-flash',
  ocrHintText = '',
  scanOptions = {}
) {
  if (!apiKey) {
    throw new Error('Gemini APIキーが設定されていません。');
  }

  let mimeType = 'image/jpeg';
  let cleanBase64 = base64Image;

  if (base64Image.includes(';base64,')) {
    const parts = base64Image.split(';base64,');
    mimeType = parts[0].replace('data:', '');
    cleanBase64 = parts[1];
  }

  const hintPrompt = ocrHintText ? `\n【参考：オンデバイスOCR事前抽出テキスト】\n${ocrHintText}\n` : '';

  let modePrompts = [];
  if (scanOptions.isVertical) {
    modePrompts.push('※注意【縦書きレイアウト名刺モード】: この名刺は縦書きで記載されています。文字は上から下、行は右から左の縦方向配置と意識して氏名・役職・会社名を特定してください。');
  }
  if (scanOptions.isDesignCard) {
    modePrompts.push('※注意【デザイン・カラー名刺モード】: この名刺はカラフルな背景・複雑なグラフィックノイズ・ロゴマーク・変形フォントが含まれる場合があります。背景ノイズを分離し、本来のテキスト要素を正確に検出してください。');
  }
  const modeInstruction = modePrompts.length > 0 ? `\n${modePrompts.join('\n')}\n` : '';

  const prompt = `
あなたは名刺情報の高精度解析AIです。添付された名刺画像から、記載されている情報を正確に抽出して指定のJSONフォーマットで返却してください。
${modeInstruction}${hintPrompt}
【出力ルール】
- 余計な説明、Markdown修飾 (例: \`\`\`json) は含めず、純粋なJSONオブジェクトのみを出力してください。
- 添付画像が名刺ではない場合（キーボード、風景、書籍、名刺と無関係な写真など）、"isBusinessCard": false にし、各項目は空文字 "" にしてください。
- 判別できる名刺の場合は "isBusinessCard": true にしてください。
- 電話番号はハイフンを含める標準フォーマット（例: 03-1234-5678, 090-1234-5678）に補正してください。

【返却するJSONフォーマット】
{
  "isBusinessCard": trueまたはfalse,
  "name": "氏名（漢字）",
  "reading": "氏名（フリガナ・ひらがな）",
  "company": "会社名・組織名",
  "department": "部署名",
  "title": "役職名",
  "phone": "固定電話番号",
  "mobile": "携帯電話番号",
  "email": "メールアドレス",
  "postalCode": "郵便番号",
  "address": "住所",
  "website": "WebサイトURL",
  "memo": "その他特記事項やキャッチコピー",
  "tags": ["検出された主要キーワード", "業界など"]
}
`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini APIエラー (${response.status})`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('Gemini APIから有効な応答が得られませんでした。');
  }

  let cleanJsonStr = textResponse.trim();
  if (cleanJsonStr.startsWith('```json')) {
    cleanJsonStr = cleanJsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleanJsonStr.startsWith('```')) {
    cleanJsonStr = cleanJsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(cleanJsonStr);
}
