import { runReviews } from '@/pipeline/reviews'
import { RunInProgressError, detectActor, finishRun, reapStaleRuns, startRun } from '@/pipeline/runs'

/**
 * CLI for the YouTube reviews job.
 *
 *   npm run reviews               read uploads, match, replace what is stored
 *   npm run reviews -- --dry-run  read and log, write nothing
 *
 * Wrapped in a pipeline_runs row and lease, like the other jobs.
 */
async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set')
  const dryRun = process.argv.includes('--dry-run')

  await reapStaleRuns()

  let handle
  try {
    handle = await startRun({ kind: 'reviews', actor: detectActor(), dryRun })
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
    const result = await runReviews({ apiKey, dryRun, log })
    await finishRun(handle, { ok: true, result, logTail: lines.join('\n') })
  } catch (err) {
    await finishRun(handle, { ok: false, error: err, logTail: lines.join('\n') })
    throw err
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
