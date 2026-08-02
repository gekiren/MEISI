import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Image, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Camera, Sparkles, AlertCircle, CheckCircle2, ScanLine, Image as ImageIcon, Grid, Layers } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { analyzeBusinessCardWithFallback } from '../services/aiService';
import { addCard } from '../db/db';
import { theme } from '../theme';

export default function ScannerModalNative({
  isOpen,
  onClose,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl,
  onCardAdded
}) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [extractedCards, setExtractedCards] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [newTagInput, setNewTagInput] = useState('');

  const [isMultiScan, setIsMultiScan] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [isDesignCard, setIsDesignCard] = useState(false);
  const [multiCropMode, setMultiCropMode] = useState('ai'); // 'ai' | 'manual'

  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen]);

  const handleReset = () => {
    setSelectedImages([]);
    setExtractedCards([]);
    setActiveCardIndex(0);
    setErrorMsg(null);
    setIsAnalyzing(false);
    setStatusNotice(null);
    setNewTagInput('');
    setMultiCropMode('ai');
  };

  // 画像URI/Base64をAI送信用Base64へ安全にオンデマンド変換 (ガード付き)
  const ensureBase64Image = async (imageUri) => {
    if (!imageUri) throw new Error('画像データが存在しません。');
    if (imageUri.startsWith('data:image')) {
      return imageUri;
    }

    try {
      let cleanUri = imageUri;
      if (!cleanUri.startsWith('file://') && !cleanUri.startsWith('content://') && cleanUri.startsWith('/')) {
        cleanUri = `file://${cleanUri}`;
      }
      const base64Str = await FileSystem.readAsStringAsync(cleanUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (base64Str && base64Str.length > 100) {
        return `data:image/jpeg;base64,${base64Str}`;
      }
    } catch (err) {
      console.warn('FileSystem.readAsStringAsync failed:', err);
    }

    // パス文字列がそのまま残っている場合はAI送信を即座に安全ガード
    if (imageUri.startsWith('file://') || imageUri.startsWith('content://') || imageUri.startsWith('/')) {
      throw new Error('画像の読み込みに失敗しました。端末の設定または画像パーミッションをご確認ください。');
    }

    return `data:image/jpeg;base64,${imageUri}`;
  };

  // 画像選択/撮影後の処理分岐 (複数枚の場合: AIにおまかせ vs 1枚ずつ手動)
  const processImagesWithChoice = async (imagesList) => {
    if (imagesList.length === 0) return;

    // 1枚のみ、または「AIに任せる」設定の場合は即座に解析へ
    if (imagesList.length === 1 || multiCropMode === 'ai') {
      setSelectedImages(imagesList);
      setErrorMsg(null);
      startBatchAnalysis(imagesList);
      return;
    }

    // 複数枚で「手動で範囲調整」モードの場合はダイアログで最終確認
    Alert.alert(
      '複数枚の処理方法',
      `${imagesList.length} 枚の画像を選択中です。\n\n手動範囲指定モードが選択されています。選択済み画像をそのままAI解析に使用しますか？\nまたは、カメラで1枚ずつ撮影＋範囲指定に切り替えますか？`,
      [
        {
          text: '📷 カメラで1枚ずつ撮影',
          onPress: () => launchSequentialCameraWithCrop(imagesList.length)
        },
        {
          text: '🤖 そのままAI解析',
          onPress: () => {
            setSelectedImages(imagesList);
            setErrorMsg(null);
            startBatchAnalysis(imagesList);
          }
        }
      ]
    );
  };

  // 手動モード: カメラで1枚ずつ順次撮影（allowsEditing: false でブラックアウト防止）
  const launchSequentialCameraWithCrop = async (totalCount) => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('アクセス権限が必要', '撮影するにはカメラへのアクセス許可が必要です。');
        return;
      }

      const capturedList = [];
      let aborted = false;

      for (let i = 0; i < totalCount; i++) {
        if (aborted) break;

        await new Promise((resolve) => {
          Alert.alert(
            `名刺 ${i + 1} / ${totalCount} 枚目を撮影`,
            'カメラが起動します。名刺全体が収まるように撮影してください。',
            [
              { text: 'カメラを起動', onPress: resolve },
              {
                text: 'スキップ',
                style: 'cancel',
                onPress: () => {
                  aborted = true;
                  resolve();
                }
              }
            ]
          );
        });

        if (aborted) break;

        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false, // Android ブラックアウト防止のため false を維持
          quality: 0.85,
          base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const img = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;
          capturedList.push(img);
        } else {
          // 撮影キャンセル時: 撮影済みがあればそのまま解析へ、なければ終了
          aborted = true;
        }
      }

      // 1枚でも撮影できていれば必ずAI解析へ
      if (capturedList.length > 0) {
        setSelectedImages(capturedList);
        setErrorMsg(null);
        startBatchAnalysis(capturedList);
      }
    } catch (err) {
      console.warn('Sequential camera error:', err);
      Alert.alert('エラー', 'カメラ撮影中にエラーが発生しました。');
    }
  };

  // 手動モードで枚数を先に選んでカメラ起動（カメラボタンから直接）
  const launchManualMultiCamera = () => {
    Alert.alert(
      '撮影枚数を選択',
      '何枚の名刺を撮影しますか？\n（最大4枚）',
      [
        { text: '1枚', onPress: () => launchSequentialCameraWithCrop(1) },
        { text: '2枚', onPress: () => launchSequentialCameraWithCrop(2) },
        { text: '3枚', onPress: () => launchSequentialCameraWithCrop(3) },
        { text: '4枚', onPress: () => launchSequentialCameraWithCrop(4) },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  };

  // ギャラリーから画像を選択 (Expo ImagePicker - base64: true, quality: 0.75)
  const pickImagesFromGallery = async () => {
    // 手動モード x 複数枚 の場合はカメラ順次撮影フローへ誘導
    if (isMultiScan && multiCropMode === 'manual') {
      launchManualMultiCamera();
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('アクセス権限が必要', '名刺画像を選択するにはアルバムへのアクセス許可が必要です。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: isMultiScan,
        selectionLimit: isMultiScan ? 4 : 1,
        quality: 0.75,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (result.assets.length >= 5) {
          Alert.alert('制限超過', '一度にスキャンできる名刺は最大4枚までです。4枚以下を選択してください。');
          return;
        }

        const images = result.assets.map(asset => {
          if (asset.base64) {
            return `data:image/jpeg;base64,${asset.base64}`;
          }
          return asset.uri;
        }).filter(Boolean);

        processImagesWithChoice(images);
      }
    } catch (err) {
      console.error('Pick image error:', err);
      Alert.alert('エラー', '画像の選択に失敗しました。');
    }
  };

  // 高画質カメラ撮影 (手動モード時は順次カメラ起動、通常モードは allowsEditing: false で安全起動)
  const launchCameraWithGridCrop = async () => {
    // 手動モード x 複数枚 の場合は順次カメラ撮影フローへ
    if (isMultiScan && multiCropMode === 'manual') {
      launchManualMultiCamera();
      return;
    }

    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('アクセス権限が必要', '名刺を撮影するにはカメラへのアクセス許可が必要です。');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false, // Android でのブラックアウト防止のため false に変更
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsAnalyzing(true);
        setStatusNotice('撮影画像を読み込み中...');

        const asset = result.assets[0];
        const cameraImg = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;

        setSelectedImages([cameraImg]);
        setErrorMsg(null);
        startBatchAnalysis([cameraImg]);
      }
    } catch (err) {
      console.error('Grid camera error:', err);
      setIsAnalyzing(false);
      Alert.alert('エラー', 'カメラの起動に失敗しました。アルバム選択をお試しください。');
    }
  };

  // 通常カメラでのフォールバック撮影 (base64: true, quality: 0.75)
  const launchCameraFallback = async () => {
    return launchCameraWithGridCrop();
  };

  // OS標準ドキュメントスキャナーの起動 (ResponseType.Base64, croppedImageQuality: 75)
  const launchNativeDocumentScanner = async () => {
    // 4点指定ではなくグリッド範囲調整カメラへ自動ルーティング
    return launchCameraWithGridCrop();
  };

  // AI解析実行
  const startBatchAnalysis = async (imagesList) => {
    setIsAnalyzing(true);
    setStatusNotice('AI 解析を実行中...');
    setErrorMsg(null);
    setExtractedCards([]);

    // 複数画像が指定されている場合も isMultiScan を有効化
    const effectiveMultiScan = isMultiScan || imagesList.length > 1;
    const scanOptions = { isVertical, isDesignCard, isMultiScan: effectiveMultiScan };
    const allCards = [];
    let hasError = false;
    let lastErrorReason = null;

    try {
      for (let i = 0; i < imagesList.length; i++) {
        const rawUri = imagesList[i];
        if (imagesList.length > 1) {
          setStatusNotice(`AI 解析中 (${i + 1} / ${imagesList.length} 枚目)...`);
        }

        // オンデマンドで Base64 へ安全に変換 (OOM回避)
        const base64Img = await ensureBase64Image(rawUri);

        const result = await analyzeBusinessCardWithFallback(
          base64Img,
          geminiApiKey,
          deepSeekApiKey,
          workerProxyUrl,
          (msg) => setStatusNotice(msg),
          scanOptions
        );

        if (result.isBusinessCard === false) {
          hasError = true;
          lastErrorReason = result.reason || '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。';
          continue;
        }

        // 応答内に `cards` 配列が存在する場合 (1画像内に複数名刺)
        if (Array.isArray(result.cards) && result.cards.length > 0) {
          if (result.cards.length >= 5) {
            hasError = true;
            lastErrorReason = '画像内に5枚以上の名刺が検知されました。4枚以下にして再度撮影してください。';
            continue;
          }
          result.cards.forEach((c) => {
            const cleanName = (c.name || '').replace(/[(（]名刺読み取り失敗[）)]/g, '').replace(/[(（]氏名未検出[）)]/g, '').trim();
            allCards.push({
              name: cleanName,
              reading: c.reading || '',
              company: c.company || '',
              department: c.department || '',
              title: c.title || '',
              phone: c.phone || '',
              mobile: c.mobile || '',
              email: c.email || '',
              postalCode: c.postalCode || '',
              address: c.address || '',
              website: c.website || '',
              memo: c.memo || '',
              tags: Array.isArray(c.tags) && c.tags.length > 0 ? c.tags : ['新規名刺'],
              image: rawUri
            });
          });
        } else {
          // 単一カード構造の応答
          const cleanName = (result.name || '').replace(/[(（]名刺読み取り失敗[）)]/g, '').replace(/[(（]氏名未検出[）)]/g, '').trim();
          const hasCoreInfo = cleanName || result.company || result.phone || result.mobile || result.email;
          if (!hasCoreInfo) {
            hasError = true;
            lastErrorReason = '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。';
            continue;
          }

          allCards.push({
            name: cleanName,
            reading: result.reading || '',
            company: result.company || '',
            department: result.department || '',
            title: result.title || '',
            phone: result.phone || '',
            mobile: result.mobile || '',
            email: result.email || '',
            postalCode: result.postalCode || '',
            address: result.address || '',
            website: result.website || '',
            memo: result.memo || '',
            tags: Array.isArray(result.tags) && result.tags.length > 0 ? result.tags : ['新規名刺'],
            image: rawUri
          });
        }
      }

      if (allCards.length === 0) {
        setErrorMsg(lastErrorReason || '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。');
      } else {
        setExtractedCards(allCards);
        setActiveCardIndex(0);
        if (hasError && lastErrorReason) {
          setErrorMsg(`一部の画像で注意: ${lastErrorReason}`);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'AI解析に失敗しました。鮮明な画像で再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAllCards = async () => {
    if (extractedCards.length === 0) return;

    for (let i = 0; i < extractedCards.length; i++) {
      if (!extractedCards[i].name) {
        Alert.alert('入力エラー', `名刺 #${i + 1} の氏名が入力されていません。`);
        setActiveCardIndex(i);
        return;
      }
    }

    try {
      for (const card of extractedCards) {
        await addCard(card);
      }
      Alert.alert('成功', `${extractedCards.length} 件の名刺を保存しました！`);
      onCardAdded();
      onClose();
    } catch (err) {
      console.error('Failed to save cards:', err);
      Alert.alert('エラー', '名刺の保存に失敗しました。');
    }
  };

  const updateActiveCardField = (field, value) => {
    const updated = [...extractedCards];
    updated[activeCardIndex] = { ...updated[activeCardIndex], [field]: value };
    setExtractedCards(updated);
  };

  const currentCard = extractedCards[activeCardIndex];

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <Camera size={20} color={theme.colors.accentPrimary} />
              <Text style={styles.modalTitle}>
                {isMultiScan ? '複数名刺スキャン (最大4枚)' : '名刺スキャン & AI自動解析'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {selectedImages.length === 0 && (
              <>
                {/* スキャンモード切替タブ */}
                <View style={styles.tabBar}>
                  <TouchableOpacity
                    style={[styles.tabBtn, !isMultiScan && styles.tabBtnActive]}
                    onPress={() => setIsMultiScan(false)}
                  >
                    <Camera size={14} color={!isMultiScan ? '#FFF' : theme.colors.textMuted} />
                    <Text style={[styles.tabText, !isMultiScan && styles.tabTextActive]}>通常スキャン (1枚)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, isMultiScan && styles.tabBtnActiveGradient]}
                    onPress={() => setIsMultiScan(true)}
                  >
                    <Layers size={14} color={isMultiScan ? '#FFF' : theme.colors.textMuted} />
                    <Text style={[styles.tabText, isMultiScan && styles.tabTextActive]}>複数スキャン (最大4枚)</Text>
                  </TouchableOpacity>
                </View>

                {/* 2x2ガイド表示 */}
                {isMultiScan && (
                  <View style={styles.guideBox}>
                    <Grid size={24} color="#818CF8" style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.guideTitle}>💡 複数名刺スキャンガイド (最大4枚まで)</Text>
                      <Text style={styles.guideDesc}>
                        机の上に名刺を最大4枚（2×2の田の字配置推奨）並べて撮影するか、ギャラリーから最大4枚まで選択してください。
                      </Text>
                    </View>
                  </View>
                )}

                {/* 詳細オプション */}
                <View style={styles.optionsRow}>
                  <TouchableOpacity
                    style={styles.optionLabel}
                    onPress={() => setIsVertical(!isVertical)}
                  >
                    <View style={[styles.checkbox, isVertical && styles.checkboxActive]}>
                      {isVertical && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.optionText}>↕ 縦書き{'\n'}レイアウト</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.optionLabel}
                    onPress={() => setIsDesignCard(!isDesignCard)}
                  >
                    <View style={[styles.checkbox, isDesignCard && { backgroundColor: theme.colors.accentPink, borderColor: theme.colors.accentPink }]}>
                      {isDesignCard && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.optionText}>🎨 デザイン・{'\n'}カラー名刺</Text>
                  </TouchableOpacity>
                </View>

                {/* 複数枚スキャン時の範囲指定方法選択 */}
                {isMultiScan && (
                  <View style={{
                    marginBottom: 16,
                    padding: 10,
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: 'rgba(99, 102, 241, 0.2)'
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, marginBottom: 6 }}>
                      複数枚の範囲指定モード:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: theme.radius.sm,
                          backgroundColor: multiCropMode === 'ai' ? theme.colors.accentPrimary : 'transparent',
                          borderWidth: 1,
                          borderColor: multiCropMode === 'ai' ? theme.colors.accentPrimary : 'rgba(255, 255, 255, 0.15)',
                          alignItems: 'center'
                        }}
                        onPress={() => setMultiCropMode('ai')}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: multiCropMode === 'ai' ? '#FFF' : theme.colors.textMuted }}>
                          🤖 AIに任せる (自動分割)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          paddingHorizontal: 8,
                          borderRadius: theme.radius.sm,
                          backgroundColor: multiCropMode === 'manual' ? theme.colors.accentPrimary : 'transparent',
                          borderWidth: 1,
                          borderColor: multiCropMode === 'manual' ? theme.colors.accentPrimary : 'rgba(255, 255, 255, 0.15)',
                          alignItems: 'center'
                        }}
                        onPress={() => setMultiCropMode('manual')}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '600', color: multiCropMode === 'manual' ? '#FFF' : theme.colors.textMuted }}>
                          ✂️ 1枚ずつ手動指定
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* グリッド範囲調整カメラ撮影ボタン */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.scannerBtnWrapper}
                  onPress={launchCameraWithGridCrop}
                >
                  <LinearGradient
                    colors={['#06B6D4', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.scannerBtn}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ScanLine size={18} color="#FFF" />
                      <Text style={styles.scannerBtnTitle}>グリッドガイド付きカメラで撮影</Text>
                    </View>
                    <Text style={styles.scannerBtnSub}>(4点指定ではなく格子状矩形枠で範囲調整)</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* ギャラリードロップゾーン */}
                <TouchableOpacity style={styles.dropZone} onPress={pickImagesFromGallery}>
                  <View style={styles.dropZoneIconCircle}>
                    {isMultiScan ? <Grid size={28} color="#FFF" /> : <ImageIcon size={28} color="#FFF" />}
                  </View>
                  <Text style={styles.dropZoneTitle}>
                    {isMultiScan ? 'アルバムから複数名刺画像を選択 (最大4枚)' : 'アルバムから名刺画像を選択 / アップロード'}
                  </Text>
                  <Text style={styles.dropZoneDesc}>
                    {isMultiScan
                      ? '机の上に最大4枚並べて撮影した写真または複数枚の画像を一度に選択可能です'
                      : '端末に保存された名刺画像を選択すると、AI が自動で情報抽出します'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* AI解析中表示 */}
            {isAnalyzing && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.colors.accentPrimary} />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
                  <Sparkles size={18} color={theme.colors.accentSecondary} />
                  <Text style={styles.loadingText}>{statusNotice || 'AI 解析を実行中...'}</Text>
                </View>
              </View>
            )}

            {/* エラーメッセージ */}
            {errorMsg && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color={theme.colors.danger} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
                    <Text style={styles.retryBtnText}>↻ 撮影・画像をやり直す</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 解析完了カード編集フォーム */}
            {extractedCards.length > 0 && !isAnalyzing && currentCard && (
              <View>
                {extractedCards.length > 1 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {extractedCards.map((card, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[styles.cardTabBtn, idx === activeCardIndex && styles.cardTabBtnActive]}
                        onPress={() => setActiveCardIndex(idx)}
                      >
                        <Text style={[styles.cardTabText, idx === activeCardIndex && styles.cardTabTextActive]}>
                          名刺 #{idx + 1}: {card.name || '未入力'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* 解析結果ステータスバナー */}
                {currentCard.name ? (
                  <View style={styles.successBanner}>
                    <CheckCircle2 size={18} color={theme.colors.accentGreen} />
                    <Text style={styles.successBannerText}>
                      {extractedCards.length > 1
                        ? `${extractedCards.length} 件の名刺を抽出しました！`
                        : 'AI解析が完了しました！内容を確認して保存してください。'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.warningBanner}>
                    <AlertCircle size={18} color="#F59E0B" />
                    <Text style={styles.warningBannerText}>
                      ⚠️ 氏名が自動検出されませんでした。名刺画像を確認して氏名を入力してください。
                    </Text>
                  </View>
                )}

                {currentCard.image && (
                  <Image source={{ uri: currentCard.image }} style={styles.previewImage} resizeMode="contain" />
                )}

                {/* フォーム入力フィールド */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>氏名 *</Text>
                  <TextInput
                    style={styles.input}
                    value={currentCard.name}
                    onChangeText={(val) => updateActiveCardField('name', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>フリガナ</Text>
                  <TextInput
                    style={styles.input}
                    value={currentCard.reading}
                    onChangeText={(val) => updateActiveCardField('reading', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>会社名</Text>
                  <TextInput
                    style={styles.input}
                    value={currentCard.company}
                    onChangeText={(val) => updateActiveCardField('company', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>役職</Text>
                  <TextInput
                    style={styles.input}
                    value={currentCard.title}
                    onChangeText={(val) => updateActiveCardField('title', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>固定電話番号 (CallKit同期対象)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={currentCard.phone}
                    onChangeText={(val) => updateActiveCardField('phone', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>携帯電話番号 (CallKit同期対象)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={currentCard.mobile}
                    onChangeText={(val) => updateActiveCardField('mobile', val)}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>メールアドレス</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="email-address"
                    value={currentCard.email}
                    onChangeText={(val) => updateActiveCardField('email', val)}
                  />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAllCards}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnGradient}
                  >
                    <Text style={styles.saveBtnText}>
                      {extractedCards.length > 1 ? `${extractedCards.length} 件を一括保存` : 'データベースに保存'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: theme.colors.bgModal,
    borderRadius: theme.radius.lg,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textMain,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 4,
    borderRadius: theme.radius.md,
    marginBottom: 14,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
  },
  tabBtnActiveGradient: {
    backgroundColor: theme.colors.accentSecondary,
  },
  tabText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  guideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: theme.radius.md,
    marginBottom: 14,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  guideDesc: {
    fontSize: 11,
    color: '#C7D2FE',
    lineHeight: 15,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: 14,
  },
  optionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  optionText: {
    fontSize: 12,
    color: theme.colors.textMain,
    lineHeight: 16,
  },
  scannerBtnWrapper: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 14,
  },
  scannerBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerBtnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  scannerBtnSub: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  dropZoneIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropZoneTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMain,
    marginBottom: 4,
    textAlign: 'center',
  },
  dropZoneDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accentSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.radius.md,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: theme.radius.md,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 13,
    color: theme.colors.accentGreen,
    fontWeight: '600',
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: theme.radius.md,
    marginBottom: 16,
  },
  warningBannerText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    flex: 1,
  },
  cardTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.bgGlass,
    borderRadius: theme.radius.full,
    marginRight: 6,
  },
  cardTabBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
  },
  cardTabText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  cardTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: theme.radius.md,
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.bgInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    height: 40,
    color: theme.colors.textMain,
    fontSize: 13,
  },
  saveBtn: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginTop: 12,
  },
  saveBtnGradient: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  retryBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  retryBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
