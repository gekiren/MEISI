import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { X, PhoneCall, ShieldCheck, Download, Copy, Check } from 'lucide-react-native';
import { generateCallKitDirectoryData } from '../services/callKitService';
import { theme } from '../theme';
import * as Clipboard from 'expo-clipboard';

export default function CallKitModalNative({ isOpen, onClose, cards }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const entries = generateCallKitDirectoryData(cards);

  const handleCopyText = async () => {
    const textContent = entries.map(e => `${e.phone} -> ${e.label}`).join('\n');
    try {
      if (Clipboard.setStringAsync) {
        await Clipboard.setStringAsync(textContent);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      Alert.alert('通知', 'クリップボードにコピーしました。');
    }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <PhoneCall size={20} color={theme.colors.accentCyan} />
              <Text style={styles.modalTitle}>CallKit 着信相手識別設定</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* 説明バナー */}
            <View style={styles.infoBanner}>
              <ShieldCheck size={24} color={theme.colors.accentCyan} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerTitle}>連絡先（電話帳）を汚さずに着信表示</Text>
                <Text style={styles.infoBannerDesc}>
                  MeisiScan は、標準電話帳に登録することなく、OSの着信識別データベースと直接連携します。電話帳が不要な連絡先で埋まる心配はありません。
                </Text>
              </View>
            </View>

            {/* 同期対象番号リスト */}
            <Text style={styles.sectionTitle}>
              現在の同期対象電話番号: <Text style={{ color: theme.colors.accentCyan }}>{entries.length} 件</Text>
            </Text>

            <View style={styles.listBox}>
              {entries.length === 0 ? (
                <Text style={styles.emptyListText}>登録済みの名刺に電話番号が含まれていません。</Text>
              ) : (
                entries.map((item, idx) => (
                  <View key={idx} style={styles.listItemRow}>
                    <Text style={styles.phoneText}>{item.phone}</Text>
                    <Text style={styles.labelText}>{item.label}</Text>
                  </View>
                ))
              )}
            </View>

            {/* アクションボタン */}
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyText}>
              {copied ? <Check size={18} color="#FFF" /> : <Copy size={18} color="#FFF" />}
              <Text style={styles.copyBtnText}>
                {copied ? '識別リストをコピーしました！' : '電話識別リストをクリップボードにコピー'}
              </Text>
            </TouchableOpacity>
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderRadius: theme.radius.md,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.accentCyan,
    marginBottom: 2,
  },
  infoBannerDesc: {
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textMain,
    marginBottom: 8,
  },
  listBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: theme.radius.md,
    padding: 12,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  emptyListText: {
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    paddingVertical: 12,
  },
  listItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  phoneText: {
    fontSize: 12,
    color: '#38BDF8',
    fontFamily: 'Platform',
  },
  labelText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentPrimary,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    gap: 8,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
