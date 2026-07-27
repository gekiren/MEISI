import { analyzeBusinessCardWithGemini } from './geminiService';
import { DEFAULT_WORKER_PROXY_URL } from '../config/constants';

/**
 * DeepSeek V4 API (OpenAI互換) による名刺画像・テキスト構造化サービス
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
export async function analyzeCardWithWorkerProxy(base64Image, proxyUrl) {
  const targetProxy = proxyUrl || DEFAULT_WORKER_PROXY_URL;
  const cleanUrl = targetProxy.replace(/\/$/, '') + '/api/analyze-card';

  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Workerプロキシ通信エラー (${response.status})`);
  }

  return await response.json();
}

/**
 * 統合解析関数（事前組み込み Worker プロキシ → ダイレクト Gemini 3.6 Flash → DeepSeek V4 フォールバック）
 */
export async function analyzeBusinessCardWithFallback(
  base64Image,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl,
  onFallbackNotice
) {
  // 事前組込み済みの Worker プロキシ URL を優先使用（ユーザーの手動登録不要）
  const activeProxyUrl = workerProxyUrl || DEFAULT_WORKER_PROXY_URL;

  if (activeProxyUrl) {
    try {
      console.log('Using pre-configured Cloudflare Worker Proxy:', activeProxyUrl);
      if (onFallbackNotice) onFallbackNotice('組み込み Cloudflare Worker プロキシ経由で AI 解析中 (Gemini 3.6 Flash ⇄ DeepSeek V4)...');
      return await analyzeCardWithWorkerProxy(base64Image, activeProxyUrl);
    } catch (proxyError) {
      console.warn('Pre-configured Cloudflare Worker Proxy failed, attempting direct API keys if provided:', proxyError);
      if (!geminiApiKey && !deepSeekApiKey) {
        throw new Error(`Cloudflare Worker プロキシ通信エラー: ${proxyError.message}`);
      }
    }
  }

  // 直打ち Gemini 3.6 Flash
  if (geminiApiKey) {
    try {
      console.log('Attempting analysis directly with Gemini 3.6 Flash...');
      if (onFallbackNotice) onFallbackNotice('Gemini 3.6 Flash で名刺情報を解析中...');
      return await analyzeBusinessCardWithGemini(base64Image, geminiApiKey, 'gemini-3.6-flash');
    } catch (geminiError) {
      console.warn('Gemini 3.6 Flash direct API failed or congested:', geminiError);

      if (deepSeekApiKey) {
        if (onFallbackNotice) {
          onFallbackNotice(`Gemini 3.6 Flash 混雑のため、DeepSeek V4 API に自動切り替えして解析中...`);
        }
        return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash');
      } else {
        throw new Error(`Gemini 3.6 Flash エラー: ${geminiError.message}`);
      }
    }
  }

  // 直打ち DeepSeek V4
  if (deepSeekApiKey) {
    if (onFallbackNotice) onFallbackNotice('DeepSeek V4 で名刺情報を直接解析中...');
    return await analyzeBusinessCardWithDeepSeek(base64Image, deepSeekApiKey, 'deepseek-v4-flash');
  }

  throw new Error('AI 解析サーバーへの接続に失敗しました。');
}
