import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Dimensions } from 'react-native';
import { X, ZoomIn } from 'lucide-react-native';
import { theme } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ImageViewerModal({ isOpen, onClose, imageUri, title, subtitle }) {
  if (!isOpen || !imageUri) return null;

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        {/* ヘッダーバー */}
        <View style={styles.header}>
          <View style={styles.titleArea}>
            {title ? <Text style={styles.titleText} numberOfLines={1}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitleText} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* ズーム対応画像領域 */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          maximumZoomScale={4.0}
          minimumZoomScale={1.0}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent={true}
          bouncesZoom={true}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </ScrollView>

        {/* 下部ガイドバー */}
        <View style={styles.footer}>
          <ZoomIn size={16} color={theme.colors.accentCyan} style={{ marginRight: 6 }} />
          <Text style={styles.footerText}>二本の指でピンチ操作（拡大・縮小・移動）ができます</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  titleArea: {
    flex: 1,
    marginRight: 16,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitleText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
  },
  scrollArea: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
});
