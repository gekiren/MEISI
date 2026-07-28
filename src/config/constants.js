// デフォルトの Cloudflare Worker プロキシ URL (事前組み込み済み)
export const DEFAULT_WORKER_PROXY_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WORKER_PROXY_URL) ||
  'https://meisi-ai-proxy.toshi-diyil.workers.dev';

