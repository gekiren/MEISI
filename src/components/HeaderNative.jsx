import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, RefreshCw, PhoneCall, Download } from 'lucide-react-native';
import { theme } from '../theme';

export default function HeaderNative({
  onOpenScan,
  onOpenCallKit,
  onExportCSV,
  onCheckOta,
  isCheckingOta,
  cardCount
}) {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.titleText}>MeisiScan</Text>
          <Text style={styles.subtitleText}>AI 名刺スキャン & CallKit 着信表示</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{cardCount} 件</Text>
        </View>
      </View>

      {/* メインスキャンボタン */}
      <TouchableOpacity activeOpacity={0.8} onPress={onOpenScan} style={styles.mainScanBtnWrapper}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainScanBtn}
        >
          <Camera size={20} color="#FFF" />
          <Text style={styles.mainScanBtnText}>+ 名刺スキャン</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* サブアクションボタン群 */}
      <View style={styles.actionGrid}>
        <TouchableOpacity style={styles.subBtn} onPress={onCheckOta} disabled={isCheckingOta}>
          <RefreshCw size={15} color={theme.colors.accentGreen} />
          <Text style={styles.subBtnText}>
            {isCheckingOta ? '更新確認中...' : 'OTA更新'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.subBtn} onPress={onOpenCallKit}>
          <PhoneCall size={15} color={theme.colors.accentCyan} />
          <Text style={styles.subBtnText}>CallKit 設定</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.subBtn} onPress={onExportCSV}>
          <Download size={15} color={theme.colors.textMuted} />
          <Text style={styles.subBtnText}>CSV出力</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  titleGroup: {
    flexDirection: 'column',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textMain,
    letterSpacing: 0.5,
  },
  subtitleText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.accentPrimary,
  },
  mainScanBtnWrapper: {
    marginBottom: 12,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    elevation: 4,
  },
  mainScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  mainScanBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  subBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgGlass,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    gap: 6,
  },
  subBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textMain,
  },
});
