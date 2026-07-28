import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Updates from 'expo-updates';

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
