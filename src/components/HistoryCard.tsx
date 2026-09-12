'use client';

import type { StakeHistoryView } from '@/lib/state';

const STATUS_LABEL: Record<StakeHistoryView['status'], { text: string; tone: string }> = {
  pending: { text: 'Confirming', tone: 'warn' },
  active: { text: 'In progress', tone: '' },
  rejected: { text: 'Not counted', tone: 'bad' },
  settling: { text: 'Settling', tone: 'warn' },
  completed: { text: 'Paid out', tone: 'ok' },
  payout_failed: { text: 'Needs attention', tone: 'bad' },
};

function polygonscan(hash: string): string {
  return `https://polygonscan.com/tx/${hash}`;
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
              {row.payoutTxHash ? (
                <a
                  className="faint"
                  href={polygonscan(row.payoutTxHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View payout
                </a>
              ) : null}
            </div>
            <span className={`badge ${status.tone}`}>{status.text}</span>
          </div>
        );
      })}
    </section>
  );
}
