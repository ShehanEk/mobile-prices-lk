import { probeSpecs, runSpecs } from '@/pipeline/specs'
import { RunInProgressError, detectActor, finishRun, reapStaleRuns, startRun } from '@/pipeline/runs'

/**
 * CLI for the GSMArena specs job.
 *
 *   npm run specs                         every model still missing (budget 1,000 requests)
 *   npm run specs -- --max-requests 400   stop after 400 requests (about 35 minutes)
 *   npm run specs -- --dry-run            fetch and log, write nothing
 *   npm run specs -- --probe              does GSMArena answer this machine? (~20 requests, no database)
 *
 * Wrapped in a pipeline_runs row and lease, like scrape and normalize. A
 * 403/429/redirect/bot check stops the run and exits 1, as does a brand whose
 * list could not be read, so it shows in the log or the workflow; a used-up
 * budget is a normal stop.
 */
async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--probe')) process.exit((await probeSpecs()) ? 0 : 1)

  const i = args.indexOf('--max-requests')
  const n = i !== -1 ? Number(args[i + 1]) : NaN
  const maxRequests = Number.isFinite(n) && n > 0 ? n : undefined
  const dryRun = args.includes('--dry-run')

  await reapStaleRuns()

  let handle
  try {
    handle = await startRun({ kind: 'specs', actor: detectActor(), dryRun })
  } catch (err) {
    if (err instanceof RunInProgressError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }

  const lines: string[] = []
  const log = (m: string) => {
    lines.push(m)
    console.log(m)
  }

  try {
    const result = await runSpecs({ maxRequests, dryRun, log })
    const failed = result.blocked || result.failedBrands.length > 0
    await finishRun(handle, { ok: !failed, result, logTail: lines.join('\n') })
    if (failed) process.exit(1)
  } catch (err) {
    await finishRun(handle, { ok: false, error: err, logTail: lines.join('\n') })
    throw err
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
