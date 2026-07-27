import React from 'react';
import { Search, Star, Phone, Mail, Building, Tag, ShieldCheck } from 'lucide-react';

export default function CardList({
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
    <div>
      {/* 検索バー */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="氏名、会社名、役職、電話番号、キーワードで検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* タグフィルター */}
      {allTags && allTags.length > 0 && (
        <div className="tag-filter-list">
          <button
            className={`tag-pill ${selectedTag === null ? 'active' : ''}`}
            onClick={() => onTagSelect(null)}
          >
            すべて ({cards.length})
          </button>
          <button
            className={`tag-pill ${selectedTag === 'fav' ? 'active' : ''}`}
            onClick={() => onTagSelect('fav')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <Star size={12} fill={selectedTag === 'fav' ? '#fff' : 'none'} />
            お気に入り
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`tag-pill ${selectedTag === tag ? 'active' : ''}`}
              onClick={() => onTagSelect(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* 名刺リスト表示 */}
      {cards.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: 'var(--glass-border)'
        }}>
          <Building size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--text-main)' }}>
            該当する名刺が見つかりません
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            右上の「名刺スキャン」ボタンから名刺を撮影・解析して追加してください。
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((card) => (
            <div
              key={card.id}
              className="business-card"
              onClick={() => onCardClick(card)}
            >
              <div className="card-top">
                {card.image ? (
                  <img src={card.image} alt={card.name} className="card-image-thumb" />
                ) : (
                  <div className="card-image-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
                    <Building size={20} />
                  </div>
                )}
                <div className="card-header-info">
                  <div className="card-company">{card.company || '会社未指定'}</div>
                  <div className="card-name">{card.name}</div>
                  <div className="card-title-dept">
                    {card.title} {card.department ? `(${card.department})` : ''}
                  </div>
                </div>
              </div>

              <div className="card-body">
                {card.phone && (
                  <div className="card-info-item">
                    <Phone size={14} color="#38BDF8" />
                    <span>{card.phone}</span>
                    <ShieldCheck size={14} color="#06B6D4" title="CallKit 着信識別同期中" />
                  </div>
                )}
                {card.email && (
                  <div className="card-info-item">
                    <Mail size={14} color="#9CA3AF" />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.email}
                    </span>
                  </div>
                )}
              </div>

              <div className="card-footer">
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {card.tags && card.tags.slice(0, 2).map((t, i) => (
                    <span key={i} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                      #{t}
                    </span>
                  ))}
                </div>

                <button
                  className={`fav-btn ${card.isFavorite ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(card);
                  }}
                >
                  <Star size={18} fill={card.isFavorite ? '#F59E0B' : 'none'} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
