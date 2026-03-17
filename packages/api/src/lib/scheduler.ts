import cron from 'node-cron';
import { runIngestion } from '../services/ingestion';
import { runDailyBriefing } from '../agents/dailyBriefing';
import { runCompanySignals } from '../agents/companySignal';

// Default: every 4 hours. Override with INGEST_CRON env var.
// '0 */4 * * *' = at minute 0 of every 4th hour
const DEFAULT_INGEST_CRON = '0 */4 * * *';

// Daily briefing: 7am every day. Override with BRIEFING_CRON env var.
const DEFAULT_BRIEFING_CRON = '0 7 * * *';

export function startScheduler(): void {
  const ingestSchedule = process.env.INGEST_CRON ?? DEFAULT_INGEST_CRON;

  if (!cron.validate(ingestSchedule)) {
    process.stderr.write(`[scheduler] Invalid INGEST_CRON: "${ingestSchedule}" — ingestion scheduler not started\n`);
  } else {
    process.stdout.write(`[scheduler] Ingestion scheduled: "${ingestSchedule}"\n`);

    cron.schedule(ingestSchedule, async () => {
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

        // Run company signal detection after every ingestion (no GPT, fast)
        runCompanySignals().catch((err) =>
          process.stderr.write(`[scheduler] Company signals failed: ${(err as Error).message}\n`),
        );
      } catch (err) {
        process.stderr.write(`[scheduler] Ingestion failed: ${(err as Error).message}\n`);
      }
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    process.stdout.write('[scheduler] OPENAI_API_KEY not set — daily briefing scheduler skipped\n');
    return;
  }

  const briefingSchedule = process.env.BRIEFING_CRON ?? DEFAULT_BRIEFING_CRON;

  if (!cron.validate(briefingSchedule)) {
    process.stderr.write(`[scheduler] Invalid BRIEFING_CRON: "${briefingSchedule}" — briefing scheduler not started\n`);
    return;
  }

  process.stdout.write(`[scheduler] Daily briefing scheduled: "${briefingSchedule}"\n`);

  cron.schedule(briefingSchedule, async () => {
    process.stdout.write(`[scheduler] Daily briefing started at ${new Date().toISOString()}\n`);
    try {
      await runDailyBriefing();
      process.stdout.write('[scheduler] Daily briefing complete\n');
    } catch (err) {
      process.stderr.write(`[scheduler] Daily briefing failed: ${(err as Error).message}\n`);
    }
  });
}
