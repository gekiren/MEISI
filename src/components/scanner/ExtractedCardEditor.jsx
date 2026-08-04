import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput } from 'react-native';
import { CheckCircle2, AlertCircle, X, Plus } from 'lucide-react-native';
import { theme } from '../../theme';

export default function ExtractedCardEditor({
  extractedCards,
  activeCardIndex,
  setActiveCardIndex,
  onUpdateCardField,
  onSaveAllCards,
  onReset,
  errorMsg
}) {
  const [tagInputText, setTagInputText] = useState('');
  const currentCard = extractedCards[activeCardIndex];

  if (!currentCard) return null;

  const handleAddTag = () => {
    const trimmed = tagInputText.trim();
    if (!trimmed) return;
    const currentTags = Array.isArray(currentCard.tags) ? currentCard.tags : [];
    if (currentTags.includes(trimmed)) {
      setTagInputText('');
      return;
    }
    onUpdateCardField('tags', [...currentTags, trimmed]);
    setTagInputText('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const currentTags = Array.isArray(currentCard.tags) ? currentCard.tags : [];
    onUpdateCardField('tags', currentTags.filter(t => t !== tagToRemove));
  };

  return (
    <View style={styles.container}>
      {/* 完了ヘッダー通知 */}
      <View style={styles.successBanner}>
        <CheckCircle2 size={18} color="#10B981" />
        <Text style={styles.successBannerText}>
          {extractedCards.length} 件の名刺情報を AI 自動抽出しました
        </Text>
      </View>

      {errorMsg && (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color="#F87171" />
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
        </View>
      )}

      {/* 複数名刺時のカード切替タブ */}
      {extractedCards.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardTabBar}>
          {extractedCards.map((card, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.cardTabItem, idx === activeCardIndex && styles.cardTabItemActive]}
              onPress={() => setActiveCardIndex(idx)}
            >
              <Text style={[styles.cardTabText, idx === activeCardIndex && styles.cardTabTextActive]}>
                名刺 #{idx + 1} {card.name ? `(${card.name})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* 画像プレビュー */}
      {currentCard.image && (
        <View style={styles.imagePreviewBox}>
          <Image source={{ uri: currentCard.image }} style={styles.previewImage} resizeMode="contain" />
        </View>
      )}

      {/* フィールド入力フォーム */}
      <View style={styles.formContainer}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>氏名 <Text style={{ color: '#F87171' }}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={currentCard.name || ''}
            onChangeText={(val) => onUpdateCardField('name', val)}
            placeholder="例: 山田 太郎"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        <View style={styles.rowGrid}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>フリガナ</Text>
            <TextInput
              style={styles.input}
              value={currentCard.reading || ''}
              onChangeText={(val) => onUpdateCardField('reading', val)}
              placeholder="ヤマダ タロウ"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>役職</Text>
            <TextInput
              style={styles.input}
              value={currentCard.title || ''}
              onChangeText={(val) => onUpdateCardField('title', val)}
              placeholder="代表取締役"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>会社名</Text>
            <TextInput
              style={styles.input}
              value={currentCard.company || ''}
              onChangeText={(val) => onUpdateCardField('company', val)}
              placeholder="株式会社サンプル"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>部署名</Text>
            <TextInput
              style={styles.input}
              value={currentCard.department || ''}
              onChangeText={(val) => onUpdateCardField('department', val)}
              placeholder="営業部"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
        </View>

        <View style={styles.rowGrid}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>電話番号 (固定)</Text>
            <TextInput
              style={styles.input}
              value={currentCard.phone || ''}
              onChangeText={(val) => onUpdateCardField('phone', val)}
              placeholder="03-1234-5678"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={styles.label}>携帯電話番号</Text>
            <TextInput
              style={styles.input}
              value={currentCard.mobile || ''}
              onChangeText={(val) => onUpdateCardField('mobile', val)}
              placeholder="090-1234-5678"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textDim}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>メールアドレス</Text>
          <TextInput
            style={styles.input}
            value={currentCard.email || ''}
            onChangeText={(val) => onUpdateCardField('email', val)}
            placeholder="yamada@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>住所</Text>
          <TextInput
            style={styles.input}
            value={currentCard.address || ''}
            onChangeText={(val) => onUpdateCardField('address', val)}
            placeholder="東京都千代田区1-1-1"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Webサイト</Text>
          <TextInput
            style={styles.input}
            value={currentCard.website || ''}
            onChangeText={(val) => onUpdateCardField('website', val)}
            placeholder="https://example.com"
            keyboardType="url"
            autoCapitalize="none"
            placeholderTextColor={theme.colors.textDim}
          />
        </View>

        {/* タグ設定 */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>タグ</Text>
          <View style={styles.tagChipsBox}>
            {(currentCard.tags || []).map((t, idx) => (
              <View key={idx} style={styles.tagChip}>
                <Text style={styles.tagChipText}>#{t}</Text>
                <TouchableOpacity onPress={() => handleRemoveTag(t)}>
                  <X size={12} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.addTagRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={tagInputText}
              onChangeText={setTagInputText}
              placeholder="新しいタグを入力..."
              placeholderTextColor={theme.colors.textDim}
              onSubmitEditing={handleAddTag}
            />
            <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
              <Plus size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>メモ・特記事項</Text>
          <TextInput
            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
            value={currentCard.memo || ''}
            onChangeText={(val) => onUpdateCardField('memo', val)}
            placeholder="名刺交換時の状況や特記事項..."
            multiline
            placeholderTextColor={theme.colors.textDim}
          />
        </View>
      </View>

      {/* フッターアクション */}
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
          <Text style={styles.resetBtnText}>再スキャン</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={onSaveAllCards}>
          <Text style={styles.saveBtnText}>
            {extractedCards.length > 1 ? `${extractedCards.length} 件をまとめて保存` : '保存する'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: theme.radius.md,
    padding: 10,
    gap: 8,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: theme.radius.md,
    padding: 10,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#F87171',
    flex: 1,
  },
  cardTabBar: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cardTabItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginRight: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardTabItemActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  cardTabText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  cardTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  imagePreviewBox: {
    height: 140,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  formContainer: {
    gap: 10,
  },
  inputGroup: {
    gap: 4,
  },
  rowGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.textMain,
  },
  tagChipsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.accentPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tagChipText: {
    fontSize: 11,
    color: theme.colors.accentPrimary,
  },
  addTagRow: {
    flexDirection: 'row',
    gap: 6,
  },
  addTagBtn: {
    backgroundColor: theme.colors.accentPrimary,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: theme.colors.accentPrimary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
