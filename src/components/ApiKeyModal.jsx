import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Cpu } from 'lucide-react';

export default function ApiKeyModal({ isOpen, onClose, geminiApiKey, deepSeekApiKey, onSaveApiKeys }) {
  const [inputGemini, setInputGemini] = useState('');
  const [inputDeepSeek, setInputDeepSeek] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (geminiApiKey) setInputGemini(geminiApiKey);
    if (deepSeekApiKey) setInputDeepSeek(deepSeekApiKey);
  }, [geminiApiKey, deepSeekApiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!inputGemini.trim() && !inputDeepSeek.trim()) {
      setStatusMessage({ type: 'error', text: 'Gemini または DeepSeek のどちらか最低1つのAPIキーを入力してください。' });
      return;
    }
    onSaveApiKeys(inputGemini.trim(), inputDeepSeek.trim());
    setStatusMessage({ type: 'success', text: 'AI APIキーの設定を保存しました！(Gemini ⇄ DeepSeek 自動フォールバック対応)' });
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
            <h2 className="modal-title">AI 解析 API キー設定 (Gemini & DeepSeek)</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          名刺のAI自動解析には <strong>Gemini API</strong> をメインで使用し、混雑や通信エラーが発生した場合は自動的に <strong>DeepSeek API</strong> へ切り替えて解析を継続します。
        </p>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} color="#6366F1" />
            <span>1. Google Gemini API Key (メイン)</span>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder="AIzaSy..."
            value={inputGemini}
            onChange={(e) => setInputGemini(e.target.value)}
          />
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}
          >
            Google AI Studio で無料APIキーを取得 ↗
          </a>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={16} color="#06B6D4" />
            <span>2. DeepSeek API Key (混雑・エラー時フォールバック用)</span>
          </label>
          <input
            type="password"
            className="form-input"
            placeholder="sk-..."
            value={inputDeepSeek}
            onChange={(e) => setInputDeepSeek(e.target.value)}
          />
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', textDecoration: 'none', display: 'inline-block', marginTop: '4px' }}
          >
            DeepSeek Platform でAPIキーを取得 ↗
          </a>
        </div>

        {statusMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            margin: '16px 0',
            background: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: statusMessage.type === 'success' ? '#10B981' : '#EF4444',
            border: statusMessage.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            {statusMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={handleSave}>キーを保存</button>
        </div>
      </div>
    </div>
  );
}
