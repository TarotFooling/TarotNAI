import { randomUUID } from 'node:crypto';

export const JobState = Object.freeze({
  RUNNING: 'running',
  DONE: 'done',
  FAILED: 'failed',
});

export const TERMINAL_STATES = Object.freeze([JobState.DONE, JobState.FAILED]);

export function isTerminal(state) {
  return TERMINAL_STATES.includes(state);
}

export function createJob({ params, wantsPreview = false, now = Date.now() }) {
  return {
    id: randomUUID(),
    params,
    wantsPreview,
    state: JobState.RUNNING,
    startedAt: now,
    finishedAt: null,
    result: null,
    error: null,
  };
}
