import { SOURCES } from './sources'

async function main(): Promise<void> {
  console.log(`[digest] source count: ${SOURCES.length}`)
  console.log('[digest] generator scaffold is ready')
}

void main().catch((error) => {
  console.error('[digest] failed', error)
  process.exit(1)
})
