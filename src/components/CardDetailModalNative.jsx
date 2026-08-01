import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput, Alert, Linking } from 'react-native';
import { X, Phone, Mail, Globe, MapPin, Building, Star, Trash2, Edit2, Share2, ShieldCheck } from 'lucide-react-native';
import { updateCard, deleteCard } from '../db/db';
import { theme } from '../theme';

export default function CardDetailModalNative({ card, isOpen, onClose, onUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(card);

  if (!isOpen || !card) return null;

  const handleToggleFavorite = async () => {
    await updateCard(card.id, { ...card, isFavorite: card.isFavorite ? 0 : 1 });
    onUpdated();
  };

  const handleDelete = () => {
    Alert.alert(
      '削除の確認',
      `「${card.name}」さんの名刺データを削除してもよろしいですか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteCard(card.id);
            onUpdated();
            onClose();
          }
        }
      ]
    );
  };

  const handleSaveEdit = async () => {
    await updateCard(card.id, editData);
    setIsEditing(false);
    onUpdated();
  };

  const makeCall = (phoneNumber) => {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {
        Alert.alert('エラー', '電話をかけることができません。');
      });
    }
  };

  const sendEmail = (email) => {
    if (email) {
      Linking.openURL(`mailto:${email}`).catch(() => {
        Alert.alert('エラー', 'メールアプリを起動できません。');
      });
    }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 4 }}>
                <Star size={22} color={card.isFavorite ? '#F59E0B' : theme.colors.textDim} fill={card.isFavorite ? '#F59E0B' : 'none'} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>{card.name}</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setIsEditing(!isEditing); setEditData(card); }}>
                <Edit2 size={16} color={theme.colors.textMain} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleDelete}>
                <Trash2 size={16} color={theme.colors.danger} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                <X size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* 名刺プレビュー */}
            {card.image ? (
              <Image source={{ uri: card.image }} style={styles.previewImage} resizeMode="contain" />
            ) : null}

            {isEditing ? (
              <View style={styles.formContainer}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>氏名</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.name}
                    onChangeText={(val) => setEditData({ ...editData, name: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>会社名</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.company}
                    onChangeText={(val) => setEditData({ ...editData, company: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>固定電話番号</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={editData.phone}
                    onChangeText={(val) => setEditData({ ...editData, phone: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>携帯電話番号</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={editData.mobile}
                    onChangeText={(val) => setEditData({ ...editData, mobile: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>メールアドレス</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="email-address"
                    value={editData.email}
                    onChangeText={(val) => setEditData({ ...editData, email: val })}
                  />
                </View>

                <View style={styles.editActionRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                    <Text style={styles.cancelBtnText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                    <Text style={styles.saveBtnText}>保存</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.detailContainer}>
                <View style={styles.companyRow}>
                  <Building size={20} color={theme.colors.accentCyan} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.companyText}>{card.company || '会社名未登録'}</Text>
                    <Text style={styles.deptTitleText}>
                      {card.department} {card.title}
                    </Text>
                  </View>
                </View>

                {card.phone ? (
                  <TouchableOpacity style={styles.infoRow} onPress={() => makeCall(card.phone)}>
                    <Phone size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                    <Text style={styles.linkText}>{card.phone}</Text>
                    <View style={styles.callkitBadge}>
                      <ShieldCheck size={12} color={theme.colors.accentCyan} style={{ marginRight: 2 }} />
                      <Text style={styles.callkitBadgeText}>CallKit 同期</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {card.mobile ? (
                  <TouchableOpacity style={styles.infoRow} onPress={() => makeCall(card.mobile)}>
                    <Phone size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                    <Text style={styles.linkText}>{card.mobile} (携帯)</Text>
                    <View style={styles.callkitBadge}>
                      <ShieldCheck size={12} color={theme.colors.accentCyan} style={{ marginRight: 2 }} />
                      <Text style={styles.callkitBadgeText}>CallKit 同期</Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {card.email ? (
                  <TouchableOpacity style={styles.infoRow} onPress={() => sendEmail(card.email)}>
                    <Mail size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
                    <Text style={styles.linkText}>{card.email}</Text>
                  </TouchableOpacity>
                ) : null}

                {card.address ? (
                  <View style={styles.infoRow}>
                    <MapPin size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
                    <Text style={styles.infoText}>{card.address}</Text>
                  </View>
                ) : null}

                {card.tags && card.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {card.tags.map((t, idx) => (
                      <View key={idx} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
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
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMain,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    backgroundColor: theme.colors.bgGlass,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalBody: {
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: theme.radius.md,
    marginBottom: 16,
    backgroundColor: '#000',
  },
  detailContainer: {
    gap: 14,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  companyText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMain,
  },
  deptTitleText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: theme.colors.textMain,
  },
  linkText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '500',
  },
  callkitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accentCyan,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  callkitBadgeText: {
    fontSize: 10,
    color: theme.colors.accentCyan,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tagPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  tagPillText: {
    fontSize: 11,
    color: theme.colors.accentPrimary,
    fontWeight: '600',
  },
  formContainer: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: theme.colors.textMuted,
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
  editActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.bgGlass,
    borderRadius: theme.radius.md,
  },
  cancelBtnText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.accentPrimary,
    borderRadius: theme.radius.md,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
});
