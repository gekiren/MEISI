import React from 'react';
import { CreditCard, Plus, PhoneIncoming, FileSpreadsheet, RefreshCw } from 'lucide-react';

export default function Header({ onOpenScan, onOpenCallKit, onExportCSV, onCheckOta, isCheckingOta, cardCount }) {
  return (
    <header className="header">
      <div className="header-top">
        <div className="brand">
          <div className="brand-icon">
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className="brand-title">MeisiScan</h1>
            <div className="brand-subtitle">AI 名刺スキャン & CallKit 着信表示</div>
          </div>
        </div>

        <button className="btn btn-primary btn-scan" onClick={onOpenScan}>
          <Plus size={18} />
          <span>名刺スキャン</span>
        </button>
      </div>

      <div className="header-sub-actions">
        <button className="btn btn-secondary btn-sm" onClick={onCheckOta} title="OTA最新アップデート確認" disabled={isCheckingOta}>
          <RefreshCw size={14} className={isCheckingOta ? 'spin-icon' : ''} color="#10B981" />
          <span>{isCheckingOta ? '確認中...' : 'OTA更新'}</span>
        </button>

        <button className="btn btn-secondary btn-sm" onClick={onOpenCallKit} title="CallKit 着信表示同期">
          <PhoneIncoming size={14} color="#06B6D4" />
          <span>CallKit 着信設定</span>
        </button>

        <button className="btn btn-secondary btn-sm" onClick={onExportCSV} title="CSVエクスポート">
          <FileSpreadsheet size={14} />
          <span>CSV出力</span>
        </button>
      </div>
    </header>
  );
}
