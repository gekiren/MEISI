import { analyzeBusinessCardWithGemini } from './geminiService';
import { DEFAULT_WORKER_PROXY_URL } from '../config/constants';
import { extractTextWithLocalOCR, parseOcrTextToCard, isOcrTextValid } from './ocrService';

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

  let modePrompts = [];
  if (scanOptions.isVertical) {
    modePrompts.push('※注意【縦書きレイアウト名刺モード】: この名刺は縦書きで記載されています。');
  }
  if (scanOptions.isDesignCard) {
    modePrompts.push('※注意【デザイン・カラー名刺モード】');
  }
  if (scanOptions.isMultiScan) {
    modePrompts.push('※注意【複数名刺モード】: テキストから複数名刺の情報が抽出できる場合は `cards` 配列として返却してください。');
  }
  const modeInstruction = modePrompts.length > 0 ? `\n${modePrompts.join('\n')}\n` : '';

  const prompt = scanOptions.isMultiScan ? `
あなたは名刺情報の高精度解析AIです。
以下はオンデバイスOCRで事前抽出された名刺の生テキストです。このテキストから名刺（複数枚可能）情報を抽出し、指定のJSONフォーマットで返却してください。
${modeInstruction}
【オンデバイスOCR事前抽出テキスト】
${ocrHintText || '(テキスト未検出)'}

テキストから名刺要素が検出できない場合は "isBusinessCard": false, "reason": "テキスト情報を検知できませんでした。" にしてください。
検出できる場合は "isBusinessCard": true にしてください。

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

テキストから名刺要素が検出できない場合は "isBusinessCard": false, "reason": "テキスト情報を検知できませんでした。" にしてください。
検出できる場合は "isBusinessCard": true にしてください。

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
        content: prompt
      }],
      response_format: { type: 'json_object' }
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

  // Base64文字列から改行・空白を除去
  const sanitizedBase64 = base64Image ? base64Image.replace(/\s+/g, '') : '';

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: sanitizedBase64, ocrHintText, scanOptions })
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
  // Step 1: 高速オンデバイスOCR (Google ML Kit / Tesseract) の実行
  let ocrResult = { text: '', confidence: 0 };
  let ocrErrorDetail = '';
  try {
    if (onFallbackNotice) {
      const modeLabel = [
        scanOptions.isVertical ? '縦書き' : '',
        scanOptions.isDesignCard ? 'デザイン名刺' : ''
      ].filter(Boolean).join(' & ');
      const modeText = modeLabel ? ` (${modeLabel}モード)` : '';
      onFallbackNotice(`Google ML Kit & Gemini 3.6 で解析中${modeText}...`);
    }

    // Google ML Kit の高速検出 (約50ms)
    ocrResult = await extractTextWithLocalOCR(base64Image, (msg) => {
      if (onFallbackNotice) onFallbackNotice(msg);
    }).catch((err) => {
      ocrErrorDetail = err.message || String(err);
      return { text: '', confidence: 0 };
    });
  } catch (ocrErr) {
    ocrErrorDetail = ocrErr.message || String(ocrErr);
    console.warn('Pre-OCR execution error, proceeding directly to Vision AI:', ocrErr);
  }

  const ocrCharCount = ocrResult.text ? ocrResult.text.trim().length : 0;
  const ocrSummary = ocrCharCount > 0 
    ? `ローカルOCR文字認識: ${ocrCharCount}文字検出 ("${ocrResult.text.trim().substring(0, 30)}...")`
    : `ローカルOCR文字認識: 0文字検出 (画像がぼやけているか文字が小さすぎる可能性があります)`;

  // Step 2: AI解析 (Workerプロキシ → Gemini 3.6 Flash → DeepSeek V4)
  const activeProxyUrl = workerProxyUrl || DEFAULT_WORKER_PROXY_URL;

  let lastProxyErrMessage = '';
  let lastGeminiErrMessage = '';
  let lastDeepSeekErrMessage = '';

  // 事前組込み済みの Worker プロキシ URL を優先使用
  if (activeProxyUrl) {
    try {
      console.log('Using pre-configured Cloudflare Worker Proxy:', activeProxyUrl);
      if (onFallbackNotice) onFallbackNotice('組み込み Cloudflare Worker プロキシ経由で AI 解析中 (Gemini 3.6 Flash ⇄ DeepSeek V4)...');
      const proxyResult = await analyzeCardWithWorkerProxy(base64Image, activeProxyUrl, ocrResult.text, scanOptions);
      if (proxyResult && proxyResult.isBusinessCard === false && !proxyResult.reason?.includes('【詳細原因】')) {
        proxyResult.reason = `${proxyResult.reason || 'テキスト情報を検知できませんでした。'}\n\n【詳細原因・診断情報】\n・${ocrSummary}\n・Cloudflare Workerプロキシ経由で解析実行完了`;
      }
      return proxyResult;
    } catch (proxyError) {
      console.warn('Pre-configured Cloudflare Worker Proxy failed, attempting direct API keys if provided:', proxyError);
      lastProxyErrMessage = proxyError.message || String(proxyError);
    }
  }

  // 直打ち Gemini 3.6 Flash
  if (geminiApiKey) {
    try {
      console.log('Attempting analysis directly with Gemini 3.6 Flash...');
      if (onFallbackNotice) onFallbackNotice('Gemini 3.6 Flash で名刺情報を解析中...');
      const geminiRes = await analyzeBusinessCardWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash', ocrResult.text, scanOptions);
      if (geminiRes && geminiRes.isBusinessCard === false && !geminiRes.reason?.includes('【詳細原因】')) {
        geminiRes.reason = `${geminiRes.reason || 'テキスト情報を検知できませんでした。'}\n\n【詳細原因・診断情報】\n・${ocrSummary}\n・Gemini 3.6 Flash API経由で解析完了`;
      }
      return geminiRes;
    } catch (geminiError) {
      console.warn('Gemini 3.6 Flash direct API failed or congested:', geminiError);
      lastGeminiErrMessage = geminiError.message || String(geminiError);

      if (deepSeekApiKey) {
        if (onFallbackNotice) {
          onFallbackNotice(`Gemini 3.6 Flash 混雑のため、DeepSeek V4 API に自動切り替えして解析中...`);
        }
        try {
          const dsRes = await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text, scanOptions);
          if (dsRes && dsRes.isBusinessCard === false && !dsRes.reason?.includes('【詳細原因】')) {
            dsRes.reason = `${dsRes.reason || 'テキスト情報を検知できませんでした。'}\n\n【詳細原因・診断情報】\n・${ocrSummary}\n・DeepSeek V4 API経由で解析完了`;
          }
          return dsRes;
        } catch (deepSeekError) {
          console.warn('DeepSeek V4 API failed:', deepSeekError);
          lastDeepSeekErrMessage = deepSeekError.message || String(deepSeekError);
        }
      }
    }
  }

  // 直打ち DeepSeek V4
  if (deepSeekApiKey) {
    try {
      if (onFallbackNotice) onFallbackNotice('DeepSeek V4 で名刺情報を直接解析中...');
      const dsRes = await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash', ocrResult.text, scanOptions);
      if (dsRes && dsRes.isBusinessCard === false && !dsRes.reason?.includes('【詳細原因】')) {
        dsRes.reason = `${dsRes.reason || 'テキスト情報を検知できませんでした。'}\n\n【詳細原因・診断情報】\n・${ocrSummary}\n・DeepSeek V4 API経由で解析完了`;
      }
      return dsRes;
    } catch (deepSeekError) {
      console.warn('DeepSeek V4 API failed:', deepSeekError);
      lastDeepSeekErrMessage = deepSeekError.message || String(deepSeekError);
    }
  }

  // Step 3: AI APIが全て使えない場合の「完全ローカルOCRフォールバック」
  console.warn('All AI APIs failed or unreachable. Falling back to local OCR parsing.');

  if (isOcrTextValid(ocrResult.text)) {
    if (onFallbackNotice) {
      onFallbackNotice('AI API接続不可のため、オンデバイスOCR（オフライン解析）で自動抽出中...');
    }
    const localCardData = parseOcrTextToCard(ocrResult.text, scanOptions);
    return localCardData;
  }

  // エラー原因を抽象化せず、詳細な診断結果・原因内訳を返却
  const diagList = [
    `・${ocrSummary}`,
    lastProxyErrMessage ? `・Cloudflare Worker通信: ${lastProxyErrMessage}` : '',
    lastGeminiErrMessage ? `・Gemini 3.6 API通信: ${lastGeminiErrMessage}` : '',
    lastDeepSeekErrMessage ? `・DeepSeek V4 API通信: ${lastDeepSeekErrMessage}` : '',
    ocrErrorDetail ? `・ML Kit OCRエラー: ${ocrErrorDetail}` : ''
  ].filter(Boolean).join('\n');

  return {
    isBusinessCard: false,
    reason: `テキスト情報を検知できませんでした。\n\n【エラー詳細・原因内訳】\n${diagList}\n\n💡 対策: 明るい場所で名刺を大きく水平に撮影し直すか、手動での入力をお試しください。`
  };
}

