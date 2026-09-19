import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { saveSession, type Session } from '../session';

/**
 * Create a household or join one with a code. The only screen shown to a
 * browser that has never been here.
 */
export default function Gate({ onReady }: { onReady: (session: Session) => void }) {
  const create = useMutation(api.households.create);
  const join = useMutation(api.households.join);

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [householdName, setHouseholdName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        const result = await create({ householdName, memberName });
        const session = { memberId: result.memberId, householdId: result.householdId };
        saveSession(session);
        onReady(session);
      } else {
        const result = await join({ joinCode, memberName });
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        const session = { memberId: result.memberId, householdId: result.householdId };
        saveSession(session);
        onReady(session);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Preventah All Gas</h1>
      <p className="sub">
        Three prevention actions a day, at three budgets, for a whole household.
      </p>

      <div className="tabs">
        <button className={mode === 'create' ? 'tab on' : 'tab'} onClick={() => setMode('create')}>
          Start a household
        </button>
        <button className={mode === 'join' ? 'tab on' : 'tab'} onClick={() => setMode('join')}>
          Join with a code
        </button>
      </div>

      <section className="card">
        {mode === 'create' ? (
          <label>
            Household name
            <input
              value={householdName}
              onChange={(event) => setHouseholdName(event.target.value)}
              placeholder="The Morounfoluwas"
            />
          </label>
        ) : (
          <label>
            Join code
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="ABC234"
              maxLength={6}
            />
          </label>
        )}

        <label>
          Your name
          <input
            value={memberName}
            onChange={(event) => setMemberName(event.target.value)}
            placeholder="Your first name"
          />
        </label>

        {error && <p className="bad">{error}</p>}

        <button className="primary" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Working...' : mode === 'create' ? 'Create household' : 'Join household'}
        </button>
      </section>
    </main>
  );
}
