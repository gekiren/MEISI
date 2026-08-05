import * as FileSystem from 'expo-file-system';

const IMAGE_DIR = `${FileSystem.documentDirectory}meisi_images/`;

/**
 * 画像保存先ディレクトリの存在確認と作成
 */
async function ensureDirExists() {
  const dirInfo = await FileSystem.getInfoAsync(IMAGE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIR, { intermediates: true });
  }
}

/**
 * 一時キャッシュ領域等の名刺画像を永続ストレージ領域（documentDirectory/meisi_images/）へ保存・コピー
 * @param {string} sourceUri
 * @returns {Promise<string>} 永続URI
 */
export async function saveImageToPermanentStorage(sourceUri) {
  if (!sourceUri || typeof sourceUri !== 'string') {
    return sourceUri;
  }

  // 既に永続ストレージ領域にある場合はそのまま返却
  if (sourceUri.startsWith(IMAGE_DIR)) {
    return sourceUri;
  }

  try {
    await ensureDirExists();

    const extMatch = sourceUri.match(/\.(jpg|jpeg|png|webp|heic)$/i);
    const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';

    const filename = `card_img_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
    const destinationUri = `${IMAGE_DIR}${filename}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destinationUri,
    });

    return destinationUri;
  } catch (error) {
    console.error('[imageStorage] Failed to save image to permanent storage:', error);
    return sourceUri;
  }
}

/**
 * 永続ストレージ内の画像ファイルを物理削除
 * @param {string} imageUri
 */
export async function deletePermanentImage(imageUri) {
  if (!imageUri || typeof imageUri !== 'string') {
    return;
  }

  // 永続ストレージ領域の画像のみ物理削除
  if (!imageUri.startsWith(IMAGE_DIR)) {
    return;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(imageUri, { idempotent: true });
    }
  } catch (error) {
    console.error('[imageStorage] Failed to delete permanent image:', error);
  }
}
