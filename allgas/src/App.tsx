import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { clearSession, loadSession, type Session } from './session';
import Gate from './components/Gate';
import Consent from './components/Consent';
import ConditionPicker from './components/ConditionPicker';
import Today from './components/Today';
import Board from './components/Board';
import MailSettings from './components/MailSettings';

type Tab = 'today' | 'conditions' | 'board' | 'mail';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>('today');

  const me = useQuery(api.members.today, session ? { memberId: session.memberId } : 'skip');

  // A member id that no longer resolves means a wiped deployment or a
  // stale browser. Drop it rather than showing a permanently empty app.
  useEffect(() => {
    if (session && me === null) {
      clearSession();
      setSession(null);
    }
  }, [session, me]);

  if (!session) return <Gate onReady={setSession} />;
  if (me === undefined) return <main className="wrap"><p>Loading.</p></main>;
  if (me === null) return <main className="wrap"><p>Loading.</p></main>;

  if (me.needsConsent) {
    return <Consent memberId={session.memberId} />;
  }

  return (
    <main className="wrap">
      <header className="top">
        <h1>Preventah All Gas</h1>
        <p className="sub">
          {me.name} &middot; {me.dayKey} &middot; {me.doneCount}/3 done today
        </p>
      </header>

      <nav className="tabs">
        {(['today', 'conditions', 'board', 'mail'] as Tab[]).map((name) => (
          <button
            key={name}
            className={tab === name ? 'tab on' : 'tab'}
            onClick={() => setTab(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      {tab === 'today' && <Today me={me} />}
      {tab === 'conditions' && <ConditionPicker me={me} />}
      {tab === 'board' && <Board householdId={session.householdId} />}
      {tab === 'mail' && <MailSettings me={me} />}

      <footer className="foot">
        <p>
          General lifestyle guidance from public-health sources. Not medical advice, not a
          diagnosis, not a prediction. A family history raises the value of prevention and of a
          conversation with a clinician.
        </p>
        <button
          className="link"
          onClick={() => {
            clearSession();
            setSession(null);
          }}
        >
          Leave this household on this device
        </button>
      </footer>
    </main>
  );
}
