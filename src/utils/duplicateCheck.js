import { normalizePhoneNumber } from '../db/db';

/**
 * 新規名刺データと既存名刺リストを照合し、重複する既存名刺を検出します。
 * 
 * 判定条件:
 * 1. 氏名 ＆ 会社名が共に一致（空白除去・大文字小文字不問）
 * 2. メールアドレスが一致（小文字化・トリム）
 * 3. 固定電話番号または携帯電話番号が正規化後に一致
 * 
 * @param {Object} newCard - 新規登録しようとしている名刺データ
 * @param {Array<Object>} existingCards - DB等から取得した既存名刺データの配列
 * @returns {Object|null} 重複している既存名刺オブジェクト（重複なしの場合は null）
 */
export function findDuplicateCard(newCard, existingCards) {
  if (!newCard || !Array.isArray(existingCards) || existingCards.length === 0) {
    return null;
  }

  const name = (newCard.name || '').replace(/\s+/g, '').toLowerCase();
  const company = (newCard.company || '').replace(/\s+/g, '').toLowerCase();
  const email = (newCard.email || '').trim().toLowerCase();

  const phoneNorm = normalizePhoneNumber(newCard.phone);
  const mobileNorm = normalizePhoneNumber(newCard.mobile);

  for (const existing of existingCards) {
    const existName = (existing.name || '').replace(/\s+/g, '').toLowerCase();
    const existCompany = (existing.company || '').replace(/\s+/g, '').toLowerCase();
    const existEmail = (existing.email || '').trim().toLowerCase();

    const existPhoneNorm = existing.normalizedPhone || normalizePhoneNumber(existing.phone);
    const existMobileNorm = existing.normalizedMobile || normalizePhoneNumber(existing.mobile);

    // 1. 同一氏名 ＆ 同一会社名（両方に入力がある場合）
    if (name && company && existName && existCompany) {
      if (name === existName && company === existCompany) {
        return existing;
      }
    }

    // 2. 同一メールアドレス（入力がある場合）
    if (email && existEmail && email === existEmail) {
      return existing;
    }

    // 3. 同一電話番号 / 携帯番号（正規化後に比較、入力がある場合）
    if (phoneNorm && phoneNorm.length >= 7) {
      if ((existPhoneNorm && phoneNorm === existPhoneNorm) || (existMobileNorm && phoneNorm === existMobileNorm)) {
        return existing;
      }
    }

    if (mobileNorm && mobileNorm.length >= 7) {
      if ((existPhoneNorm && mobileNorm === existPhoneNorm) || (existMobileNorm && mobileNorm === existMobileNorm)) {
        return existing;
      }
    }
  }

  return null;
}
