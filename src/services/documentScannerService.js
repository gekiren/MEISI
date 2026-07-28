/**
 * OS標準ドキュメントスキャナー (Android: Google Document Scanner / iOS: VisionKit) 連携サービス
 */

/**
 * ネイティブ環境（ReactNativeWebView）でOS標準スキャナーが使用可能かを判定
 */
export function isNativeScannerAvailable() {
  return typeof window !== 'undefined' && !!window.ReactNativeWebView;
}

/**
 * OS標準ドキュメントスキャナーの起動リクエストをネイティブアプリへ送信
 */
export function scanDocumentWithNativeScanner() {
  if (isNativeScannerAvailable()) {
    console.log('Sending START_DOCUMENT_SCANNER request to Native App...');
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'START_DOCUMENT_SCANNER',
      options: {
        pageLimit: 1,
        galleryImportAllowed: true
      }
    }));
    return true;
  }
  return false;
}
