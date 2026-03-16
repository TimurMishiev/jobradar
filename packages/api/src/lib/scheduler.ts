import cron from 'node-cron';
import { runIngestion } from '../services/ingestion';

// Default: every 4 hours. Override with INGEST_CRON env var.
// Standard cron syntax: minute hour day month weekday
// '0 */4 * * *' = at minute 0 of every 4th hour
const DEFAULT_CRON = '0 */4 * * *';

export function startScheduler(): void {
  const schedule = process.env.INGEST_CRON ?? DEFAULT_CRON;

  if (!cron.validate(schedule)) {
    process.stderr.write(`[scheduler] Invalid cron expression: "${schedule}" — scheduler not started\n`);
    return;
  }

  process.stdout.write(`[scheduler] Ingestion scheduled: "${schedule}"\n`);

  cron.schedule(schedule, async () => {
    const startedAt = new Date().toISOString();
    process.stdout.write(`[scheduler] Ingestion started at ${startedAt}\n`);

    try {
      const summary = await runIngestion();
      const total = summary.results.reduce((sum, r) => sum + r.created, 0);
      const errors = summary.results.filter((r) => r.error);

      process.stdout.write(
        `[scheduler] Ingestion complete — ${total} new jobs` +
          (errors.length > 0 ? `, ${errors.length} errors` : '') +
          '\n',
      );

      if (errors.length > 0) {
        for (const r of errors) {
          process.stderr.write(`[scheduler] Error for ${r.company}: ${r.error}\n`);
        }
      }
    } catch (err) {
      process.stderr.write(`[scheduler] Ingestion failed: ${(err as Error).message}\n`);
    }
  });
}
