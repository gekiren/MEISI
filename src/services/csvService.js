import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

/**
 * 名刺データの CSV 出力 (UTF-8 BOM付き Excel対応) サービス
 */

export async function exportCardsToCSV(cards, filename = 'meisi_export.csv') {
  if (!cards || cards.length === 0) {
    Alert.alert('通知', 'エクスポートする名刺データがありません。');
    return;
  }

  const headers = [
    'ID',
    '氏名',
    'フリガナ',
    '会社名',
    '部署名',
    '役職',
    '固定電話',
    '携帯電話',
    'メールアドレス',
    '郵便番号',
    '住所',
    'Webサイト',
    'タグ',
    'お気に入り',
    '登録日時'
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const stringified = String(str).replace(/"/g, '""');
    return `"${stringified}"`;
  };

  const rows = cards.map(c => [
    escapeCSV(c.id),
    escapeCSV(c.name),
    escapeCSV(c.reading),
    escapeCSV(c.company),
    escapeCSV(c.department),
    escapeCSV(c.title),
    escapeCSV(c.phone),
    escapeCSV(c.mobile),
    escapeCSV(c.email),
    escapeCSV(c.postalCode),
    escapeCSV(c.address),
    escapeCSV(c.website),
    escapeCSV(Array.isArray(c.tags) ? c.tags.join(';') : c.tags),
    escapeCSV(c.isFavorite ? 'はい' : 'いいえ'),
    escapeCSV(c.createdAt)
  ]);

  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows.map(r => r.join(','))].join('\r\n');

  try {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: '名刺データをCSV共有',
        UTI: 'public.comma-separated-values-text',
      });
    } else {
      Alert.alert('エラー', 'この端末ではファイル共有機能がサポートされていません。');
    }
  } catch (err) {
    console.error('CSV エクスポート失敗:', err);
    Alert.alert('エラー', 'CSVファイルのエクスポートに失敗しました。');
  }
}
