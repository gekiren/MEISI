import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, apiKey, onSaveApiKey }) {
  const [inputKey, setInputKey] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (apiKey) setInputKey(apiKey);
  }, [apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!inputKey.trim()) {
      setStatusMessage({ type: 'error', text: 'APIキーを入力してください。' });
      return;
    }
    onSaveApiKey(inputKey.trim());
    setStatusMessage({ type: 'success', text: 'Gemini APIキーを安全に保存しました！' });
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={22} color="#6366F1" />
            <h2 className="modal-title">Gemini API キー設定</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          名刺のAI画像解析には Google Gemini API キーを使用します。<br />
          入力されたキーは外部のサーバーへ送信されず、お使いのブラウザ内（Local Storage）にのみ保存されます。
        </p>

        <div className="form-group">
          <label className="form-label">Gemini API Key</label>
          <input
            type="password"
            className="form-input"
            placeholder="AIzaSy..."
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
          />
        </div>

        {statusMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '16px',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: statusMessage.type === 'success' ? '#10B981' : '#EF4444',
            border: statusMessage.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            {statusMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', textDecoration: 'none' }}
          >
            Google AI Studio で無料APIキーを取得 ↗
          </a>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary" onClick={handleSave}>保存する</button>
          </div>
        </div>
      </div>
    </div>
  );
}
