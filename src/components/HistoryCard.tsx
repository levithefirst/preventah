'use client';

import { useState } from 'react';
import type { StakeHistoryView } from '@/lib/state';

const STATUS_LABEL: Record<StakeHistoryView['status'], { text: string; tone: string }> = {
  pending: { text: 'Confirming', tone: 'warn' },
  active: { text: 'In progress', tone: '' },
  rejected: { text: 'Not counted', tone: 'bad' },
  settling: { text: 'Settling', tone: 'warn' },
  completed: { text: 'Paid out', tone: 'ok' },
  payout_failed: { text: 'Needs attention', tone: 'bad' },
};

/**
 * Copies a payout hash rather than linking out.
 *
 * Same constraint as the pending card: target="_blank" does not reliably
 * open from inside the Nimiq Pay WebView, so this never depends on
 * navigation. The hash is copied, or named so it can be looked up by hand.
 */
function PayoutHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
    } catch {
      setCopied(false);
    }
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="btn-linklike" onClick={copy}>
      {copied ? 'Payout hash copied' : 'Copy payout hash'}
    </button>
  );
}

export default function HistoryCard({ history }: { history: StakeHistoryView[] }) {
  if (history.length === 0) return null;

  return (
    <section className="card">
      <div className="card-head">
        <h2>History</h2>
      </div>

      {history.map((row) => {
        const status = STATUS_LABEL[row.status];
        return (
          <div key={row.id} className="history-row">
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                {row.amountUsdt} USDT
                {row.status === 'completed' && row.rewardUsdt !== '0.00' ? (
                  <span style={{ color: 'var(--success)', fontWeight: 650 }}>
                    {' '}
                    + {row.rewardUsdt}
                  </span>
                ) : null}
              </div>
              <div className="faint">
                {row.checkinCount} of {row.targetDays} days &middot; started{' '}
                {row.startedAt.slice(0, 10)}
              </div>
              {row.payoutTxHash ? <PayoutHash hash={row.payoutTxHash} /> : null}
            </div>
            <span className={`badge ${status.tone}`}>{status.text}</span>
          </div>
        );
      })}
    </section>
  );
}
