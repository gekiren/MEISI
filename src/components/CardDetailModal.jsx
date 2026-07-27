import React, { useState } from 'react';
import { X, Phone, Mail, Globe, MapPin, Building, Star, Trash2, Edit2, Share2, ShieldCheck, Tag } from 'lucide-react';
import { updateCard, deleteCard } from '../db/db';
import { generateVCard } from '../services/callKitService';

export default function CardDetailModal({ card, isOpen, onClose, onUpdated }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(card);

  if (!isOpen || !card) return null;

  const handleToggleFavorite = async () => {
    await updateCard(card.id, { ...card, isFavorite: card.isFavorite ? 0 : 1 });
    onUpdated();
  };

  const handleDelete = async () => {
    if (window.confirm(`「${card.name}」さんの名刺データを削除してもよろしいですか？`)) {
      await deleteCard(card.id);
      onUpdated();
      onClose();
    }
  };

  const handleSaveEdit = async () => {
    await updateCard(card.id, editData);
    setIsEditing(false);
    onUpdated();
  };

  const handleShareVCard = async () => {
    const vcardText = generateVCard(card);
    const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8;' });
    const file = new File([blob], `${card.name}_vCard.vcf`, { type: 'text/vcard' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: card.name,
          text: `${card.name} (${card.company || ''}) の名刺情報`
        });
      } catch (err) {
        if (err.name !== 'AbortError') console.error('vCard Share Error:', err);
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${card.name}_vCard.vcf`;
      link.click();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className={`fav-btn ${card.isFavorite ? 'active' : ''}`} onClick={handleToggleFavorite}>
              <Star size={24} fill={card.isFavorite ? '#F59E0B' : 'none'} />
            </button>
            <h2 className="modal-title">{card.name}</h2>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-icon" onClick={() => { setIsEditing(!isEditing); setEditData(card); }}>
              <Edit2 size={16} />
            </button>

            <button className="btn btn-secondary btn-icon" onClick={handleDelete} title="削除">
              <Trash2 size={16} color="#EF4444" />
            </button>

            <button className="btn btn-secondary btn-icon" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 名刺画像拡大表示 */}
        {card.image && (
          <img
            src={card.image}
            alt={card.name}
            style={{
              width: '100%',
              maxHeight: '260px',
              objectFit: 'contain',
              borderRadius: '12px',
              marginBottom: '20px',
              border: 'var(--glass-border)',
              background: '#000'
            }}
          />
        )}

        {isEditing ? (
          <div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">氏名</label>
                <input
                  className="form-input"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">会社名</label>
                <input
                  className="form-input"
                  value={editData.company}
                  onChange={(e) => setEditData({ ...editData, company: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">電話番号</label>
                <input
                  className="form-input"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">携帯番号</label>
                <input
                  className="form-input"
                  value={editData.mobile}
                  onChange={(e) => setEditData({ ...editData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input
                className="form-input"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>保存</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building size={18} color="#06B6D4" />
              <div>
                <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{card.company || '会社名未登録'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {card.department} {card.title}
                </div>
              </div>
            </div>

            {card.phone && (
              <div className="card-info-item">
                <Phone size={16} color="#38BDF8" />
                <a href={`tel:${card.phone}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                  {card.phone}
                </a>
                <span style={{ fontSize: '0.7rem', color: '#06B6D4', border: '1px solid #06B6D4', padding: '1px 6px', borderRadius: '4px' }}>
                  CallKit 同期
                </span>
              </div>
            )}

            {card.mobile && (
              <div className="card-info-item">
                <Phone size={16} color="#38BDF8" />
                <a href={`tel:${card.mobile}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                  {card.mobile} (携帯)
                </a>
              </div>
            )}

            {card.email && (
              <div className="card-info-item">
                <Mail size={16} color="#38BDF8" />
                <a href={`mailto:${card.email}`} style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
                  {card.email}
                </a>
              </div>
            )}

            {card.address && (
              <div className="card-info-item">
                <MapPin size={16} color="#38BDF8" />
                <span>{card.address}</span>
              </div>
            )}

            {card.website && (
              <div className="card-info-item">
                <Globe size={16} color="#38BDF8" />
                <a href={card.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-secondary)' }}>
                  {card.website}
                </a>
              </div>
            )}

            {card.tags && card.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {card.tags.map((t, idx) => (
                  <span key={idx} className="tag-pill active" style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={handleShareVCard}>
                <Share2 size={16} />
                <span>vCard 共有 / 単体登録</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
