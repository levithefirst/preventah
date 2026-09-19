import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/**
 * The live household board.
 *
 * This is a plain useQuery subscription. When anyone in the household
 * checks an action off, every other open copy of this component updates
 * without a refresh, a poll or a websocket of our own. That reactivity is
 * the reason the household framing works at all.
 */
export default function Board({ householdId }: { householdId: Id<'households'> }) {
  const board = useQuery(api.households.board, { householdId });

  if (board === undefined) return <p>Loading.</p>;
  if (board === null) return <p className="bad">That household no longer exists.</p>;

  return (
    <section>
      <div className="card">
        <h2>{board.householdName}</h2>
        <p className="muted">
          Join code <strong>{board.joinCode}</strong> &middot; {board.dayKey} &middot;{' '}
          {board.totalDoneToday} check-in{board.totalDoneToday === 1 ? '' : 's'} today
        </p>
        <p className="muted">
          Anyone with the code can join. Members see that you checked in and how many conditions
          you track, never which ones.
        </p>
      </div>

      {board.members.map((member) => (
        <div className="card row" key={member.memberId}>
          <div>
            <strong>{member.name}</strong>
            <p className="muted">
              {member.consented
                ? `${member.conditionCount} condition${member.conditionCount === 1 ? '' : 's'} tracked`
                : 'Has not consented yet'}
            </p>
            {member.tiersToday.length > 0 && (
              <p className="muted">Tiers today: {member.tiersToday.join(', ')}</p>
            )}
          </div>
          <div className="score">
            <span className="big">{member.doneToday}/3</span>
            <span className="muted">{member.streak} day streak</span>
          </div>
        </div>
      ))}
    </section>
  );
}
