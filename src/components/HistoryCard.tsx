'use client';

import { useState } from 'react';
import type { StakeHistoryView } from '@/lib/state';
import Window from './ui/Window';
import Badge from './ui/Badge';

const STATUS_LABEL: Record<
  StakeHistoryView['status'],
  { text: string; tone: 'neutral' | 'ok' | 'warn' | 'bad' }
> = {
  pending: { text: 'Confirming', tone: 'warn' },
  active: { text: 'In progress', tone: 'neutral' },
  rejected: { text: 'Not counted', tone: 'bad' },
  settling: { text: 'Settling', tone: 'warn' },
  completed: { text: 'Settled', tone: 'ok' },
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
    <button type="button" className="pv-link-btn" onClick={copy}>
      {copied ? 'Payout hash copied' : 'Copy payout hash'}
    </button>
  );
}

export default function HistoryCard({
  history,
}: {
  history: StakeHistoryView[];
}) {
  if (history.length === 0) return null;

  return (
    <Window bar="Settled" barNote={`${history.length} commitment${history.length === 1 ? '' : 's'}`}>
      <ul className="pv-history">
        {history.map((row) => {
          const status = STATUS_LABEL[row.status];
          const paidReward =
            row.status === 'completed' && row.rewardUsdt !== '0.00';

          return (
            <li key={row.id} className="pv-history-row">
              <div style={{ minWidth: 0 }}>
                <div className="amount" style={{ fontSize: 17 }}>
                  {row.amountUsdt} USDT
                  {paidReward ? (
                    <span className="pv-reward"> + {row.rewardUsdt}</span>
                  ) : null}
                </div>
                <div className="faint">
                  {row.checkinCount} of {row.targetDays} days &middot; started{' '}
                  {row.startedAt.slice(0, 10)}
                </div>
                {row.payoutTxHash ? <PayoutHash hash={row.payoutTxHash} /> : null}
              </div>
              <Badge tone={status.tone}>{status.text}</Badge>
            </li>
          );
        })}
      </ul>
    </Window>
  );
}
