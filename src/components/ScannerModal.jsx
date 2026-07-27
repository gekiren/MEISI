import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Sparkles, AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import { analyzeBusinessCard } from '../services/geminiService';
import { addCard } from '../db/db';
import confetti from 'canvas-confetti';

export default function ScannerModal({ isOpen, onClose, apiKey, onCardAdded }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [cardData, setCardData] = useState(null);
  const [newTagInput, setNewTagInput] = useState('');
  
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // 画像ファイル読み込み
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target.result;
        setSelectedImage(base64);
        setErrorMsg(null);
        startAiAnalysis(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  // AI解析の開始
  const startAiAnalysis = async (base64) => {
    if (!apiKey) {
      setErrorMsg('Gemini APIキーが設定されていません。画面上の「APIキー」から入力してください。');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const result = await analyzeBusinessCard(base64, apiKey);
      setCardData({
        name: result.name || '',
        reading: result.reading || '',
        company: result.company || '',
        department: result.department || '',
        title: result.title || '',
        phone: result.phone || '',
        mobile: result.mobile || '',
        email: result.email || '',
        postalCode: result.postalCode || '',
        address: result.address || '',
        website: result.website || '',
        memo: result.memo || '',
        tags: result.tags || ['新規名刺']
      });
    } catch (err) {
      setErrorMsg(err.message || 'AI解析に失敗しました。画像を確認して再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 名刺の保存
  const handleSaveCard = async () => {
    if (!cardData || !cardData.name) {
      alert('氏名は必須です。');
      return;
    }

    try {
      await addCard({
        ...cardData,
        image: selectedImage
      });

      // 祝勝アニメーション
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 }
      });

      onCardAdded();
      handleResetAndClose();
    } catch (err) {
      console.error('Failed to save card:', err);
      alert('名刺の保存に失敗しました。');
    }
  };

  const handleResetAndClose = () => {
    setSelectedImage(null);
    setCardData(null);
    setErrorMsg(null);
    setIsAnalyzing(false);
    onClose();
  };

  const addTag = () => {
    if (newTagInput.trim() && !cardData.tags.includes(newTagInput.trim())) {
      setCardData({ ...cardData, tags: [...cardData.tags, newTagInput.trim()] });
      setNewTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setCardData({ ...cardData, tags: cardData.tags.filter(t => t !== tagToRemove) });
  };

  return (
    <div className="modal-overlay" onClick={handleResetAndClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={22} color="#6366F1" />
            <h2 className="modal-title">名刺スキャン & AI解析</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={handleResetAndClose}>
            <X size={18} />
          </button>
        </div>

        {/* ドロップゾーン / カメラ選択 */}
        {!selectedImage && (
          <div className="scan-dropzone" onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: 'var(--accent-glow)'
            }}>
              <Camera size={28} color="#fff" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
              カメラで撮影 / 画像をアップロード
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              タップしてスマホのカメラを起動するか、名刺画像を選択してください
            </p>
          </div>
        )}

        {/* 解析中ローダー */}
        {isAnalyzing && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px', width: '36px', height: '36px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
              <Sparkles size={20} />
              <span style={{ fontWeight: '600' }}>Gemini AI が名刺情報を分析中...</span>
            </div>
          </div>
        )}

        {/* エラーメッセージ */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#EF4444',
            fontSize: '0.88rem',
            marginBottom: '16px'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* スキャン画像プレビュー＆修正フォーム */}
        {selectedImage && cardData && !isAnalyzing && (
          <div>
            <img src={selectedImage} alt="名刺プレビュー" className="scanned-preview-img" />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '0.85rem', marginBottom: '16px', fontWeight: '600' }}>
              <CheckCircle2 size={18} />
              <span>AI解析完了！必要に応じて内容を修正・保存してください。</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">氏名 *</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.name}
                  onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">フリガナ</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.reading}
                  onChange={(e) => setCardData({ ...cardData, reading: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">会社名</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.company}
                  onChange={(e) => setCardData({ ...cardData, company: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">役職</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.title}
                  onChange={(e) => setCardData({ ...cardData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">電話番号 (CallKit同期対象)</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.phone}
                  onChange={(e) => setCardData({ ...cardData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">携帯番号</label>
                <input
                  type="text"
                  className="form-input"
                  value={cardData.mobile}
                  onChange={(e) => setCardData({ ...cardData, mobile: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input
                type="email"
                className="form-input"
                value={cardData.email}
                onChange={(e) => setCardData({ ...cardData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">住所</label>
              <input
                type="text"
                className="form-input"
                value={cardData.address}
                onChange={(e) => setCardData({ ...cardData, address: e.target.value })}
              />
            </div>

            {/* タグ設定 */}
            <div className="form-group">
              <label className="form-label">タグ</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {cardData.tags.map((t, idx) => (
                  <span key={idx} className="tag-pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={12} />
                    {t}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeTag(t)} />
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="新しいタグを追加..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                />
                <button className="btn btn-secondary" onClick={addTag}>追加</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={handleResetAndClose}>キャンセル</button>
              <button className="btn btn-primary" onClick={handleSaveCard}>データベースに保存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
