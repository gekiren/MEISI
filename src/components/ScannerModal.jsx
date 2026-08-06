import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { X, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { analyzeBusinessCardWithFallback } from '../services/aiService';
import { addCard, updateCard, getAllCards } from '../db/db';
import { findDuplicateCard } from '../utils/duplicateCheck';
import { theme } from '../theme';
import ScanOptionSelector from './scanner/ScanOptionSelector';
import ExtractedCardEditor from './scanner/ExtractedCardEditor';

export default function ScannerModal({
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

  const [isMultiScan, setIsMultiScan] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [isDesignCard, setIsDesignCard] = useState(false);
  const [multiCropMode, setMultiCropMode] = useState('ai');

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
    setMultiCropMode('ai');
  };

  const ensureBase64Image = async (imageUri) => {
    if (!imageUri) throw new Error('画像データが存在しません。');
    if (typeof imageUri === 'string' && imageUri.startsWith('data:image')) {
      return imageUri;
    }

    let targetUri = imageUri;

    if (!targetUri.startsWith('file://') && !targetUri.startsWith('content://') && !targetUri.startsWith('/') && targetUri.length > 200) {
      return `data:image/jpeg;base64,${targetUri}`;
    }

    try {
      if (!targetUri.startsWith('file://') && !targetUri.startsWith('content://') && targetUri.startsWith('/')) {
        targetUri = `file://${targetUri}`;
      }

      const base64Str = await FileSystem.readAsStringAsync(targetUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (base64Str && base64Str.length > 50) {
        return `data:image/jpeg;base64,${base64Str.replace(/\s+/g, '')}`;
      }
    } catch (err) {
      console.warn('FileSystem.readAsStringAsync first attempt failed:', err);
      try {
        const decodedUri = decodeURIComponent(targetUri);
        const base64Str = await FileSystem.readAsStringAsync(decodedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (base64Str && base64Str.length > 50) {
          return `data:image/jpeg;base64,${base64Str.replace(/\s+/g, '')}`;
        }
      } catch (retryErr) {
        console.error('FileSystem.readAsStringAsync retry failed:', retryErr);
      }
    }

    throw new Error('画像の読み込みに失敗しました。端末のストレージ権限をご確認の上、再撮影をお試しください。');
  };

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

        let result = null;
        try {
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: isVertical ? [2, 3] : [3, 2],
            quality: 0.65,
            base64: true,
          });
        } catch (cropErr) {
          console.warn('Sequential cropped camera launch failed, retrying without crop:', cropErr);
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.65,
            base64: true,
          });
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          const img = asset.base64
            ? `data:image/jpeg;base64,${asset.base64}`
            : asset.uri;
          capturedList.push(img);
        } else {
          aborted = true;
        }
      }

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

  const processImagesWithChoice = async (imagesList) => {
    if (imagesList.length === 0) return;

    if (imagesList.length === 1 || multiCropMode === 'ai') {
      setSelectedImages(imagesList);
      setErrorMsg(null);
      startBatchAnalysis(imagesList);
      return;
    }

    Alert.alert(
      '複数枚の処理方法',
      `${imagesList.length} 枚の画像を選択中です。\n\n【連続撮影モード】が選択されています。選択済みの画像で解析しますか？\nそれともカメラで1枚ずつ順に連続撮影しますか？`,
      [
        {
          text: '📸 1枚ずつ連続撮影',
          onPress: () => launchSequentialCameraWithCrop(imagesList.length)
        },
        {
          text: '📷 選択画像で解析',
          onPress: () => {
            setSelectedImages(imagesList);
            setErrorMsg(null);
            startBatchAnalysis(imagesList);
          }
        }
      ]
    );
  };

  const pickImagesFromGallery = async () => {
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

  const launchCameraWithGridCrop = async () => {
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

      let result = null;
      try {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: isVertical ? [2, 3] : [3, 2],
          quality: 0.65,
          base64: true,
        });
      } catch (cropErr) {
        console.warn('Cropped camera launch failed, retrying without crop:', cropErr);
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.65,
          base64: true,
        });
      }

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

  const startBatchAnalysis = async (imagesList) => {
    setIsAnalyzing(true);
    setStatusNotice('AI 解析を実行中...');
    setErrorMsg(null);
    setExtractedCards([]);

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

        const base64Img = await ensureBase64Image(rawUri);

        const result = await analyzeBusinessCardWithFallback(
          base64Img,
          geminiApiKey,
          deepSeekApiKey,
          workerProxyUrl,
          (msg) => setStatusNotice(msg),
          scanOptions
        );

        const hasAnyField = result && (result.name || result.company || result.phone || result.mobile || result.email || result.address);

        if (result.isBusinessCard === false && !hasAnyField) {
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

  const promptDuplicateChoice = (newCard, duplicateCard) => {
    return new Promise((resolve) => {
      const dupName = duplicateCard.name || '名前なし';
      const dupCompany = duplicateCard.company ? ` (${duplicateCard.company})` : '';

      Alert.alert(
        '重複の可能性がある名刺を検出',
        `「${dupName}${dupCompany}」と類似した既存名刺が見つかりました。\n\nどのように処理しますか？`,
        [
          {
            text: '上書き更新',
            onPress: () => resolve('overwrite'),
          },
          {
            text: '新規追加',
            onPress: () => resolve('create_new'),
          },
          {
            text: 'キャンセル',
            style: 'cancel',
            onPress: () => resolve('cancel'),
          },
        ],
        { cancelable: true, onDismiss: () => resolve('cancel') }
      );
    });
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
      const existingCards = await getAllCards();
      let savedCount = 0;

      for (let i = 0; i < extractedCards.length; i++) {
        const card = extractedCards[i];
        const duplicateCard = findDuplicateCard(card, existingCards);

        if (duplicateCard) {
          setActiveCardIndex(i);
          const choice = await promptDuplicateChoice(card, duplicateCard);

          if (choice === 'cancel') {
            return;
          }

          if (choice === 'overwrite') {
            await updateCard(duplicateCard.id, { ...card, id: duplicateCard.id });
            savedCount++;
          } else if (choice === 'create_new') {
            await addCard(card);
            savedCount++;
          }
        } else {
          await addCard(card);
          savedCount++;
        }
      }

      if (savedCount > 0) {
        Alert.alert('成功', `${savedCount} 件の名刺を保存・更新しました！`);
        onCardAdded();
        onClose();
      }
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
              <ScanOptionSelector
                isMultiScan={isMultiScan}
                setIsMultiScan={setIsMultiScan}
                multiCropMode={multiCropMode}
                setMultiCropMode={setMultiCropMode}
                isVertical={isVertical}
                setIsVertical={setIsVertical}
                isDesignCard={isDesignCard}
                setIsDesignCard={setIsDesignCard}
                onPickGallery={pickImagesFromGallery}
                onLaunchCamera={launchCameraWithGridCrop}
              />
            )}

            {/* 解析中ローディング表示 */}
            {isAnalyzing && (
              <View style={styles.analyzingBox}>
                <ActivityIndicator size="large" color={theme.colors.accentPrimary} />
                <Text style={styles.analyzingText}>{statusNotice || 'AI解析を実行中...'}</Text>
              </View>
            )}

            {/* 解析エラー表示 */}
            {!isAnalyzing && errorMsg && extractedCards.length === 0 && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleReset}>
                  <Text style={styles.retryBtnText}>もう一度試す</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 解析結果表示・編集 */}
            {!isAnalyzing && extractedCards.length > 0 && (
              <ExtractedCardEditor
                extractedCards={extractedCards}
                activeCardIndex={activeCardIndex}
                setActiveCardIndex={setActiveCardIndex}
                onUpdateCardField={updateActiveCardField}
                onSaveAllCards={handleSaveAllCards}
                onReset={handleReset}
                errorMsg={errorMsg}
              />
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
    maxHeight: '90%',
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
  analyzingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  analyzingText: {
    fontSize: 13,
    color: theme.colors.textMain,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.radius.md,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#F87171',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F87171',
  },
});
