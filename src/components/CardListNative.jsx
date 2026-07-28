import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { Search, Star, Phone, Mail, Building, ShieldCheck } from 'lucide-react-native';
import { theme } from '../theme';

export default function CardListNative({
  cards,
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagSelect,
  allTags,
  onCardClick,
  onToggleFavorite
}) {
  return (
    <View style={styles.container}>
      {/* 検索入力欄 */}
      <View style={styles.searchBox}>
        <Search size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="氏名、会社名、電話番号、タグで検索..."
          placeholderTextColor={theme.colors.textDim}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>

      {/* タグフィルター */}
      {allTags && allTags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScrollView} contentContainerStyle={styles.tagContainer}>
          <TouchableOpacity
            style={[styles.tagPill, selectedTag === null && styles.tagPillActive]}
            onPress={() => onTagSelect(null)}
          >
            <Text style={[styles.tagText, selectedTag === null && styles.tagTextActive]}>
              すべて ({cards.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tagPill, selectedTag === 'fav' && styles.tagPillActive]}
            onPress={() => onTagSelect('fav')}
          >
            <Star size={12} color={selectedTag === 'fav' ? '#FFF' : theme.colors.textMuted} fill={selectedTag === 'fav' ? '#FFF' : 'none'} style={{ marginRight: 4 }} />
            <Text style={[styles.tagText, selectedTag === 'fav' && styles.tagTextActive]}>
              お気に入り
            </Text>
          </TouchableOpacity>

          {allTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagPill, selectedTag === tag && styles.tagPillActive]}
              onPress={() => onTagSelect(tag)}
            >
              <Text style={[styles.tagText, selectedTag === tag && styles.tagTextActive]}>
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* リスト表示 */}
      {cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Building size={48} color={theme.colors.textDim} style={{ marginBottom: 12, opacity: 0.5 }} />
          <Text style={styles.emptyTitle}>該当する名刺が見つかりません</Text>
          <Text style={styles.emptyDesc}>
            上部の「+ 名刺スキャン」ボタンから名刺を撮影・解析して追加してください。
          </Text>
        </View>
      ) : (
        <View style={styles.cardGrid}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.7}
              style={styles.cardItem}
              onPress={() => onCardClick(card)}
            >
              <View style={styles.cardTop}>
                {card.image ? (
                  <Image source={{ uri: card.image }} style={styles.cardImageThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.cardImageThumb, styles.cardImagePlaceholder]}>
                    <Building size={20} color={theme.colors.textDim} />
                  </View>
                )}
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.cardCompany} numberOfLines={1}>
                    {card.company || '会社未指定'}
                  </Text>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={styles.cardTitleDept} numberOfLines={1}>
                    {card.title} {card.department ? `(${card.department})` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                {card.phone ? (
                  <View style={styles.infoRow}>
                    <Phone size={13} color="#38BDF8" style={{ marginRight: 6 }} />
                    <Text style={styles.infoText}>{card.phone}</Text>
                    <ShieldCheck size={13} color={theme.colors.accentCyan} style={{ marginLeft: 4 }} />
                  </View>
                ) : null}

                {card.email ? (
                  <View style={styles.infoRow}>
                    <Mail size={13} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={styles.infoText} numberOfLines={1}>{card.email}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.tagPillsRow}>
                  {card.tags && card.tags.slice(0, 2).map((t, i) => (
                    <View key={i} style={styles.miniTag}>
                      <Text style={styles.miniTagText}>#{t}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => onToggleFavorite(card)}
                  style={styles.favBtn}
                >
                  <Star size={18} color={card.isFavorite ? '#F59E0B' : theme.colors.textDim} fill={card.isFavorite ? '#F59E0B' : 'none'} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    color: theme.colors.textMain,
    fontSize: 14,
  },
  tagScrollView: {
    marginBottom: 16,
  },
  tagContainer: {
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.bgGlass,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
  },
  tagPillActive: {
    backgroundColor: theme.colors.accentPrimary,
    borderColor: theme.colors.accentPrimary,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  tagTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMain,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  cardGrid: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  cardImageThumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
  },
  cardImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderInfo: {
    flex: 1,
  },
  cardCompany: {
    fontSize: 11,
    color: theme.colors.accentCyan,
    fontWeight: '600',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textMain,
    marginVertical: 2,
  },
  cardTitleDept: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  cardBody: {
    gap: 4,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 12,
    color: theme.colors.textMain,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  tagPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniTagText: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  favBtn: {
    padding: 2,
  },
});
