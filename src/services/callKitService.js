/**
 * CallKit (iOS CXCallDirectoryProvider) および Android CallScreening 連携サービス
 * 標準連絡先アプリへ登録することなく、着信時に相手名（氏名・会社名）を表示するための識別データ生成
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { normalizePhoneNumber, toInternationalPhoneNumber } from '../db/db';

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
 * 国内形式(03..., 070...)と国際形式(+81...)の両方を登録して着信表示漏れを防止
 */
export function generateCallKitDirectoryData(cards) {
  const entries = [];
  const addedNumbers = new Set();

  cards.forEach(card => {
    const cleanedCompany = cleanCompanyName(card.company);
    const label = `${card.name}${cleanedCompany ? ` (${cleanedCompany})` : ''} [MeisiScan]`;

    const addPhoneEntries = (rawPhone, labelText) => {
      if (!rawPhone) return;

      const national = normalizePhoneNumber(rawPhone);
      const international = toInternationalPhoneNumber(rawPhone);

      // 国内番号形式 (0始まり) の追加
      if (national && !addedNumbers.has(national)) {
        entries.push({ phone: national, label: labelText, originalCard: card });
        addedNumbers.add(national);
      }
      // 国際番号形式 (+81) の追加
      if (international && !addedNumbers.has(international)) {
        entries.push({ phone: international, label: labelText, originalCard: card });
        addedNumbers.add(international);
      }
    };

    if (card.phone) {
      addPhoneEntries(card.phone, label);
    }
    if (card.mobile) {
      addPhoneEntries(card.mobile, `${label} (携帯)`);
    }
  });

  // 数値表現での昇順ソート（CallKitの必須仕様）
  entries.sort((a, b) => {
    const numA = BigInt(a.phone.replace(/[^\d]/g, ''));
    const numB = BigInt(b.phone.replace(/[^\d]/g, ''));
    return numA < numB ? -1 : numA > numB ? 1 : 0;
  });

  return entries;
}

/**
 * CallKit 着信識別用 CSV/テキストファイルをダウンロード出力
 */
export async function exportCallKitFile(cards) {
  const entries = generateCallKitDirectoryData(cards);
  
  let content = "# MeisiScan CallKit Identification Database\n";
  content += "# Format: PhoneNumber (E.164), DisplayLabel\n";
  entries.forEach(e => {
    content += `${e.phone},"${e.label}"\n`;
  });

  const filename = `MeisiScan_CallKit_Entries_${new Date().toISOString().slice(0,10)}.csv`;
  try {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'CallKit 識別データを共有',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('エラー', 'この端末ではファイル共有機能がサポートされていません。');
    }
  } catch (err) {
    console.error('CallKit ファイル共有エラー:', err);
    Alert.alert('エラー', 'CallKitファイルの共有に失敗しました。');
  }
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
 * CallKit 同期データをクリップボードにコピーして共有
 */
export async function shareCallKitData(cards) {
  const entries = generateCallKitDirectoryData(cards);
  const textContent = entries.map(e => `${e.phone} -> ${e.label}`).join('\n');

  try {
    await Clipboard.setStringAsync(textContent);
    Alert.alert('完了', 'CallKit 着信識別データをクリップボードにコピーしました！');
    return true;
  } catch (err) {
    console.error('クリップボードコピーエラー:', err);
    Alert.alert('エラー', 'クリップボードへのコピーに失敗しました。');
    return false;
  }
}
