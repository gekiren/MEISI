import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import CardList from './components/CardList';
import ScannerModal from './components/ScannerModal';
import CallKitModal from './components/CallKitModal';
import CardDetailModal from './components/CardDetailModal';
import { getAllCards, updateCard, addCard } from './db/db';
import { exportCardsToCSV } from './services/csvService';
import { DEFAULT_WORKER_PROXY_URL } from './config/constants';
import { PhoneIncoming, ShieldCheck, Sparkles, Server } from 'lucide-react';
import { safeStorage } from './utils/storage';

export default function App() {
  const [cards, setCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');
  const [workerProxyUrl, setWorkerProxyUrl] = useState(DEFAULT_WORKER_PROXY_URL);

  // AsyncStorage から設定の初期ロード
  useEffect(() => {
    async function loadSettings() {
      const gKey = await safeStorage.getItem('gemini_api_key');
      const dKey = await safeStorage.getItem('deepseek_api_key');
      const pUrl = await safeStorage.getItem('worker_proxy_url');
      if (gKey) setGeminiApiKey(gKey);
      if (dKey) setDeepSeekApiKey(dKey);
      if (pUrl) setWorkerProxyUrl(pUrl);
    }
    loadSettings();
  }, []);

  // モーダル制御ステート
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isCallKitOpen, setIsCallKitOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [scannedImageFromNative, setScannedImageFromNative] = useState(null);
  const [scannedImagesFromNative, setScannedImagesFromNative] = useState(null);

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

    const handleNativeMessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data && data.type === 'OTA_STATUS') {
          setIsCheckingOta(data.status === 'CHECKING' || data.status === 'DOWNLOADING');
          setOtaMessage(data.message);
          if (data.status === 'LATEST' || data.status === 'INFO' || data.status === 'ERROR') {
            setTimeout(() => setOtaMessage(null), 4000);
          }
        } else if (data && data.type === 'DOCUMENT_SCANNER_RESULT') {
          if (data.images && data.images.length > 0) {
            setScannedImageFromNative(data.images[0]);
            setScannedImagesFromNative(data.images);
            setIsScanOpen(true);
          } else if (data.image) {
            setScannedImageFromNative(data.image);
            setScannedImagesFromNative([data.image]);
            setIsScanOpen(true);
          }
        } else if (data && data.type === 'DOCUMENT_SCANNER_ERROR') {
          alert(`${data.error || 'ドキュメントスキャナーの起動に失敗しました。'}\n\n「OK」を押すと通常のカメラ撮影・画像選択ダイアログがご利用いただけます。`);
        }
      } catch (e) {
        // ignore non-json messages
      }
    };

    window.addEventListener('message', handleNativeMessage);
    document.addEventListener('message', handleNativeMessage);

    return () => {
      window.removeEventListener('message', handleNativeMessage);
      document.removeEventListener('message', handleNativeMessage);
    };
  }, []);

  const handleCheckOta = () => {
    setIsCheckingOta(true);
    setOtaMessage('OTAアップデートを確認しています...');

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CHECK_OTA_UPDATE' }));
    } else {
      setTimeout(() => {
        setIsCheckingOta(false);
        setOtaMessage('Webブラウザ環境です。ネイティブアプリ(APK)実機でのみOTA更新が実行されます。');
        setTimeout(() => setOtaMessage(null), 4000);
      }, 1000);
    }
  };

  const handleSaveApiKeys = async (geminiKey, deepSeekKey, proxyUrl) => {
    setGeminiApiKey(geminiKey);
    setDeepSeekApiKey(deepSeekKey);
    setWorkerProxyUrl(proxyUrl || DEFAULT_WORKER_PROXY_URL);
    await safeStorage.setItem('gemini_api_key', geminiKey);
    await safeStorage.setItem('deepseek_api_key', deepSeekKey);
    await safeStorage.setItem('worker_proxy_url', proxyUrl || DEFAULT_WORKER_PROXY_URL);
  };

  const handleToggleFavorite = async (card) => {
    await updateCard(card.id, { ...card, isFavorite: card.isFavorite ? 0 : 1 });
    loadCards();
  };

  const handleAddSampleData = async () => {
    const samples = [
      {
        name: '山田 太郎',
        reading: 'やまだ たろう',
        company: '株式会社テクノロジーパートナーズ',
        department: 'クラウド開発部',
        title: '代表取締役',
        phone: '03-5555-0199',
        mobile: '090-1234-5678',
        email: 'yamada@example.com',
        postalCode: '100-0001',
        address: '東京都千代田区千代田1-1',
        website: 'https://example.com',
        memo: '展示会で名刺交換。CallKit自動認識テスト用。',
        tags: ['重要顧客', 'IT・クラウド'],
        isFavorite: 1
      },
      {
        name: '佐藤 美咲',
        reading: 'さとう みさき',
        company: 'フューチャーデザイン合同会社',
        department: 'デザイン制作課',
        title: 'シニアUI/UXデザイナー',
        phone: '06-6666-0288',
        mobile: '080-9876-5432',
        email: 'sato@design-example.jp',
        address: '大阪府大阪市北区梅田2-2-2',
        tags: ['デザイナー', '関西パートナー']
      }
    ];

    for (const sample of samples) {
      await addCard(sample);
    }
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
    <div className="app-container">
      <Header
        onOpenScan={() => setIsScanOpen(true)}
        onOpenCallKit={() => setIsCallKitOpen(true)}
        onExportCSV={() => exportCardsToCSV(cards)}
        onCheckOta={handleCheckOta}
        isCheckingOta={isCheckingOta}
        cardCount={cards.length}
      />

      {otaMessage && (
        <div style={{
          padding: '12px 18px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10B981',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          color: '#D1FAE5',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Sparkles size={18} color="#10B981" />
          <span>{otaMessage}</span>
        </div>
      )}

      <div className="callkit-banner">
        <div className="callkit-info">
          <div className="callkit-header">
            <ShieldCheck size={22} color="#06B6D4" className="callkit-icon" />
            <span className="callkit-title">CallKit 着信相手識別機能</span>
            <div className="callkit-badges">
              <span className="callkit-badge">連絡先アプリ汚染なし</span>
              <span className="callkit-badge-proxy">
                <Server size={12} /> AI解析プロキシ組み込み済み (Gemini 3.6 Flash ⇄ DeepSeek V4)
              </span>
            </div>
          </div>
          <div className="callkit-desc">
            登録済み電話番号 ({cards.filter(c => c.phone || c.mobile).length} 件) は標準電話帳に登録せず着信時に名前が表示されます
          </div>
        </div>

        <button className="btn btn-secondary btn-sm callkit-action-btn" onClick={() => setIsCallKitOpen(true)}>
          <PhoneIncoming size={14} color="#06B6D4" />
          <span>CallKit 設定</span>
        </button>
      </div>

      {cards.length === 0 && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
            <Sparkles size={20} color="#6366F1" />
            <span>テスト用サンプル名刺データを即座に投入できます。</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleAddSampleData}>
            サンプル名刺を追加
          </button>
        </div>
      )}

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

      <ScannerModal
        isOpen={isScanOpen}
        onClose={() => {
          setIsScanOpen(false);
          setScannedImageFromNative(null);
          setScannedImagesFromNative(null);
        }}
        geminiApiKey={geminiApiKey}
        deepSeekApiKey={deepSeekApiKey}
        workerProxyUrl={workerProxyUrl}
        scannedImageFromNative={scannedImageFromNative}
        scannedImagesFromNative={scannedImagesFromNative}
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
    </div>
  );
}
