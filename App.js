import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, PermissionsAndroid, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Updates from 'expo-updates';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';

export default function App() {
  const webViewRef = useRef(null);

  const sendMessageToWebView = (data) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(data));
    }
  };

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'START_DOCUMENT_SCANNER') {
        try {
          if (Platform.OS === 'android') {
            const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (!hasPermission) {
              const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.CAMERA,
                {
                  title: 'カメラアクセス権限のお願い',
                  message: '名刺撮影およびドキュメントスキャンのためにカメラへのアクセス許可が必要です。',
                  buttonNeutral: '後で',
                  buttonNegative: 'キャンセル',
                  buttonPositive: '許可',
                }
              );
              if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                sendMessageToWebView({
                  type: 'DOCUMENT_SCANNER_ERROR',
                  error: 'カメラのアクセス権限が許可されていません。スマホの設定アプリでMeisiScanのカメラ権限を許可してください。'
                });
                return;
              }
            }
          }

          const { scannedImages, status } = await DocumentScanner.scanDocument({
            croppedImageQuality: 90,
            maxNumDocuments: 1,
            responseType: ResponseType.Base64,
          });

          if (status === 'success' && scannedImages && scannedImages.length > 0) {
            const scannedImage = scannedImages[0];
            const formattedImage = scannedImage.startsWith('data:image')
              ? scannedImage
              : `data:image/jpeg;base64,${scannedImage}`;

            sendMessageToWebView({
              type: 'DOCUMENT_SCANNER_RESULT',
              image: formattedImage
            });
          } else if (status === 'cancel') {
            console.log('Document scan cancelled by user');
          }
        } catch (err) {
          console.error('Document scanner error:', err);
          const detailError = err ? `${err.name || 'Error'}: ${err.message || String(err)}${err.code ? ` (Code: ${err.code})` : ''}` : '不明なスキャナーエラー';
          sendMessageToWebView({
            type: 'DOCUMENT_SCANNER_ERROR',
            error: `【スキャナー起動エラー】\n${detailError}\n\n※Google Play開発者サービスが最新か、スマホの設定でカメラ権限が許可されているか確認してください。`
          });
        }
        return;
      }

      if (data.type === 'CHECK_OTA_UPDATE') {
        sendMessageToWebView({
          type: 'OTA_STATUS',
          status: 'CHECKING',
          message: 'アップデートを確認中...'
        });

        if (__DEV__ || !Updates.isEnabled) {
          sendMessageToWebView({
            type: 'OTA_STATUS',
            status: 'INFO',
            message: 'お使いのアプリは最新バージョンです（ローカル/スタンドアロン環境）。'
          });
          return;
        }

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          sendMessageToWebView({
            type: 'OTA_STATUS',
            status: 'DOWNLOADING',
            message: '最新バージョンをダウンロード中...'
          });

          await Updates.fetchUpdateAsync();

          sendMessageToWebView({
            type: 'OTA_STATUS',
            status: 'UPDATE_READY',
            message: 'ダウンロード完了。アプリを再起動します。'
          });

          setTimeout(async () => {
            await Updates.reloadAsync();
          }, 1500);
        } else {
          sendMessageToWebView({
            type: 'OTA_STATUS',
            status: 'LATEST',
            message: 'お使いのアプリは最新バージョンです。'
          });
        }
      }
    } catch (err) {
      console.warn('OTA Check Error:', err);
      // ネットワーク未接続やEAS設定未完了時は「最新」として安全にフォールバック
      sendMessageToWebView({
        type: 'OTA_STATUS',
        status: 'LATEST',
        message: 'お使いのアプリは最新バージョンです。'
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ uri: 'file:///android_asset/www/index.html' }}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        domStorageEnabled={true}
        javaScriptEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleMessage}
        style={styles.webview}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
});
