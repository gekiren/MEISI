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
  if (scanOptions.isMultiScan) {
    modePrompts.push('※注意【複数名刺モード (最大4枚まで)】: この画像には最大4枚までの名刺が並べて撮影されている可能性があります。画像内の各名刺を個別に検出・区別し、それぞれの名刺情報を `cards` 配列として出力してください。もし画像内に5枚以上の名刺が写っていると判断される場合は、"isBusinessCard": false, "reason": "画像内に5枚以上の名刺が検知されました。読み取り精度を保つため、4枚以下（2×2配置推奨）にして再度撮影してください。" と出力してください。');
  }
  const modeInstruction = modePrompts.length > 0 ? `\n${modePrompts.join('\n')}\n` : '';

  const prompt = scanOptions.isMultiScan ? `
あなたは名刺情報の高精度解析AIです。添付画像に写っている各名刺（最大4枚）から、記載されている情報をそれぞれ正確に抽出して指定のJSONフォーマットで返却してください。
${modeInstruction}${hintPrompt}
【出力ルール】
- 余計な説明、Markdown修飾 (例: \`\`\`json) は含めず、純粋なJSONオブジェクトのみを出力してください。
- 添付画像が名刺ではない場合（エラー画面のスクリーンショット、スマホ画面、キーボード、風景、書籍、名刺と無関係な写真など）、"isBusinessCard": false, "reason": "名刺画像を検知できませんでした。名刺がはっきりと写っている画像でお試しください。" にしてください。
- 5枚以上の名刺が含まれる場合は "isBusinessCard": false, "reason": "画像内に5枚以上の名刺が検知されました。読み取り精度を保つため、4枚以下（2×2配置推奨）にして再度撮影してください。" にしてください。

【返却するJSONフォーマット】
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
      "tags": ["検出された主要キーワード"]
    }
  ]
}
` : `
あなたは名刺情報の高精度解析AIです。添付された名刺画像から、記載されている情報を正確に抽出して指定のJSONフォーマットで返却してください。
${modeInstruction}${hintPrompt}
【出力ルール】
- 余計な説明、Markdown修飾 (例: \`\`\`json) は含めず、純粋なJSONオブジェクトのみを出力してください。
- 画像内に氏名、会社名、役職、電話番号、メールアドレス、住所等の名刺要素が一部でも確認できる場合は、必ず "isBusinessCard": true にし、読み取れる情報を可能な限り全て抽出してください。
- 名刺と完全に無関係な画像（純粋な風景写真、黒無地、キーボード単体など）の場合のみ "isBusinessCard": false にしてください。
- 電話番号はハイフンを含める標準フォーマット（例: 03-1234-5678, 090-1234-5678）に補正してください。

【返却するJSONフォーマット】
{
  "isBusinessCard": true,
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

  // もし前後に説明文が含まれている場合に備え、最外周の JSON ブロック ({ ... }) を抽出
  const jsonMatch = cleanJsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleanJsonStr = jsonMatch[0];
  }

  return JSON.parse(cleanJsonStr);
}
