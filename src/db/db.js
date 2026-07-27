import Dexie from 'dexie';

export const db = new Dexie('MeisiScanDB');

db.version(1).stores({
  cards: '++id, name, company, phone, mobile, email, isFavorite, createdAt, *tags'
});

// 電話番号の正規化（ハイフン除去・CallKit検索用）
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  // 数字と+記号以外を除去
  let cleaned = phone.replace(/[^\d+]/g, '');
  // 日本の市外局番 0から始まる場合は +81 に変換（CallKit国際規格対応）
  if (cleaned.startsWith('0')) {
    cleaned = '+81' + cleaned.substring(1);
  }
  return cleaned;
}

// 名刺追加
export async function addCard(cardData) {
  const now = new Date().toISOString();
  const id = await db.cards.add({
    ...cardData,
    normalizedPhone: normalizePhoneNumber(cardData.phone),
    normalizedMobile: normalizePhoneNumber(cardData.mobile),
    isFavorite: cardData.isFavorite ? 1 : 0,
    tags: cardData.tags || [],
    createdAt: now,
    updatedAt: now
  });
  return id;
}

// 名刺更新
export async function updateCard(id, cardData) {
  const now = new Date().toISOString();
  await db.cards.update(id, {
    ...cardData,
    normalizedPhone: normalizePhoneNumber(cardData.phone),
    normalizedMobile: normalizePhoneNumber(cardData.mobile),
    isFavorite: cardData.isFavorite ? 1 : 0,
    tags: cardData.tags || [],
    updatedAt: now
  });
}

// 名刺削除
export async function deleteCard(id) {
  await db.cards.delete(id);
}

// すべての名刺取得
export async function getAllCards() {
  return await db.cards.orderBy('createdAt').reverse().toArray();
}
