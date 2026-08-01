/**
 * CallKit (iOS CXCallDirectoryProvider) および Android CallScreening 連携サービス
 * 標準連絡先アプリへ登録することなく、着信時に相手名（氏名・会社名）を表示するための識別データ生成
 */

import { normalizePhoneNumber } from '../db/db';

/**
 * 会社名から「株式会社」「有限会社」などの法人種別表記（法人格表記）を除去して文字数を削減
 */
export function cleanCompanyName(company) {
  if (!company) return '';
  return company
    .replace(/(株式会社|有限会社|合同会社|合名会社|合資会社|一般社団法人|一般財団法人|公益社団法人|公益財団法人|医療法人|社会福祉法人|学校法人|Inc\.?|Co\.,?\s*Ltd\.?|Ltd\.?|Co\.?)/gi, '')
    .trim();
}

/**
 * 名刺リストから CallKit 準拠の着信識別データベース形式テキストを生成
 * iOS CallDirectory の仕様: 電話番号は昇順（昇順で数値ソート）
 */
export function generateCallKitDirectoryData(cards) {
  const entries = [];

  cards.forEach(card => {
    const cleanedCompany = cleanCompanyName(card.company);
    const label = `${card.name}${cleanedCompany ? ` (${cleanedCompany})` : ''} [MeisiScan]`;
    
    if (card.phone) {
      const normPhone = normalizePhoneNumber(card.phone);
      if (normPhone) {
        entries.push({ phone: normPhone, label, originalCard: card });
      }
    }
    if (card.mobile) {
      const normMobile = normalizePhoneNumber(card.mobile);
      if (normMobile && normMobile !== normalizePhoneNumber(card.phone)) {
        entries.push({ phone: normMobile, label: `${label} (携帯)`, originalCard: card });
      }
    }
  });

  // 数値表現での昇順ソート（CallKitの必須仕様）
  entries.sort((a, b) => {
    const numA = BigInt(a.phone.replace('+', ''));
    const numB = BigInt(b.phone.replace('+', ''));
    return numA < numB ? -1 : numA > numB ? 1 : 0;
  });

  return entries;
}

/**
 * CallKit 着信識別用 CSV/テキストファイルをダウンロード出力
 */
export function exportCallKitFile(cards) {
  const entries = generateCallKitDirectoryData(cards);
  
  let content = "# MeisiScan CallKit Identification Database\n";
  content += "# Format: PhoneNumber (E.164), DisplayLabel\n";
  entries.forEach(e => {
    content += `${e.phone},"${e.label}"\n`;
  });

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `MeisiScan_CallKit_Entries_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * vCard 形式 (標準連絡先保存用ではなく、CallDirectory同期や直接共有用) の生成
 */
export function generateVCard(card) {
  let vcard = "BEGIN:VCARD\nVERSION:3.0\n";
  vcard += `N:${card.name || ''};;;;\n`;
  vcard += `FN:${card.name || ''}\n`;
  if (card.company) vcard += `ORG:${card.company};${card.department || ''}\n`;
  if (card.title) vcard += `TITLE:${card.title}\n`;
  if (card.phone) vcard += `TEL;TYPE=WORK,VOICE:${card.phone}\n`;
  if (card.mobile) vcard += `TEL;TYPE=CELL,VOICE:${card.mobile}\n`;
  if (card.email) vcard += `EMAIL;TYPE=INTERNET:${card.email}\n`;
  if (card.address) vcard += `ADR;TYPE=WORK:;;${card.address};;;;\n`;
  if (card.website) vcard += `URL:${card.website}\n`;
  if (card.memo) vcard += `NOTE:${card.memo}\n`;
  vcard += "END:VCARD";
  return vcard;
}

/**
 * iOS Shortcut / Web Share API を使用して CallKit 同期データを共有
 */
export async function shareCallKitData(cards) {
  const entries = generateCallKitDirectoryData(cards);
  const textContent = entries.map(e => `${e.phone} -> ${e.label}`).join('\n');

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'MeisiScan CallKit 識別データ',
        text: `名刺 ${cards.length} 件の CallKit 着信相手表示用データ:\n\n` + textContent
      });
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
      }
    }
  } else {
    // クリップボードにコピー
    await navigator.clipboard.writeText(textContent);
    alert('CallKit 着信識別データをクリップボードにコピーしました！');
  }
  return false;
}
