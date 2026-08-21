import { randomUUID } from 'node:crypto';

// A job starts running the moment it is created - there is no queued state,
// because generations are never deferred or batched.
export const JobState = Object.freeze({
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
});

export const TERMINAL_STATES = Object.freeze([JobState.DONE, JobState.FAILED]);

export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

export function createJob({ params, now = Date.now() }) {
  return {
    id: randomUUID(),
    params,
    state: JobState.RUNNING,
    startedAt: now,
    finishedAt: null,
    result: null,
    error: null,
  };
}
