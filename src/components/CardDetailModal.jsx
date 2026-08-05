import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput, Alert, Linking, Platform } from 'react-native';
import { X, Phone, Mail, MapPin, Building, Star, Trash2, Edit2, ShieldCheck, Globe, Copy, Plus, Tag } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { updateCard, deleteCard } from '../db/db';
import { theme } from '../theme';

export default function CardDetailModal({ card, isOpen, onClose, onUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(card);
  const [toastMessage, setToastMessage] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  if (!isOpen || !card) return null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  const copyToClipboard = async (text, label) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    showToast(`${label}をコピーしました`);
  };

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

  const openWebsite = (url) => {
    if (!url) return;
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    Linking.openURL(formattedUrl).catch(() => {
      Alert.alert('エラー', 'Webサイトを開くことができません。');
    });
  };

  const openMap = (address) => {
    if (!address) return;
    const encoded = encodeURIComponent(address);
    const mapUrl = Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${encoded}`
      : `https://maps.google.com/?q=${encoded}`;
    Linking.openURL(mapUrl).catch(() => {
      Alert.alert('エラー', 'マップアプリを起動できません。');
    });
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim().replace(/^#/, '');
    if (!trimmed) return;
    const currentTags = editData.tags || [];
    if (!currentTags.includes(trimmed)) {
      setEditData({ ...editData, tags: [...currentTags, trimmed] });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const currentTags = editData.tags || [];
    setEditData({
      ...editData,
      tags: currentTags.filter((t) => t !== tagToRemove),
    });
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* トースト通知 */}
          {toastMessage ? (
            <View style={styles.toastContainer}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          ) : null}

          {/* ヘッダー */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <TouchableOpacity onPress={handleToggleFavorite} style={{ padding: 4 }}>
                <Star size={22} color={card.isFavorite ? '#F59E0B' : theme.colors.textDim} fill={card.isFavorite ? '#F59E0B' : 'none'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nameContainer}
                onPress={() => copyToClipboard(card.name, '氏名')}
                activeOpacity={0.7}
              >
                <Text style={styles.modalTitle} numberOfLines={1}>{card.name}</Text>
                <Copy size={13} color={theme.colors.textMuted} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
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
                    value={editData.name || ''}
                    onChangeText={(val) => setEditData({ ...editData, name: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>会社名</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.company || ''}
                    onChangeText={(val) => setEditData({ ...editData, company: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>部署 / 役職</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="部署名"
                      placeholderTextColor={theme.colors.textDim}
                      value={editData.department || ''}
                      onChangeText={(val) => setEditData({ ...editData, department: val })}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="役職"
                      placeholderTextColor={theme.colors.textDim}
                      value={editData.title || ''}
                      onChangeText={(val) => setEditData({ ...editData, title: val })}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>固定電話番号</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={editData.phone || ''}
                    onChangeText={(val) => setEditData({ ...editData, phone: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>携帯電話番号</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="phone-pad"
                    value={editData.mobile || ''}
                    onChangeText={(val) => setEditData({ ...editData, mobile: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>メールアドレス</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="email-address"
                    value={editData.email || ''}
                    onChangeText={(val) => setEditData({ ...editData, email: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>住所</Text>
                  <TextInput
                    style={styles.input}
                    value={editData.address || ''}
                    onChangeText={(val) => setEditData({ ...editData, address: val })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Webサイト</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="url"
                    placeholder="https://example.com"
                    placeholderTextColor={theme.colors.textDim}
                    value={editData.website || ''}
                    onChangeText={(val) => setEditData({ ...editData, website: val })}
                  />
                </View>

                {/* タグ編集セクション */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>タグ管理</Text>
                  <View style={styles.editTagsContainer}>
                    {(editData.tags || []).map((tag, idx) => (
                      <View key={idx} style={styles.editTagChip}>
                        <Text style={styles.editTagText}>#{tag}</Text>
                        <TouchableOpacity onPress={() => handleRemoveTag(tag)} style={{ marginLeft: 4 }}>
                          <X size={12} color={theme.colors.accentPrimary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <View style={styles.addTagRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, height: 36 }]}
                      placeholder="新しいタグを入力"
                      placeholderTextColor={theme.colors.textDim}
                      value={newTagInput}
                      onChangeText={setNewTagInput}
                      onSubmitEditing={handleAddTag}
                    />
                    <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                      <Plus size={16} color="#FFF" />
                      <Text style={styles.addTagBtnText}>追加</Text>
                    </TouchableOpacity>
                  </View>
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
                {/* 会社名・部署・役職 */}
                <View style={styles.companyRow}>
                  <Building size={20} color={theme.colors.accentCyan} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(card.company, '会社名')}
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.companyText}>{card.company || '会社名未登録'}</Text>
                      {card.company ? <Copy size={13} color={theme.colors.textMuted} style={{ marginLeft: 6 }} /> : null}
                    </TouchableOpacity>
                    {card.department || card.title ? (
                      <Text style={styles.deptTitleText}>
                        {card.department} {card.title}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* 固定電話 */}
                {card.phone ? (
                  <View style={styles.infoRowContainer}>
                    <TouchableOpacity style={styles.infoRow} onPress={() => makeCall(card.phone)}>
                      <Phone size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                      <Text style={styles.linkText}>{card.phone}</Text>
                      <View style={styles.callkitBadge}>
                        <ShieldCheck size={12} color={theme.colors.accentCyan} style={{ marginRight: 2 }} />
                        <Text style={styles.callkitBadgeText}>CallKit 同期</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyToClipboard(card.phone, '電話番号')} style={styles.copyBtn}>
                      <Copy size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 携帯電話 */}
                {card.mobile ? (
                  <View style={styles.infoRowContainer}>
                    <TouchableOpacity style={styles.infoRow} onPress={() => makeCall(card.mobile)}>
                      <Phone size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                      <Text style={styles.linkText}>{card.mobile} (携帯)</Text>
                      <View style={styles.callkitBadge}>
                        <ShieldCheck size={12} color={theme.colors.accentCyan} style={{ marginRight: 2 }} />
                        <Text style={styles.callkitBadgeText}>CallKit 同期</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyToClipboard(card.mobile, '携帯番号')} style={styles.copyBtn}>
                      <Copy size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* メールアドレス */}
                {card.email ? (
                  <View style={styles.infoRowContainer}>
                    <TouchableOpacity style={styles.infoRow} onPress={() => sendEmail(card.email)}>
                      <Mail size={16} color="#9CA3AF" style={{ marginRight: 10 }} />
                      <Text style={styles.linkText}>{card.email}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyToClipboard(card.email, 'メールアドレス')} style={styles.copyBtn}>
                      <Copy size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* 住所 (タップでマップ起動) */}
                {card.address ? (
                  <View style={styles.infoRowContainer}>
                    <TouchableOpacity style={styles.infoRow} onPress={() => openMap(card.address)}>
                      <MapPin size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                      <Text style={styles.linkText}>{card.address}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyToClipboard(card.address, '住所')} style={styles.copyBtn}>
                      <Copy size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Webサイト (タップでブラウザ起動) */}
                {card.website ? (
                  <View style={styles.infoRowContainer}>
                    <TouchableOpacity style={styles.infoRow} onPress={() => openWebsite(card.website)}>
                      <Globe size={16} color="#38BDF8" style={{ marginRight: 10 }} />
                      <Text style={styles.linkText}>{card.website}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => copyToClipboard(card.website, 'Webサイト')} style={styles.copyBtn}>
                      <Copy size={14} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* タグ表示 */}
                {card.tags && card.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    <Tag size={14} color={theme.colors.accentPrimary} style={{ marginRight: 4, marginTop: 4 }} />
                    {card.tags.map((t, idx) => (
                      <TouchableOpacity key={idx} style={styles.tagPill} onPress={() => copyToClipboard(t, `タグ #${t}`)}>
                        <Text style={styles.tagPillText}>#{t}</Text>
                      </TouchableOpacity>
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
  toastContainer: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: theme.colors.accentPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
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
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMain,
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
  infoRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  copyBtn: {
    padding: 6,
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
    alignItems: 'center',
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
  editTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  editTagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  editTagText: {
    fontSize: 12,
    color: theme.colors.accentPrimary,
    marginRight: 2,
    fontWeight: '600',
  },
  addTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentPrimary,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  addTagBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
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

