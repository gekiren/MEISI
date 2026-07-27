import React from 'react';
import { CreditCard, Plus, Download, Key, PhoneIncoming, FileSpreadsheet } from 'lucide-react';

export default function Header({ onOpenScan, onOpenApiKey, onOpenCallKit, onExportCSV, cardCount }) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-icon">
          <CreditCard size={24} />
        </div>
        <div>
          <h1 className="brand-title">MeisiScan</h1>
          <div className="brand-subtitle">AI 名刺スキャン & CallKit 着信相手表示</div>
        </div>
      </div>

      <div className="header-actions">
        <button className="btn btn-secondary btn-sm" onClick={onOpenApiKey} title="Gemini APIキー設定">
          <Key size={16} />
          <span>APIキー</span>
        </button>

        <button className="btn btn-secondary btn-sm" onClick={onOpenCallKit} title="CallKit 着信表示同期">
          <PhoneIncoming size={16} color="#06B6D4" />
          <span>CallKit 着信設定</span>
        </button>

        <button className="btn btn-secondary btn-sm" onClick={onExportCSV} title="CSVエクスポート">
          <FileSpreadsheet size={16} />
          <span>CSV出力</span>
        </button>

        <button className="btn btn-primary" onClick={onOpenScan}>
          <Plus size={18} />
          <span>名刺スキャン</span>
        </button>
      </div>
    </header>
  );
}
