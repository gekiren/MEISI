import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@meisi_cards_v1';

// 電話番号の正規化（ハイフン除去・CallKit検索用）
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+81' + cleaned.substring(1);
  }
  return cleaned;
}

// 全データ取得内部ヘルパー
async function loadCardsFromStorage() {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to load cards from AsyncStorage:', e);
    return [];
  }
}

// 全データ保存内部ヘルパー
async function saveCardsToStorage(cards) {
  try {
    const jsonValue = JSON.stringify(cards);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save cards to AsyncStorage:', e);
  }
}

// 名刺追加
export async function addCard(cardData) {
  const cards = await loadCardsFromStorage();
  const now = new Date().toISOString();
  const newCard = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    ...cardData,
    normalizedPhone: normalizePhoneNumber(cardData.phone),
    normalizedMobile: normalizePhoneNumber(cardData.mobile),
    isFavorite: cardData.isFavorite ? 1 : 0,
    tags: cardData.tags || [],
    createdAt: now,
    updatedAt: now
  };
  cards.unshift(newCard);
  await saveCardsToStorage(cards);
  return newCard.id;
}

// 名刺更新
export async function updateCard(id, cardData) {
  const cards = await loadCardsFromStorage();
  const now = new Date().toISOString();
  const index = cards.findIndex(c => c.id === id);
  if (index !== -1) {
    cards[index] = {
      ...cards[index],
      ...cardData,
      normalizedPhone: normalizePhoneNumber(cardData.phone),
      normalizedMobile: normalizePhoneNumber(cardData.mobile),
      isFavorite: cardData.isFavorite ? 1 : 0,
      tags: cardData.tags || [],
      updatedAt: now
    };
    await saveCardsToStorage(cards);
  }
}

// 名刺削除
export async function deleteCard(id) {
  let cards = await loadCardsFromStorage();
  cards = cards.filter(c => c.id !== id);
  await saveCardsToStorage(cards);
}

// すべての名刺取得
export async function getAllCards() {
  return await loadCardsFromStorage();
}
