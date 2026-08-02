import { createWorker } from 'tesseract.js';

// Native環境専用 Google ML Kit の動的セーフティインポート
let TextRecognition = null;
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch (e) {
  // Webビルド環境では無視
}

/**
 * オンデバイス（Google ML Kit / Tesseract）で爆速ローカルOCRを実行
 * @param {string} imageUriOrBase64 - 画像のURIまたはBase64文字列
 * @param {function} onProgress - 進捗コールバック
 * @returns {Promise<{ text: string, confidence: number }>}
 */
export async function extractTextWithLocalOCR(imageUriOrBase64, onProgress) {
  // 1. React Native (Android / iOS) 環境: Google ML Kit オンデバイスOCR (爆速 50ms)
  try {
    if (TextRecognition && typeof TextRecognition.recognize === 'function') {
      if (onProgress) onProgress('Google ML Kit で爆速オンデバイスOCR処理中...');
      let cleanUri = imageUriOrBase64;
      if (cleanUri && !cleanUri.startsWith('file://') && !cleanUri.startsWith('content://') && !cleanUri.startsWith('data:')) {
        cleanUri = `file://${cleanUri}`;
      }
      const result = await TextRecognition.recognize(cleanUri);
      if (result && result.text) {
        return {
          text: result.text || '',
          confidence: 0.95
        };
      }
    }
  } catch (mlKitErr) {
    console.warn('Google ML Kit OCR failed, falling back to WebAssembly OCR:', mlKitErr);
  }

  // 2. Web / ブラウザ環境フォールバック (Tesseract.js)
  try {
    const worker = await createWorker('jpn+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(`ローカルOCR解析中 (${pct}%)...`);
        }
      }
    });

    const { data } = await worker.recognize(imageUriOrBase64);
    await worker.terminate();

    return {
      text: data.text || '',
      confidence: data.confidence || 0
    };
  } catch (err) {
    console.warn('Local OCR execution failed:', err);
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

export function parseSingleCardFromLines(lines) {
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

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const mobileRegex = /(?:090|080|070)[-\s]?\d{4}[-\s]?\d{4}/;
  const phoneRegex = /(?:0\d{1,4})[-\s]?\d{1,4}[-\s]?\d{3,4}/;
  const postalRegex = /〒?\s?(\d{3}[-\s]\d{4})/;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/;
  const titleKeywords = ['代表取締役', '取締役', '社長', '部長', '課長', 'マネージャー', 'CEO', 'CTO', 'CFO', '主任', '係長', '代表'];
  const companyKeywords = ['株式会社', '有限会社', '合同会社', '一般社団法人', 'Inc.', 'Co.', 'Ltd.'];

  for (const line of lines) {
    if (!email && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      if (match) email = match[0];
      continue;
    }
    if (!website && urlRegex.test(line)) {
      const match = line.match(urlRegex);
      if (match) website = match[0];
      continue;
    }
    if (!mobile && mobileRegex.test(line)) {
      const match = line.match(mobileRegex);
      if (match) mobile = match[0];
      continue;
    }
    if (!phone && phoneRegex.test(line)) {
      const match = line.match(phoneRegex);
      if (match) phone = match[0];
      continue;
    }
    if (!postalCode && postalRegex.test(line)) {
      const match = line.match(postalRegex);
      if (match) postalCode = match[1];
      continue;
    }
    if (!company && companyKeywords.some(k => line.includes(k))) {
      company = line;
      continue;
    }
    if (!title && titleKeywords.some(k => line.includes(k))) {
      title = line;
      continue;
    }
    if (!address && (line.includes('都') || line.includes('道') || line.includes('府') || line.includes('県') || line.includes('区') || line.includes('市'))) {
      if (/\d/.test(line)) {
        address = line;
        continue;
      }
    }
    remainingLines.push(line);
  }

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
    memo: '[ローカルOCR抽出]',
    tags: ['ローカルOCR解析']
  };
}

/**
 * オンデバイスOCRの抽出テキストが意味のある情報かノイズかを判定
 * @param {string} text - OCR抽出テキスト
 * @returns {boolean}
 */
export function isOcrTextValid(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.replace(/\s+/g, '');
  if (clean.length < 4) return false;

  // メールアドレス、電話番号、郵便番号の検知
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(clean);
  const hasPhone = /(?:0\d{1,4})[-\s]?\d{1,4}[-\s]?\d{3,4}/.test(clean);
  const hasPostal = /〒?\s?\d{3}[-\s]\d{4}/.test(clean);
  if (hasEmail || hasPhone || hasPostal) return true;

  // 会社名・組織・役職などのキーワード検知
  const keywords = ['株式会社', '有限会社', '合同会社', '一般社団法人', '代表', '取締役', '社長', '部長', '課長', 'マネージャー', 'TEL', 'FAX', 'EMAIL', '〒'];
  if (keywords.some(k => clean.includes(k))) return true;

  // 漢字・ひらがな・カタカナの意味のある日本語文字が一定以上含まれているか
  const japaneseChars = clean.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g) || [];
  if (japaneseChars.length >= 4) return true;

  // 意味のある英単語（3文字以上）が一定数含まれているか
  const englishWords = clean.match(/[a-zA-Z]{3,}/g) || [];
  if (englishWords.length >= 2) return true;

  return false;
}

/**
 * AI API全滅時の完全ローカルフォールバック用パーサー (複数枚対応)
 */
export function parseOcrTextToCard(rawText, options = {}) {
  if (!rawText || !rawText.trim() || !isOcrTextValid(rawText)) {
    return {
      isBusinessCard: false,
      reason: 'AI解析に失敗し、かつ画像から文字情報を検知できませんでした。鮮明な画像で撮影し直すか、手動入力をお試しください。',
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

  const allLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = rawText.match(emailRegex) || [];

  // 複数のメールアドレスまたは明確なセパレータが存在する場合、複数カードとして分割パース
  if (options.isMultiScan || emails.length > 1) {
    const blocks = [];
    let currentBlock = [];

    for (const line of allLines) {
      currentBlock.push(line);
      // メールアドレス行が出現したらブロックを区切る
      if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line)) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    }
    if (currentBlock.length > 0) {
      blocks.push(currentBlock);
    }

    if (blocks.length > 1) {
      const cards = blocks.map(b => parseSingleCardFromLines(b)).filter(c => c.name || c.company || c.phone || c.email);
      if (cards.length > 0) {
        return {
          isBusinessCard: true,
          cards
        };
      }
    }
  }

  const single = parseSingleCardFromLines(allLines);
  return {
    isBusinessCard: true,
    ...single
  };
}
