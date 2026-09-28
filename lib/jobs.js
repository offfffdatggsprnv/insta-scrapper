const { randomUUID } = require('crypto');

class JobManager {
  constructor() {
    this.jobs = new Map();
    this.subscribers = new Map(); // jobId -> Set of res objects for SSE
  }

  createJob(type = 'url', input = {}) {
    const id = randomUUID();
    const job = {
      id,
      type,
      input,
      status: 'pending', // pending, in_progress, completed, failed
      progress: 0,
      stage: 'Initializing',
      message: 'Preparing extraction pipeline...',
      currentSlide: 0,
      totalSlides: 0,
      result: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.jobs.set(id, job);
    this.subscribers.set(id, new Set());
    return job;
  }

  getJob(id) {
    return this.jobs.get(id);
  }

  updateProgress(id, { progress, stage, message, currentSlide, totalSlides }) {
    const job = this.jobs.get(id);
    if (!job) return;

    if (progress !== undefined) job.progress = progress;
    if (stage !== undefined) job.stage = stage;
    if (message !== undefined) job.message = message;
    if (currentSlide !== undefined) job.currentSlide = currentSlide;
    if (totalSlides !== undefined) job.totalSlides = totalSlides;
    job.status = 'in_progress';
    job.updatedAt = Date.now();

    this.notify(id, {
      type: 'progress',
      job
    });
  }

  completeJob(id, result) {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.stage = 'Complete';
    job.message = 'Text extraction complete!';
    job.result = result;
    job.updatedAt = Date.now();

    this.notify(id, {
      type: 'completed',
      job
    });
  }

  failJob(id, error) {
    const job = this.jobs.get(id);
    if (!job) return;

    job.status = 'failed';
    job.stage = 'Failed';
    job.message = error.message || 'An error occurred during extraction';
    job.error = error.message || String(error);
    job.updatedAt = Date.now();

    this.notify(id, {
      type: 'failed',
      job
    });
  }

  subscribe(id, res) {
    if (!this.subscribers.has(id)) {
      this.subscribers.set(id, new Set());
    }
    this.subscribers.get(id).add(res);

    // Immediately send current state
    const job = this.jobs.get(id);
    if (job) {
      res.write(`data: ${JSON.stringify({ type: 'init', job })}\n\n`);
    }

    res.on('close', () => {
      const subs = this.subscribers.get(id);
      if (subs) {
        subs.delete(res);
      }
    });
  }

  notify(id, payload) {
    const subs = this.subscribers.get(id);
    if (!subs) return;
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of subs) {
      try {
        res.write(data);
      } catch (err) {
        subs.delete(res);
      }
    }
  }
}

module.exports = new JobManager();
