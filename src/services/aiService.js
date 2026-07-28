import { analyzeBusinessCardWithGemini } from './geminiService';
import { DEFAULT_WORKER_PROXY_URL } from '../config/constants';
import { extractTextWithLocalOCR, validateBusinessCardContent, parseOcrTextToCard } from './ocrService';

/**
 * DeepSeek V4 API (OpenAI互換) による名刺画像・テキスト構造化サービス
 */
export async function analyzeBusinessCardWithDeepSeek(
  base64Image,
  apiKey,
  modelName = 'deepseek-v4-flash',
  ocrHintText = '',
  scanOptions = {}
) {
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
名刺画像から情報を抽出してJSONで返却してください。
画像が名刺ではない場合（エラー画面のスクリーンショット、アプリ画面、キーボード、風景、書籍など）は "isBusinessCard": false, "reason": "名刺画像を検知できませんでした。名刺がはっきりと写っている画像でお試しください。" にしてください。
名刺の場合は "isBusinessCard": true にしてください。
${modeInstruction}${hintPrompt}
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
      model: modelName,
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
    throw new Error(err.error?.message || `DeepSeek V4 APIエラー (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return JSON.parse(content.trim());
}

/**
 * Cloudflare Worker プロキシ経由の解析リクエスト
 */
export async function analyzeCardWithWorkerProxy(base64Image, proxyUrl, ocrHintText = '', scanOptions = {}) {
  const targetProxy = proxyUrl || DEFAULT_WORKER_PROXY_URL;
  const cleanUrl = targetProxy.replace(/\/$/, '') + '/api/analyze-card';

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, ocrHintText, scanOptions })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Workerプロキシ通信エラー (${response.status})`);
  }

  return await response.json();
}

/**
 * 統合解析パイプライン
 * Step 1: ローカル（オンデバイス）OCRによる文字事前検証＆事前ガード
 * Step 2: 組み込み Worker プロキシ → Gemini 3.6 Flash → DeepSeek V4
 * Step 3: 全AI API接続失敗時はローカルOCRテキストによるルールベースフォールバック
 */
export async function analyzeBusinessCardWithFallback(
  base64Image,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl,
  onFallbackNotice,
  scanOptions = {}
) {
  // Step 1: オンデバイス（ローカルWebAssembly）OCR による事前検証
  let ocrResult = { text: '', confidence: 0 };
  try {
    if (onFallbackNotice) {
      const modeLabel = [
        scanOptions.isVertical ? '縦書き' : '',
        scanOptions.isDesignCard ? 'デザイン名刺' : ''
      ].filter(Boolean).join(' & ');
      const modeText = modeLabel ? ` (${modeLabel}モード)` : '';
      onFallbackNotice(`オンデバイスOCRで名刺テキストを事前判定中${modeText}...`);
    }

    ocrResult = await extractTextWithLocalOCR(base64Image, (progressMsg) => {
      if (onFallbackNotice) onFallbackNotice(progressMsg);
    });

    const guardCheck = validateBusinessCardContent(ocrResult.text, scanOptions);
    if (!guardCheck.isCard) {
      return {
        isBusinessCard: false,
        reason: guardCheck.reason
      };
    }
  } catch (ocrErr) {
    console.warn('Pre-OCR execution error, proceeding directly to AI:', ocrErr);
  }

  // Step 2: AI解析 (Workerプロキシ → Gemini 3.6 Flash → DeepSeek V4)
  const activeProxyUrl = workerProxyUrl || DEFAULT_WORKER_PROXY_URL;

  // 事前組込み済みの Worker プロキシ URL を優先使用
  if (activeProxyUrl) {
    try {
      console.log('Using pre-configured Cloudflare Worker Proxy:', activeProxyUrl);
      if (onFallbackNotice) onFallbackNotice('組み込み Cloudflare Worker プロキシ経由で AI 解析中 (Gemini 3.6 Flash ⇄ DeepSeek V4)...');
      return await analyzeCardWithWorkerProxy(base64Image, activeProxyUrl, ocrResult.text, scanOptions);
    } catch (proxyError) {
      console.warn('Pre-configured Cloudflare Worker Proxy failed, attempting direct API keys if provided:', proxyError);
    }
  }

  // 直打ち Gemini 3.6 Flash
  if (geminiApiKey) {
    try {
      console.log('Attempting analysis directly with Gemini 3.6 Flash...');
      if (onFallbackNotice) onFallbackNotice('Gemini 3.6 Flash で名刺情報を解析中...');
      return await analyzeBusinessCardWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash', ocrResult.text, scanOptions);
    } catch (geminiError) {
      console.warn('Gemini 3.6 Flash direct API failed or congested:', geminiError);

      if (deepSeekApiKey) {
        if (onFallbackNotice) {
          onFallbackNotice(`Gemini 3.6 Flash 混雑のため、DeepSeek V4 API に自動切り替えして解析中...`);
        }
        try {
          return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text, scanOptions);
        } catch (deepSeekError) {
          console.warn('DeepSeek V4 API failed:', deepSeekError);
        }
      }
    }
  }

  // 直打ち DeepSeek V4
  if (deepSeekApiKey) {
    try {
      if (onFallbackNotice) onFallbackNotice('DeepSeek V4 で名刺情報を直接解析中...');
      return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text, scanOptions);
    } catch (deepSeekError) {
      console.warn('DeepSeek V4 API failed:', deepSeekError);
    }
  }

  // Step 3: AI APIが全て使えない場合の「完全ローカルOCRフォールバック」
  console.warn('All AI APIs failed or unreachable. Falling back to local OCR parsing.');
  if (onFallbackNotice) {
    onFallbackNotice('AI API接続不可のため、オンデバイスOCR（オフライン解析）で自動抽出中...');
  }

  const localCardData = parseOcrTextToCard(ocrResult.text);
  return localCardData;
}

