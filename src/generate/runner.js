import { EventEmitter } from 'node:events';
import { JobState, createJob, isTerminal } from '../shared/job.js';

export const FailureCode = Object.freeze({
  TIMED_OUT: 'timed_out',
  GENERATOR_ERROR: 'generator_error',
  SHUTDOWN: 'shutdown',
});

// The lone survivor lol
export class Runner extends EventEmitter {
  #jobs = new Map();
  #running = null;
  #expiresAt = null;
  #generator;
  #now;
  #config;
  #stopped = false;

  constructor({ generator, config = {}, now = Date.now }) {
    super();
    if (typeof generator !== 'function') {
      throw new Error('Runner: generator function is required');
    }

    this.#config = { timeoutMs: 5 * 60 * 1000, ...config };
    this.#now = now;
    this.#generator = generator;
  }

  get busy() {
    return this.#running !== null;
  }

  start({ params }) {
    if (this.#stopped) throw new Error('Runner is stopped');

    if (this.#running) {
      const err = new Error('A generation is already in progress. Wait for it to finish.');
      err.code = 'busy';
      throw err;
    }

    const job = createJob({ params, now: this.#now() });
    this.#jobs.set(job.id, job);

    this.#running = job;
    this.#expiresAt = this.#now() + this.#config.timeoutMs;
    this.#run(job);

    return job;
  }

  subscribe(handler) {
    this.on('job', handler);
    return () => this.off('job', handler);
  }

  getJob(jobId) {
    return this.#jobs.get(jobId) ?? null;
  }

  stats() {
    return { running: this.#running ? 1 : 0 };
  }

  sweepTimedOut() {
    if (!this.#running || this.#expiresAt === null || this.#now() < this.#expiresAt) return null;

    const job = this.#running;
    if (!isTerminal(job.state)) {
      this.#finish(job, JobState.FAILED, {
        code: FailureCode.TIMED_OUT,
        message: 'Generation timed out.',
      });
    }
    this.#running = null;
    this.#expiresAt = null;
    return job.id;
  }

  stop() {
    this.#stopped = true;

    const job = this.#running;
    if (job && !isTerminal(job.state)) {
      this.#finish(job, JobState.FAILED, {
        code: FailureCode.SHUTDOWN,
        message: 'Server is shutting down.',
      });
    }
    this.#running = null;
    this.#expiresAt = null;
  }

  async #run(job) {
    this.#emitJob(job);

    try {
      const result = await this.#generator(job, {});

      if (!isTerminal(job.state)) {
        job.result = result ?? null;
        this.#finish(job, JobState.DONE);
      }
    } catch (error) {
      if (!isTerminal(job.state)) {
        this.#finish(job, JobState.FAILED, {
          code: error?.code ?? FailureCode.GENERATOR_ERROR,
          message: error?.message ?? 'Generation failed.',
        });
      }
    } finally {
      if (this.#running === job) {
        this.#running = null;
        this.#expiresAt = null;
      }
    }
  }

  #finish(job, state, error = null) {
    job.state = state;
    job.error = error;
    job.finishedAt = this.#now();
    this.#emitJob(job);
  }

  #emitJob(job) {
    this.emit('job', job);
  }
}
