import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, Sparkles, Image as ImageIcon, Grid, Layers } from 'lucide-react-native';
import { theme } from '../../theme';

export default function ScanOptionSelector({
  isMultiScan,
  setIsMultiScan,
  multiCropMode,
  setMultiCropMode,
  isVertical,
  setIsVertical,
  isDesignCard,
  setIsDesignCard,
  onPickGallery,
  onLaunchCamera
}) {
  return (
    <View style={styles.container}>
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
          <Sparkles size={14} color={isMultiScan ? '#FFF' : theme.colors.textMuted} />
          <Text style={[styles.tabText, isMultiScan && styles.tabTextActive]}>複数名刺 (最大4枚)</Text>
        </TouchableOpacity>
      </View>

      {/* 複数名刺時の個別トリミングモード切替 */}
      {isMultiScan && (
        <View style={styles.modeSection}>
          <Text style={styles.modeSectionTitle}>📸 複数名刺のトリミングモード選択</Text>
          <View style={styles.modeGrid}>
            <TouchableOpacity
              style={[styles.modeCard, multiCropMode === 'ai' && styles.modeCardActive]}
              onPress={() => setMultiCropMode('ai')}
            >
              <View style={styles.modeHeader}>
                <Grid size={16} color={multiCropMode === 'ai' ? theme.colors.accentPrimary : theme.colors.textMuted} />
                <Text style={[styles.modeTitle, multiCropMode === 'ai' && styles.modeTitleActive]}>
                  一括撮影 (AI自動切り出し)
                </Text>
              </View>
              <Text style={styles.modeDesc}>
                最大4枚の名刺を机に並べて1回でまとめて撮影。AIが領域を自動検知。
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeCard, multiCropMode === 'manual' && styles.modeCardActive]}
              onPress={() => setMultiCropMode('manual')}
            >
              <View style={styles.modeHeader}>
                <Layers size={16} color={multiCropMode === 'manual' ? theme.colors.accentPrimary : theme.colors.textMuted} />
                <Text style={[styles.modeTitle, multiCropMode === 'manual' && styles.modeTitleActive]}>
                  1枚ずつ連続撮影 (手動切り抜き)
                </Text>
              </View>
              <Text style={styles.modeDesc}>
                1枚ずつ順番にカメラ撮影し、撮影直後に手動で枠線トリミング。
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 解析オプション設定 */}
      <View style={styles.optionsBox}>
        <Text style={styles.optionsTitle}>⚙️ 高精度AI解析オプション</Text>

        <TouchableOpacity
          style={[styles.optionRow, isVertical && styles.optionRowActive]}
          onPress={() => setIsVertical(!isVertical)}
        >
          <View style={styles.checkboxWrapper}>
            <View style={[styles.checkbox, isVertical && styles.checkboxChecked]}>
              {isVertical && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>縦書きレイアウト名刺</Text>
            <Text style={styles.optionSubText}>役職・氏名が縦方向に配置された名刺に特化して解析</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionRow, isDesignCard && styles.optionRowActive]}
          onPress={() => setIsDesignCard(!isDesignCard)}
        >
          <View style={styles.checkboxWrapper}>
            <View style={[styles.checkbox, isDesignCard && styles.checkboxChecked]}>
              {isDesignCard && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionLabel}>デザイン・カラー背景名刺</Text>
            <Text style={styles.optionSubText}>背景ノイズやロゴグラフィックが多い名刺の文字検出を強化</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 画像取り込みアクションボタン */}
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.primaryActionBtn} onPress={onLaunchCamera}>
          <Camera size={22} color="#FFF" />
          <Text style={styles.primaryActionBtnText}>
            {isMultiScan && multiCropMode === 'manual' ? 'カメラで1枚ずつ順に撮影' : 'カメラを起動して撮影'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryActionBtn} onPress={onPickGallery}>
          <ImageIcon size={20} color={theme.colors.accentPrimary} />
          <Text style={styles.secondaryActionBtnText}>
            {isMultiScan ? 'アルバムから最大4枚選択' : 'アルバムから画像を選択'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: theme.radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.accentPrimary,
  },
  tabBtnActiveGradient: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  tabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  modeSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  modeSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A78BFA',
    marginBottom: 10,
  },
  modeGrid: {
    gap: 8,
  },
  modeCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: theme.radius.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modeCardActive: {
    borderColor: theme.colors.accentPrimary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  modeTitleActive: {
    color: theme.colors.accentPrimary,
  },
  modeDesc: {
    fontSize: 11,
    color: theme.colors.textDim,
    lineHeight: 15,
  },
  optionsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  optionsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMain,
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  optionRowActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  checkboxWrapper: {
    paddingTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  checkmark: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: -2,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMain,
  },
  optionSubText: {
    fontSize: 11,
    color: theme.colors.textDim,
    marginTop: 1,
  },
  actionGrid: {
    gap: 10,
    marginTop: 4,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentPrimary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    gap: 8,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderWidth: 1,
    borderColor: theme.colors.accentPrimary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    gap: 8,
  },
  secondaryActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accentPrimary,
  },
});
