import { runNormalize } from '@/pipeline/normalize'
import {
  RunInProgressError,
  detectActor,
  finishRun,
  reapStaleRuns,
  startRun,
} from '@/pipeline/runs'

/**
 * CLI for the normalize stage.
 *
 *   npm run normalize
 *   npm run normalize -- --dry-run --no-ai
 *   npm run normalize -- --redo --limit 100 --max-model-calls 50
 *
 * Wrapped in a `pipeline_runs` row, same as the scrape CLI, so a failure is
 * recorded and two normalize runs cannot overlap.
 */
async function main() {
  const args = process.argv.slice(2)
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`)
    return i !== -1 ? args[i + 1] : undefined
  }
  const num = (name: string) => (flag(name) ? Number(flag(name)) : undefined)

  const dryRun = args.includes('--dry-run')
  const actor = detectActor()

  // Free any lease left behind by a run that died without closing its row.
  await reapStaleRuns()

  let handle
  try {
    handle = await startRun({ kind: 'normalize', shop: undefined, actor, dryRun })
  } catch (err) {
    if (err instanceof RunInProgressError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }

  // Kept so a failed run records why, not just that it failed.
  const lines: string[] = []
  const log = (msg: string) => {
    lines.push(msg)
    console.log(msg)
  }

  try {
    const result = await runNormalize({
      limit: num('limit'),
      redo: args.includes('--redo'),
      noAi: args.includes('--no-ai'),
      maxModelCalls: num('max-model-calls'),
      dryRun,
      log,
    })
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
