import { createWorker } from 'tesseract.js';

/**
 * オンデバイス（ブラウザ内WebAssembly）でローカルOCRを実行
 * @param {string} base64Image - 画像のBase64文字列
 * @param {function} onProgress - 進捗コールバック (0〜100%)
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function extractTextWithLocalOCR(base64Image, onProgress) {
  try {
    const worker = await createWorker('jpn+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(`ローカルOCR解析中 (${pct}%)...`);
        }
      }
    });

    const { data } = await worker.recognize(base64Image);
    await worker.terminate();

    return {
      text: data.text || '',
      confidence: data.confidence || 0
    };
  } catch (err) {
    console.warn('Local OCR execution failed:', err);
    // OCR処理エラー時はフォールバック用に空結果を返す
    return { text: '', confidence: 0 };
  }
}

/**
 * 抽出されたOCRテキストから名刺画像かどうかを事前判定（端末内ガード）
 * @param {string} text - OCR抽出テキスト
 * @param {object} options - スキャンオプション { isVertical, isDesignCard }
 * @returns {{ isCard: boolean, reason?: string }}
 */
export function validateBusinessCardContent(text, options = {}) {
  const { isDesignCard } = options;

  // デザイン名刺モードの場合は背景のノイズ等でOCR読み取り不可でもビジョンAI解析を優先する
  if (isDesignCard) {
    return { isCard: true };
  }

  if (!text || text.trim().length === 0) {
    return { isCard: true, reason: 'テキストが検出されませんでした。AIで画像直接解析を実行します。' };
  }

  // オンデバイスOCRで抽出された文字数が少ない場合でも、
  // 高精度なビジョンAI (Gemini 3.6 Flash等) が直接画像を判別・抽出できるよう、事前ブロックは行わずバトンタッチする
  return { isCard: true };
}

/**
 * AI API全滅時の完全ローカルフォールバック用パーサー
 * OCR結果の生のテキスト文字列から正規表現で名刺の要素を抽出する
 * @param {string} rawText 
 * @returns {object}
 */
export function parseOcrTextToCard(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      isBusinessCard: false,
      reason: 'AI接続エラーおよびオンデバイスOCRでテキストを検出できませんでした。画像をご確認ください。',
      name: '',
      reading: '',
      company: '',
      department: '',
      title: '',
      phone: '',
      mobile: '',
      email: '',
      postalCode: '',
      address: '',
      website: '',
      memo: '',
      tags: []
    };
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  let email = '';
  let phone = '';
  let mobile = '';
  let postalCode = '';
  let address = '';
  let website = '';
  let company = '';
  let name = '';
  let title = '';
  const remainingLines = [];

  // 正規表現パターン
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const mobileRegex = /(?:090|080|070)[-\s]?\d{4}[-\s]?\d{4}/;
  const phoneRegex = /(?:0\d{1,4})[-\s]?\d{1,4}[-\s]?\d{3,4}/;
  const postalRegex = /〒?\s?(\d{3}[-\s]\d{4})/;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/;
  const titleKeywords = ['代表取締役', '取締役', '社長', '部長', '課長', 'マネージャー', 'CEO', 'CTO', 'CFO', '主任', '係長', '代表'];
  const companyKeywords = ['株式会社', '有限会社', '合同会社', '一般社団法人', 'Inc.', 'Co.', 'Ltd.'];

  for (const line of lines) {
    // メールアドレス検出
    if (!email && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      if (match) email = match[0];
      continue;
    }

    // URL検出
    if (!website && urlRegex.test(line)) {
      const match = line.match(urlRegex);
      if (match) website = match[0];
      continue;
    }

    // 携帯電話検出
    if (!mobile && mobileRegex.test(line)) {
      const match = line.match(mobileRegex);
      if (match) mobile = match[0];
      continue;
    }

    // 固定電話検出
    if (!phone && phoneRegex.test(line)) {
      const match = line.match(phoneRegex);
      if (match) phone = match[0];
      continue;
    }

    // 郵便番号
    if (!postalCode && postalRegex.test(line)) {
      const match = line.match(postalRegex);
      if (match) postalCode = match[1];
      continue;
    }

    // 会社名
    if (!company && companyKeywords.some(k => line.includes(k))) {
      company = line;
      continue;
    }

    // 役職
    if (!title && titleKeywords.some(k => line.includes(k))) {
      title = line;
      continue;
    }

    // 住所パターン
    if (!address && (line.includes('都') || line.includes('道') || line.includes('府') || line.includes('県') || line.includes('区') || line.includes('市'))) {
      if (/\d/.test(line)) {
        address = line;
        continue;
      }
    }

    remainingLines.push(line);
  }

  // 残った短めの行から氏名を推測（日本語名刺の2〜4文字）
  if (remainingLines.length > 0) {
    for (const cand of remainingLines) {
      const cleanCand = cand.replace(/\s+/g, '');
      if (cleanCand.length >= 2 && cleanCand.length <= 6 && !/\d/.test(cleanCand)) {
        name = cand;
        break;
      }
    }
  }

  if (!name && remainingLines.length > 0) {
    name = remainingLines[0];
  }

  return {
    isBusinessCard: true,
    name: name || '',
    reading: '',
    company: company || '',
    department: '',
    title: title || '',
    phone: phone || '',
    mobile: mobile || '',
    email: email || '',
    postalCode: postalCode || '',
    address: address || '',
    website: website || '',
    memo: `[ローカルOCRフォールバック抽出]\n${rawText.slice(0, 150)}...`,
    tags: ['ローカルOCR解析']
  };
}
