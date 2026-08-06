import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveImageToPermanentStorage, deletePermanentImage } from '../utils/imageStorage';

const STORAGE_KEY = '@meisi_cards_v1';
const DB_NAME = 'meisi_cards.db';

let dbInstance = null;

// データベースインスタンスの取得
export async function getDB() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbInstance;
}

// 電話番号の正規化（ハイフン除去・国内形式 0始まり）
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+81')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('81') && cleaned.length >= 10 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned.substring(2);
  }
  return cleaned;
}

// 国際電話番号形式（+81...）に変換
export function toInternationalPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+81' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+') && cleaned.startsWith('81')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+') && !cleaned.startsWith('0')) {
    cleaned = '+81' + cleaned;
  }
  return cleaned;
}

// 旧 AsyncStorage からの自動マイグレーション処理
async function migrateFromAsyncStorageIfNeeded(database) {
  try {
    const legacyData = await AsyncStorage.getItem(STORAGE_KEY);
    if (!legacyData) return;

    const cards = JSON.parse(legacyData);
    if (Array.isArray(cards) && cards.length > 0) {
      // 事前にデータをメモリ上に保持し、トランザクション内では runAsync のみ実行（デッドロック防止）
      await database.withTransactionAsync(async () => {
        for (const card of cards) {
          const tagsJson = JSON.stringify(card.tags || []);
          const normPhone = card.normalizedPhone || normalizePhoneNumber(card.phone);
          const normMobile = card.normalizedMobile || normalizePhoneNumber(card.mobile);
          const isFav = card.isFavorite ? 1 : 0;

          await database.runAsync(
            `INSERT OR REPLACE INTO cards (
              id, name, reading, company, department, title, phone, mobile,
              email, postalCode, address, website, memo, tags, image, isFavorite,
              normalizedPhone, normalizedMobile, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              card.id || Date.now() + Math.floor(Math.random() * 1000),
              card.name || '',
              card.reading || '',
              card.company || '',
              card.department || '',
              card.title || '',
              card.phone || '',
              card.mobile || '',
              card.email || '',
              card.postalCode || '',
              card.address || '',
              card.website || '',
              card.memo || '',
              tagsJson,
              card.image || null,
              isFav,
              normPhone,
              normMobile,
              card.createdAt || new Date().toISOString(),
              card.updatedAt || new Date().toISOString(),
            ]
          );
        }
      });
      console.log(`[SQLite Migration] Migrated ${cards.length} cards from AsyncStorage.`);
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[SQLite Migration] Migration error:', e);
  }
}

// データベースの初期化・テーブル作成
export async function initDatabase() {
  const database = await getDB();
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      name TEXT,
      reading TEXT,
      company TEXT,
      department TEXT,
      title TEXT,
      phone TEXT,
      mobile TEXT,
      email TEXT,
      postalCode TEXT,
      address TEXT,
      website TEXT,
      memo TEXT,
      tags TEXT,
      image TEXT,
      isFavorite INTEGER DEFAULT 0,
      normalizedPhone TEXT,
      normalizedMobile TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cards_normalizedPhone ON cards(normalizedPhone);
    CREATE INDEX IF NOT EXISTS idx_cards_company ON cards(company);
  `);

  await migrateFromAsyncStorageIfNeeded(database);
}

// DBレコードを JavaScript オブジェクトに整形
function formatCardRow(row) {
  let parsedTags = [];
  if (row.tags) {
    try {
      parsedTags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
    } catch {
      parsedTags = [];
    }
  }

  return {
    ...row,
    tags: Array.isArray(parsedTags) ? parsedTags : [],
    isFavorite: Number(row.isFavorite) === 1 ? 1 : 0
  };
}

// 名刺追加
export async function addCard(cardData) {
  const database = await getDB();
  const now = new Date().toISOString();
  const newId = cardData.id || (Date.now() + Math.floor(Math.random() * 1000));
  const tagsJson = JSON.stringify(cardData.tags || []);
  const normPhone = normalizePhoneNumber(cardData.phone);
  const normMobile = normalizePhoneNumber(cardData.mobile);
  const isFav = cardData.isFavorite ? 1 : 0;

  let imageUri = cardData.image || null;
  if (imageUri) {
    imageUri = await saveImageToPermanentStorage(imageUri);
  }

  await database.runAsync(
    `INSERT INTO cards (
      id, name, reading, company, department, title, phone, mobile,
      email, postalCode, address, website, memo, tags, image, isFavorite,
      normalizedPhone, normalizedMobile, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      cardData.name || '',
      cardData.reading || '',
      cardData.company || '',
      cardData.department || '',
      cardData.title || '',
      cardData.phone || '',
      cardData.mobile || '',
      cardData.email || '',
      cardData.postalCode || '',
      cardData.address || '',
      cardData.website || '',
      cardData.memo || '',
      tagsJson,
      imageUri,
      isFav,
      normPhone,
      normMobile,
      cardData.createdAt || now,
      now
    ]
  );

  return newId;
}

// 名刺更新
export async function updateCard(id, cardData) {
  const database = await getDB();
  const now = new Date().toISOString();
  const tagsJson = JSON.stringify(cardData.tags || []);
  const normPhone = normalizePhoneNumber(cardData.phone);
  const normMobile = normalizePhoneNumber(cardData.mobile);
  const isFav = cardData.isFavorite ? 1 : 0;

  const existing = await database.getFirstAsync('SELECT image FROM cards WHERE id = ?', [id]);
  const oldImage = existing?.image || null;

  let newImageUri = cardData.image || null;

  if (oldImage && oldImage !== newImageUri) {
    await deletePermanentImage(oldImage);
  }

  if (newImageUri && newImageUri !== oldImage) {
    newImageUri = await saveImageToPermanentStorage(newImageUri);
  }

  await database.runAsync(
    `UPDATE cards SET
      name = ?,
      reading = ?,
      company = ?,
      department = ?,
      title = ?,
      phone = ?,
      mobile = ?,
      email = ?,
      postalCode = ?,
      address = ?,
      website = ?,
      memo = ?,
      tags = ?,
      image = ?,
      isFavorite = ?,
      normalizedPhone = ?,
      normalizedMobile = ?,
      updatedAt = ?
    WHERE id = ?`,
    [
      cardData.name || '',
      cardData.reading || '',
      cardData.company || '',
      cardData.department || '',
      cardData.title || '',
      cardData.phone || '',
      cardData.mobile || '',
      cardData.email || '',
      cardData.postalCode || '',
      cardData.address || '',
      cardData.website || '',
      cardData.memo || '',
      tagsJson,
      newImageUri,
      isFav,
      normPhone,
      normMobile,
      now,
      id
    ]
  );
}

// 名刺削除
export async function deleteCard(id) {
  const database = await getDB();
  const existing = await database.getFirstAsync('SELECT image FROM cards WHERE id = ?', [id]);
  if (existing?.image) {
    await deletePermanentImage(existing.image);
  }
  await database.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}

// すべての名刺取得
export async function getAllCards() {
  const database = await getDB();
  const rows = await database.getAllAsync('SELECT * FROM cards ORDER BY id DESC');
  return rows.map(formatCardRow);
}
