import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Image, Alert, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Camera, Sparkles, AlertCircle, CheckCircle2, ScanLine, Image as ImageIcon, Grid, Layers, Tag as TagIcon } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import DocumentScanner, { ResponseType } from 'react-native-document-scanner-plugin';
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
  };

  // ギャラリーから画像を選択 (Expo ImagePicker)
  const pickImagesFromGallery = async () => {
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
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (result.assets.length >= 5) {
          Alert.alert('制限超過', '一度にスキャンできる名刺は最大4枚までです。4枚以下を選択してください。');
          return;
        }

        const base64Images = result.assets.map(asset => 
          asset.base64?.startsWith('data:image') 
            ? asset.base64 
            : `data:image/jpeg;base64,${asset.base64}`
        );

        setSelectedImages(base64Images);
        setErrorMsg(null);
        startBatchAnalysis(base64Images);
      }
    } catch (err) {
      console.error('Pick image error:', err);
      Alert.alert('エラー', '画像の選択に失敗しました。');
    }
  };

  // 通常カメラでのフォールバック撮影
  const launchCameraFallback = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('アクセス権限が必要', '名刺を撮影するにはカメラへのアクセス許可が必要です。');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.9,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const base64Img = result.assets[0].base64?.startsWith('data:image') 
          ? result.assets[0].base64 
          : `data:image/jpeg;base64,${result.assets[0].base64}`;

        setSelectedImages([base64Img]);
        setErrorMsg(null);
        startBatchAnalysis([base64Img]);
      }
    } catch (err) {
      console.error('Camera fallback error:', err);
      Alert.alert('エラー', 'カメラの起動に失敗しました。アルバム選択をお試しください。');
    }
  };

  // OS標準ドキュメントスキャナーの起動
  const launchNativeDocumentScanner = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('アクセス権限が必要', 'ドキュメントスキャンを行うにはカメラへのアクセス許可が必要です。');
        return;
      }

      const { scannedImages, status } = await DocumentScanner.scanDocument({
        croppedImageQuality: 90,
        maxNumDocuments: isMultiScan ? 4 : 1,
        responseType: ResponseType.Base64,
      });

      if (status === 'success' && scannedImages && scannedImages.length > 0) {
        if (scannedImages.length >= 5) {
          Alert.alert('制限超過', '一度にスキャンできる名刺は最大4枚までです。');
          return;
        }

        const formattedImages = scannedImages.map(img =>
          img.startsWith('data:image') ? img : `data:image/jpeg;base64,${img}`
        );

        setSelectedImages(formattedImages);
        setErrorMsg(null);
        startBatchAnalysis(formattedImages);
      }
    } catch (err) {
      console.error('Document scanner error:', err);
      Alert.alert(
        'スキャナー起動エラー',
        'ドキュメントスキャナーの起動に失敗しました。\n\n通常のカメラで撮影しますか？',
        [
          { text: 'アルバム選択', style: 'cancel' },
          { text: '通常カメラ撮影', onPress: () => launchCameraFallback() }
        ]
      );
    }
  };

  // AI解析実行
  const startBatchAnalysis = async (imagesList) => {
    setIsAnalyzing(true);
    setStatusNotice('AI 解析を実行中...');
    setErrorMsg(null);
    setExtractedCards([]);

    const scanOptions = { isVertical, isDesignCard, isMultiScan };
    const allCards = [];
    let hasError = false;
    let lastErrorReason = null;

    try {
      for (let i = 0; i < imagesList.length; i++) {
        const img = imagesList[i];
        if (imagesList.length > 1) {
          setStatusNotice(`AI 解析中 (${i + 1} / ${imagesList.length} 枚目)...`);
        }

        const result = await analyzeBusinessCardWithFallback(
          img,
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

        if (Array.isArray(result.cards) && result.cards.length > 0) {
          if (result.cards.length >= 5) {
            hasError = true;
            lastErrorReason = '画像内に5枚以上の名刺が検知されました。4枚以下にして再度撮影してください。';
            continue;
          }
          result.cards.forEach((c) => {
            allCards.push({
              name: c.name || '',
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
              tags: c.tags || ['新規名刺'],
              image: img
            });
          });
        } else {
          const hasCoreInfo = result.name || result.company || result.phone || result.mobile || result.email;
          if (!hasCoreInfo && !result.memo?.includes('ローカルOCR')) {
            hasError = true;
            lastErrorReason = '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。';
            continue;
          }

          allCards.push({
            name: result.name || '',
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
            tags: result.tags || ['新規名刺'],
            image: img
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

                {/* OS標準ドキュメントスキャナーボタン */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.scannerBtnWrapper}
                  onPress={launchNativeDocumentScanner}
                >
                  <LinearGradient
                    colors={['#06B6D4', '#3B82F6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.scannerBtn}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ScanLine size={18} color="#FFF" />
                      <Text style={styles.scannerBtnTitle}>OS標準ドキュメントスキャナーで撮影</Text>
                    </View>
                    <Text style={styles.scannerBtnSub}>(背景自動カット・高画質スキャン)</Text>
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
                <Text style={styles.errorText}>{errorMsg}</Text>
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

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                  <CheckCircle2 size={18} color={theme.colors.accentGreen} />
                  <Text style={{ fontSize: 13, color: theme.colors.accentGreen, fontWeight: '600', flex: 1 }}>
                    {extractedCards.length > 1
                      ? `${extractedCards.length} 件の名刺を抽出しました！`
                      : 'AI解析が完了しました！内容を確認して保存してください。'}
                  </Text>
                </View>

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
                  <Text style={styles.label}>電話番号 (CallKit同期対象)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={currentCard.phone}
                    onChangeText={(val) => updateActiveCardField('phone', val)}
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
});
