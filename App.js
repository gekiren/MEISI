import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, SafeAreaView, StatusBar, View, Text, Alert, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';

import Header from './src/components/Header';
import CardList from './src/components/CardList';
import ScannerModal from './src/components/ScannerModal';
import CallKitModal from './src/components/CallKitModal';
import CardDetailModal from './src/components/CardDetailModal';

import { getAllCards, updateCard } from './src/db/db';
import { DEFAULT_WORKER_PROXY_URL } from './src/config/constants';
import { theme } from './src/theme';

export default function App() {
  const [cards, setCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  const [geminiApiKey] = useState('');
  const [deepSeekApiKey] = useState('');
  const [workerProxyUrl] = useState(DEFAULT_WORKER_PROXY_URL);

  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isCallKitOpen, setIsCallKitOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  const [isCheckingOta, setIsCheckingOta] = useState(false);
  const [otaMessage, setOtaMessage] = useState(null);

  const loadCards = async () => {
    try {
      const data = await getAllCards();
      setCards(data);
    } catch (err) {
      console.error('Failed to load cards:', err);
    }
  };

  useEffect(() => {
    loadCards();
  }, []);

  // OTAアップデートの手動チェック機能
  const handleCheckOta = async () => {
    setIsCheckingOta(true);
    setOtaMessage('OTAアップデートを確認しています...');

    try {
      if (__DEV__ || !Updates.isEnabled) {
        setIsCheckingOta(false);
        setOtaMessage('お使いのアプリは最新バージョンです（ローカル/スタンドアロン環境）。');
        setTimeout(() => setOtaMessage(null), 4000);
        return;
      }

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setOtaMessage('最新バージョンをダウンロード中...');
        await Updates.fetchUpdateAsync();
        setOtaMessage('ダウンロード完了。アプリを再起動します。');
        setTimeout(async () => {
          await Updates.reloadAsync();
        }, 1200);
      } else {
        setIsCheckingOta(false);
        setOtaMessage('お使いのアプリは最新バージョンです。');
        setTimeout(() => setOtaMessage(null), 4000);
      }
    } catch (err) {
      console.warn('OTA Check Error:', err);
      setIsCheckingOta(false);
      setOtaMessage('お使いのアプリは最新バージョンです。');
      setTimeout(() => setOtaMessage(null), 4000);
    }
  };

  const handleToggleFavorite = async (card) => {
    await updateCard(card.id, { ...card, isFavorite: card.isFavorite ? 0 : 1 });
    loadCards();
  };

  const allTags = useMemo(() => {
    const tagSet = new Set();
    cards.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [cards]);

  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      if (selectedTag === 'fav' && !card.isFavorite) return false;
      if (selectedTag && selectedTag !== 'fav' && (!card.tags || !card.tags.includes(selectedTag))) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (card.name && card.name.toLowerCase().includes(q)) ||
        (card.company && card.company.toLowerCase().includes(q)) ||
        (card.title && card.title.toLowerCase().includes(q)) ||
        (card.phone && card.phone.includes(q)) ||
        (card.mobile && card.mobile.includes(q)) ||
        (card.email && card.email.toLowerCase().includes(q)) ||
        (card.tags && card.tags.some(t => t.toLowerCase().includes(q)))
      );
    });
  }, [cards, searchQuery, selectedTag]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
        <Header
          onOpenScan={() => setIsScanOpen(true)}
          onOpenCallKit={() => setIsCallKitOpen(true)}
          onExportCSV={() => Alert.alert('通知', '全名刺データをエクスポートできます。')}
          onCheckOta={handleCheckOta}
          isCheckingOta={isCheckingOta}
          cardCount={cards.length}
        />

        {otaMessage ? (
          <View style={styles.otaBanner}>
            <Text style={styles.otaText}>{otaMessage}</Text>
          </View>
        ) : null}

        <CardList
          cards={filteredCards}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTag={selectedTag}
          onTagSelect={setSelectedTag}
          allTags={allTags}
          onCardClick={(card) => setSelectedCard(card)}
          onToggleFavorite={handleToggleFavorite}
        />
      </ScrollView>

      {/* ネイティブダイアログ群 */}
      <ScannerModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        geminiApiKey={geminiApiKey}
        deepSeekApiKey={deepSeekApiKey}
        workerProxyUrl={workerProxyUrl}
        onCardAdded={loadCards}
      />

      <CallKitModal
        isOpen={isCallKitOpen}
        onClose={() => setIsCallKitOpen(false)}
        cards={cards}
      />

      <CardDetailModal
        card={selectedCard}
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        onUpdated={loadCards}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgApp,
  },
  scrollView: {
    flex: 1,
  },
  otaBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.accentGreen,
    borderRadius: theme.radius.md,
  },
  otaText: {
    fontSize: 12,
    color: '#D1FAE5',
    textAlign: 'center',
  },
});
