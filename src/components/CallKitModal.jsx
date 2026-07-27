import React from 'react';
import { X, PhoneCall, ShieldCheck, Download, Share2, Copy, Check } from 'lucide-react';
import { exportCallKitFile, shareCallKitData, generateCallKitDirectoryData } from '../services/callKitService';

export default function CallKitModal({ isOpen, onClose, cards }) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const entries = generateCallKitDirectoryData(cards);

  const handleCopyText = async () => {
    const textContent = entries.map(e => `${e.phone} -> ${e.label}`).join('\n');
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <PhoneCall size={22} color="#06B6D4" />
            <h2 className="modal-title">CallKit 着信相手識別設定</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <ShieldCheck size={24} color="#06B6D4" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.85rem' }}>
            <strong style={{ color: '#06B6D4', display: 'block', marginBottom: '4px' }}>
              連絡先アプリ（電話帳）を汚さずに着信表示を行う仕組み
            </strong>
            MeisiScan は、標準連絡先とは独立した OS のシステム着信識別データベース（iOS: CallKit Call Directory / Android: CallScreening）と自動連携します。
            電話がかかってきた際、電話帳に1件も登録していなくても着信画面に「<strong>〇〇商事 山田太郎 [MeisiScan]</strong>」と表示されます。
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--text-main)' }}>
            現在の同期対象電話番号: <span style={{ color: '#06B6D4' }}>{entries.length} 件</span>
          </h4>

          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '8px',
            padding: '12px',
            maxHeight: '140px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            border: 'var(--glass-border)'
          }}>
            {entries.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6B7280', padding: '10px' }}>
                登録済みの名刺に電話番号が含まれていません。
              </div>
            ) : (
              entries.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span style={{ color: '#38BDF8' }}>{item.phone}</span>
                  <span>{item.label}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '24px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => exportCallKitFile(cards)}>
              <Download size={16} />
              <span>CallKit DBエクスポート (.csv)</span>
            </button>

            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => shareCallKitData(cards)}>
              <Share2 size={16} />
              <span>データ共有</span>
            </button>
          </div>

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleCopyText}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            <span>{copied ? '識別リストをコピーしました！' : 'E.164 電話識別リストをクリップボードにコピー'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
