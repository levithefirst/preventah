'use client';

import { useState } from 'react';

/**
 * A transaction reference that works inside the Nimiq Pay WebView.
 *
 * `target="_blank"` does not reliably open inside the Mini App WebView: Nimiq
 * Pay shows "This page couldn't load" instead of handing off to a browser.
 * So nothing here depends on navigation succeeding. The hash is always
 * rendered as selectable text (long-press to copy works even with no
 * clipboard permission), with a copy button as the fast path and the full
 * explorer URL available to copy for opening elsewhere.
 */
export default function TxReference({
  hash,
  label = 'Transaction',
}: {
  hash: string;
  label?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const explorerUrl = `https://polygonscan.com/tx/${hash}`;

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
    } catch {
      // Clipboard API is unavailable or blocked in this WebView. The hash is
      // still on screen and selectable, which is the fallback.
      setCopied('unavailable');
    }
    setTimeout(() => setCopied(null), 2500);
  }

  return (
    <div className="pv-tx">
      <span className="pv-tx-label">{label}</span>
      <code className="pv-tx-hash">{hash}</code>

      <div className="pv-tx-actions">
        <button
          type="button"
          className="pv-link-btn"
          onClick={() => copy(hash, 'hash')}
        >
          Copy hash
        </button>
        <button
          type="button"
          className="pv-link-btn"
          onClick={() => copy(explorerUrl, 'link')}
        >
          Copy explorer link
        </button>
      </div>

      {copied === 'hash' ? (
        <p className="faint">Transaction hash copied.</p>
      ) : null}
      {copied === 'link' ? (
        <p className="faint">Explorer link copied. Paste it into a browser.</p>
      ) : null}
      {copied === 'unavailable' ? (
        <p className="faint">
          Copying is blocked here. Select the hash above and copy it manually,
          then look it up on polygonscan.com.
        </p>
      ) : null}
    </div>
  );
}
