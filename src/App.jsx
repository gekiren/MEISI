import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import CardList from './components/CardList';
import ScannerModal from './components/ScannerModal';
import ApiKeyModal from './components/ApiKeyModal';
import CallKitModal from './components/CallKitModal';
import CardDetailModal from './components/CardDetailModal';
import { getAllCards, updateCard, addCard } from './db/db';
import { exportCardsToCSV } from './services/csvService';
import { PhoneIncoming, ShieldCheck, Sparkles } from 'lucide-react';

export default function App() {
  const [cards, setCards] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');

  // モーダル制御ステート
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);
  const [isCallKitOpen, setIsCallKitOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  // データ読み込み
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

  // APIキーの保存
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  // お気に入りトグル
  const handleToggleFavorite = async (card) => {
    await updateCard(card.id, { ...card, isFavorite: card.isFavorite ? 0 : 1 });
    loadCards();
  };

  // デモ用サンプルデータ作成
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

  // タグ一覧の抽出
  const allTags = useMemo(() => {
    const tagSet = new Set();
    cards.forEach(c => {
      if (Array.isArray(c.tags)) {
        c.tags.forEach(t => tagSet.add(t));
      }
    });
    return Array.from(tagSet);
  }, [cards]);

  // フィルタリング処理
  const filteredCards = useMemo(() => {
    return cards.filter(card => {
      // タグフィルター
      if (selectedTag === 'fav' && !card.isFavorite) return false;
      if (selectedTag && selectedTag !== 'fav' && (!card.tags || !card.tags.includes(selectedTag))) {
        return false;
      }

      // 検索クエリ
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
      {/* ヘッダー */}
      <Header
        onOpenScan={() => setIsScanOpen(true)}
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        onOpenCallKit={() => setIsCallKitOpen(true)}
        onExportCSV={() => exportCardsToCSV(cards)}
        cardCount={cards.length}
      />

      {/* CallKit アクティブバナー */}
      <div className="callkit-banner">
        <div className="callkit-info">
          <ShieldCheck size={24} color="#06B6D4" />
          <div>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>CallKit 着信相手識別機能</span>
              <span className="callkit-badge">連絡先アプリ汚染なし</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              登録済み電話番号 ({cards.filter(c => c.phone || c.mobile).length} 件) は標準電話帳に登録せず着信時に名前が表示されます
            </div>
          </div>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={() => setIsCallKitOpen(true)}>
          <PhoneIncoming size={14} color="#06B6D4" />
          <span>CallKit 設定</span>
        </button>
      </div>

      {/* サンプルデータ投入案内（カードが0件の場合） */}
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

      {/* 名刺リスト */}
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

      {/* モーダル群 */}
      <ScannerModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        apiKey={apiKey}
        onCardAdded={loadCards}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
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
