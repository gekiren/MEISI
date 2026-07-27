import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Cpu, Server } from 'lucide-react';

export default function ApiKeyModal({
  isOpen,
  onClose,
  geminiApiKey,
  deepSeekApiKey,
  workerProxyUrl,
  onSaveApiKeys
}) {
  const [inputGemini, setInputGemini] = useState('');
  const [inputDeepSeek, setInputDeepSeek] = useState('');
  const [inputProxyUrl, setInputProxyUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (geminiApiKey) setInputGemini(geminiApiKey);
    if (deepSeekApiKey) setInputDeepSeek(deepSeekApiKey);
    if (workerProxyUrl) setInputProxyUrl(workerProxyUrl);
  }, [geminiApiKey, deepSeekApiKey, workerProxyUrl]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!inputProxyUrl.trim() && !inputGemini.trim() && !inputDeepSeek.trim()) {
      setStatusMessage({ type: 'error', text: 'Cloudflare Worker プロキシ URL または API キーのいずれかを設定してください。' });
      return;
    }
    onSaveApiKeys(inputGemini.trim(), inputDeepSeek.trim(), inputProxyUrl.trim());
    setStatusMessage({ type: 'success', text: '設定を保存しました！(Cloudflare Worker プロキシ & Gemini 3.6 Flash / DeepSeek V4 対応)' });
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
            <h2 className="modal-title">AI 解析設定 (Cloudflare Worker & API Keys)</h2>
          </div>
          <button className="btn btn-secondary btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          安全な <strong>Cloudflare Worker プロキシ</strong> を経由して API キーを隠蔽して解析するか、ご自身の Gemini / DeepSeek API キーをブラウザに保持して解析することができます。
        </p>

        {/* Cloudflare Worker プロキシ設定 */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#A5B4FC' }}>
            <Server size={16} color="#6366F1" />
            <span>【推奨】Cloudflare Worker プロキシ URL (APIキー隠蔽・安全)</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="https://meisi-ai-proxy.your-subdomain.workers.dev"
            value={inputProxyUrl}
            onChange={(e) => setInputProxyUrl(e.target.value)}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            ※ Worker 側に Gemini 3.6 Flash / DeepSeek V4 のキーを設定して自動フォールバック運用します
          </span>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
          <h4 style={{ fontSize: '0.88rem', marginBottom: '12px', color: 'var(--text-muted)' }}>
            または、個人の API キーをローカル保存して使用:
          </h4>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="#6366F1" />
              <span>1. Google Gemini 3.6 Flash API Key</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="AIzaSy..."
              value={inputGemini}
              onChange={(e) => setInputGemini(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginTop: '14px' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={16} color="#06B6D4" />
              <span>2. DeepSeek V4 API Key</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="sk-..."
              value={inputDeepSeek}
              onChange={(e) => setInputDeepSeek(e.target.value)}
            />
          </div>
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
          <button className="btn btn-primary" onClick={handleSave}>設定を保存</button>
        </div>
      </div>
    </div>
  );
}
