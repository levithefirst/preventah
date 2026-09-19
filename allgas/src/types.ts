import type { FunctionReturnType } from 'convex/server';
import type { api } from '../convex/_generated/api';

/** The one screen payload, typed straight off the query that produces it. */
export type Me = NonNullable<FunctionReturnType<typeof api.members.today>>;
export type Action = Me['actions'][number];
