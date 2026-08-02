import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Sparkles, AlertCircle, CheckCircle2, Tag, ScanLine, Image, Grid, Layers } from 'lucide-react';
import { analyzeBusinessCardWithFallback } from '../services/aiService';
import { isNativeScannerAvailable, scanDocumentWithNativeScanner } from '../services/documentScannerService';
import { addCard } from '../db/db';
import confetti from 'canvas-confetti';

export default function ScannerModal({
  isOpen,
  onClose,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl,
  scannedImageFromNative,
  scannedImagesFromNative,
  onCardAdded
}) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusNotice, setStatusNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  
  // 抽出された名刺データ一覧 (複数枚対応)
  const [extractedCards, setExtractedCards] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [newTagInput, setNewTagInput] = useState('');

  // スキャンモードオプション
  const [isMultiScan, setIsMultiScan] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [isDesignCard, setIsDesignCard] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (scannedImagesFromNative && scannedImagesFromNative.length > 0) {
        if (scannedImagesFromNative.length >= 5) {
          alert('一度にスキャンできる名刺は最大4枚までです。4枚以下で撮影してください。');
          return;
        }
        setSelectedImages(scannedImagesFromNative);
        setErrorMsg(null);
        startBatchAnalysis(scannedImagesFromNative);
      } else if (scannedImageFromNative) {
        setSelectedImages([scannedImageFromNative]);
        setErrorMsg(null);
        startBatchAnalysis([scannedImageFromNative]);
      }
    }
  }, [isOpen, scannedImageFromNative, scannedImagesFromNative]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length >= 5) {
      alert('一度にスキャンできる名刺は最大4枚までです。4枚以下を選択してください。');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(base64List => {
      setSelectedImages(base64List);
      setErrorMsg(null);
      startBatchAnalysis(base64List);
    });
  };

  const startBatchAnalysis = async (imagesList) => {
    setIsAnalyzing(true);
    setStatusNotice('AI 解析を実行中...');
    setErrorMsg(null);
    setExtractedCards([]);

    // 複数画像が指定されている場合も isMultiScan を有効化
    const effectiveMultiScan = isMultiScan || imagesList.length > 1;
    const scanOptions = { isVertical, isDesignCard, isMultiScan: effectiveMultiScan };
    const allCards = [];
    let hasError = false;
    let lastErrorReason = null;

    try {
      for (let i = 0; i < imagesList.length; i++) {
        const img = imagesList[i];
        if (imagesList.length > 1) {
          setStatusNotice(`AI 解析中 (${i + 1} / ${imagesList.length} 枚目)...`);
        }

        const result = await analyzeBusinessCardWithFallback(
          img,
          geminiApiKey,
          deepSeekApiKey,
          workerProxyUrl,
          (fallbackMsg) => setStatusNotice(fallbackMsg),
          scanOptions
        );

        if (result.isBusinessCard === false) {
          hasError = true;
          lastErrorReason = result.reason || '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。';
          continue;
        }

        // 1つの画像に複数名刺 (cards: [...]) が含まれる場合
        if (Array.isArray(result.cards) && result.cards.length > 0) {
          if (result.cards.length >= 5) {
            hasError = true;
            lastErrorReason = '画像内に5枚以上の名刺が検知されました。読み取り精度を保つため、4枚以下（2×2配置推奨）にして再度撮影してください。';
            continue;
          }
          result.cards.forEach((c) => {
            const cleanName = (c.name || '').replace(/[(（]名刺読み取り失敗[）)]/g, '').replace(/[(（]氏名未検出[）)]/g, '').trim();
            allCards.push({
              name: cleanName,
              reading: c.reading || '',
              company: c.company || '',
              department: c.department || '',
              title: c.title || '',
              phone: c.phone || '',
              mobile: c.mobile || '',
              email: c.email || '',
              postalCode: c.postalCode || '',
              address: c.address || '',
              website: c.website || '',
              memo: c.memo || '',
              tags: Array.isArray(c.tags) && c.tags.length > 0 ? c.tags : ['新規名刺'],
              image: img
            });
          });
        } else {
          // 単一カードの場合
          const cleanName = (result.name || '').replace(/[(（]名刺読み取り失敗[）)]/g, '').replace(/[(（]氏名未検出[）)]/g, '').trim();
          const hasCoreInfo = cleanName || result.company || result.phone || result.mobile || result.email;
          if (!hasCoreInfo) {
            hasError = true;
            lastErrorReason = '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。';
            continue;
          }

          allCards.push({
            name: cleanName,
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
            tags: Array.isArray(result.tags) && result.tags.length > 0 ? result.tags : ['新規名刺'],
            image: img
          });
        }
      }

      if (allCards.length === 0) {
        setErrorMsg(lastErrorReason || '選択された画像から名刺情報を検出できませんでした。名刺がはっきりと写っている画像でお試しください。');
      } else {
        setExtractedCards(allCards);
        setActiveCardIndex(0);
        if (hasError && lastErrorReason) {
          setErrorMsg(`一部の画像でエラーが発生しました: ${lastErrorReason}`);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'AI解析に失敗しました。画像の鮮明さを確認して再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveAllCards = async () => {
    if (extractedCards.length === 0) return;

    for (let i = 0; i < extractedCards.length; i++) {
      if (!extractedCards[i].name) {
        alert(`名刺 #${i + 1} の氏名が入力されていません。`);
        setActiveCardIndex(i);
        return;
      }
    }

    try {
      for (const card of extractedCards) {
        await addCard(card);
      }

      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 }
      });

      onCardAdded();
      handleResetAndClose();
    } catch (err) {
      console.error('Failed to save cards:', err);
      alert('名刺の保存に失敗しました。');
    }
  };

  const handleResetAndClose = () => {
    setSelectedImages([]);
    setExtractedCards([]);
    setActiveCardIndex(0);
    setErrorMsg(null);
    setIsAnalyzing(false);
    setStatusNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const updateActiveCardField = (field, value) => {
    const updated = [...extractedCards];
    updated[activeCardIndex] = { ...updated[activeCardIndex], [field]: value };
    setExtractedCards(updated);
  };

  const addTagToActiveCard = () => {
    if (!newTagInput.trim()) return;
    const activeCard = extractedCards[activeCardIndex];
    if (!activeCard.tags.includes(newTagInput.trim())) {
      updateActiveCardField('tags', [...activeCard.tags, newTagInput.trim()]);
      setNewTagInput('');
    }
  };

  const removeTagFromActiveCard = (tagToRemove) => {
    const activeCard = extractedCards[activeCardIndex];
    updateActiveCardField('tags', activeCard.tags.filter(t => t !== tagToRemove));
  };

  const currentCard = extractedCards[activeCardIndex];

  return (
    <div className="modal-overlay" onClick={handleResetAndClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={20} color="#6366F1" style={{ flexShrink: 0 }} />
            <h2 className="modal-title" style={{ fontSize: '1.05rem', lineHeight: '1.3' }}>
              {isMultiScan ? '複数名刺スキャン (最大4枚)' : '名刺スキャン & AI自動解析'}
            </h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={handleResetAndClose}>
            <X size={18} />
          </button>
        </div>

        {selectedImages.length === 0 && (
          <>
            {/* スキャンモード切替 (通常 vs 複数スキャン) */}
            <div style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '4px',
              borderRadius: 'var(--radius-md)'
            }}>
              <button
                className={`btn ${!isMultiScan ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
                onClick={() => setIsMultiScan(false)}
              >
                <Camera size={14} />
                <span>通常スキャン (1枚)</span>
              </button>
              <button
                className={`btn ${isMultiScan ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  background: isMultiScan ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : ''
                }}
                onClick={() => setIsMultiScan(true)}
              >
                <Layers size={14} />
                <span>複数スキャン (最大4枚)</span>
              </button>
            </div>

            {/* 複数名刺スキャンモード選択時のみ表示する2×2田の字ガイド表示 */}
            {isMultiScan && (
              <div style={{
                padding: '12px 14px',
                marginBottom: '16px',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '0.85rem',
                color: '#C7D2FE'
              }}>
                <Grid size={24} color="#818CF8" style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', color: '#fff', marginBottom: '2px' }}>
                    💡 複数名刺スキャンガイド (最大4枚まで)
                  </strong>
                  机の上に名刺を最大4枚（2×2の田の字配置推奨）並べて撮影するか、ギャラリーから最大4枚まで選択してください。
                </div>
              </div>
            )}

            {/* 詳細オプション */}
            <div style={{
              display: 'flex',
              justify: 'space-around',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                lineHeight: '1.25',
                cursor: 'pointer',
                userSelect: 'none',
                color: isVertical ? 'var(--accent-secondary)' : 'var(--text-color)'
              }}>
                <input
                  type="checkbox"
                  checked={isVertical}
                  onChange={(e) => setIsVertical(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span>↕ 縦書き<br />レイアウト</span>
              </label>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                lineHeight: '1.25',
                cursor: 'pointer',
                userSelect: 'none',
                color: isDesignCard ? '#EC4899' : 'var(--text-color)'
              }}>
                <input
                  type="checkbox"
                  checked={isDesignCard}
                  onChange={(e) => setIsDesignCard(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#EC4899', cursor: 'pointer', flexShrink: 0 }}
                />
                <span>🎨 デザイン・<br />カラー名刺</span>
              </label>
            </div>

            {isNativeScannerAvailable() && (
              <div style={{ marginBottom: '16px' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '3px',
                    background: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
                    boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)',
                    borderRadius: 'var(--radius-md)'
                  }}
                  onClick={() => scanDocumentWithNativeScanner({ isMultiScan })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: '700' }}>
                    <ScanLine size={18} color="#fff" />
                    <span>グリッドガイド付きカメラで撮影</span>
                  </div>
                  <span style={{ fontSize: '0.76rem', fontWeight: 'normal', opacity: 0.9 }}>
                    (4点指定ではなく格子状矩形枠で範囲調整)
                  </span>
                </button>
              </div>
            )}

            <div className="scan-dropzone" onClick={() => fileInputRef.current?.click()}>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple={isMultiScan}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: isMultiScan ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: 'var(--accent-glow)'
              }}>
                {isMultiScan ? <Grid size={28} color="#fff" /> : <Image size={28} color="#fff" />}
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
                {isMultiScan ? 'アルバムから複数名刺画像を選択 (最大4枚)' : 'アルバムから名刺画像を選択 / アップロード'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {isMultiScan
                  ? '机の上に最大4枚並べて撮影した写真または複数枚の画像を一度に選択可能です'
                  : '端末に保存された名刺画像を選択すると、AI が自動で情報抽出します'}
              </p>
            </div>
          </>
        )}

        {isAnalyzing && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px', width: '36px', height: '36px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
              <Sparkles size={20} />
              <span style={{ fontWeight: '600' }}>{statusNotice || 'AI が名刺情報を分析中...'}</span>
            </div>
          </div>
        )}

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

        {extractedCards.length > 0 && !isAnalyzing && currentCard && (
          <div>
            {/* 複数抽出時のタブ切替ヘッダー */}
            {extractedCards.length > 1 && (
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                overflowX: 'auto',
                paddingBottom: '4px'
              }}>
                {extractedCards.map((card, idx) => (
                  <button
                    key={idx}
                    className={`btn ${idx === activeCardIndex ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '0.85rem', flexShrink: 0 }}
                    onClick={() => setActiveCardIndex(idx)}
                  >
                    名刺 #{idx + 1}: {card.name || '未入力'}
                  </button>
                ))}
              </div>
            )}

            {currentCard.name ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '0.85rem', marginBottom: '16px', fontWeight: '600', padding: '10px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
                <CheckCircle2 size={18} />
                <span>
                  {extractedCards.length > 1
                    ? `${extractedCards.length} 件の名刺を抽出しました！各カードの内容を確認・調整してください。`
                    : 'AI解析が完了しました！内容を確認・調整してデータベースに保存してください。'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontSize: '0.85rem', marginBottom: '16px', fontWeight: '600', padding: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px' }}>
                <AlertCircle size={18} />
                <span>
                  ⚠️ 氏名が自動検出されませんでした。名刺画像を確認して氏名を入力してください。
                </span>
              </div>
            )}

            {currentCard.image && (
              <img src={currentCard.image} alt="名刺プレビュー" className="scanned-preview-img" style={{ maxHeight: '180px', objectFit: 'contain', width: '100%', marginBottom: '16px' }} />
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">氏名 * ({activeCardIndex + 1}/{extractedCards.length})</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.name}
                  onChange={(e) => updateActiveCardField('name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">フリガナ</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.reading}
                  onChange={(e) => updateActiveCardField('reading', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">会社名</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.company}
                  onChange={(e) => updateActiveCardField('company', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">役職</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.title}
                  onChange={(e) => updateActiveCardField('title', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">電話番号 (CallKit同期対象)</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.phone}
                  onChange={(e) => updateActiveCardField('phone', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">携帯番号</label>
                <input
                  type="text"
                  className="form-input"
                  value={currentCard.mobile}
                  onChange={(e) => updateActiveCardField('mobile', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">メールアドレス</label>
              <input
                type="email"
                className="form-input"
                value={currentCard.email}
                onChange={(e) => updateActiveCardField('email', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">住所</label>
              <input
                type="text"
                className="form-input"
                value={currentCard.address}
                onChange={(e) => updateActiveCardField('address', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">タグ</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {currentCard.tags.map((t, idx) => (
                  <span key={idx} className="tag-pill active" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Tag size={12} />
                    {t}
                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeTagFromActiveCard(t)} />
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
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToActiveCard(); } }}
                />
                <button className="btn btn-secondary" onClick={addTagToActiveCard}>追加</button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={handleResetAndClose}>キャンセル</button>
              <button
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}
                onClick={handleSaveAllCards}
              >
                {extractedCards.length > 1
                  ? `${extractedCards.length} 件の名刺を一括保存`
                  : 'データベースに保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
