/**
 * Generates the bcrypt hash for `STAFF_MANAGER_PIN_HASH`.
 *
 *   npx tsx scripts/hash-staff-pin.ts
 *
 * Reads the PIN from stdin rather than argv, so it never lands in the shell
 * history or a process list, and echoes only the hash. Paste that hash into the
 * Vercel environment variable; the PIN itself is never stored anywhere in this
 * repository or on the server.
 *
 * To rotate: run this again with a new PIN and replace the variable. Any
 * manager edit grant already minted stays valid for its remaining few minutes
 * -- that is a deliberately short window, and revoking in-flight grants is
 * `POST /api/staff/locations/revoke` or a sign-out.
 *
 * There is no companion "set the PIN" script. Writing the hash into the
 * environment is a deployment action and belongs with whoever controls the
 * deployment, not in a script that could be run against production by accident.
 */

import { createInterface } from 'node:readline'

import { PIN_BCRYPT_ROUNDS, checkPinShape, hashPin, MAX_PIN_LENGTH, MIN_PIN_LENGTH } from '../lib/staff/pin-hash'

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  process.stderr.write(
    `Manager PIN: ${MIN_PIN_LENGTH}-${MAX_PIN_LENGTH} digits, bcrypt cost ${PIN_BCRYPT_ROUNDS}.\n` +
      'The PIN is not echoed back and is not written anywhere.\n\n'
  )

  const pin = (await prompt('Enter the new manager PIN: ')).trim()

  const shapeError = checkPinShape(pin)
  if (shapeError) {
    process.stderr.write(`\nRejected: ${shapeError}\n`)
    process.exit(1)
  }

  const confirm = (await prompt('Enter it again to confirm: ')).trim()
  if (confirm !== pin) {
    process.stderr.write('\nRejected: the two entries do not match.\n')
    process.exit(1)
  }

  const hash = await hashPin(pin)

  // Guidance on stderr, the hash alone on stdout, so the output can be piped.
  process.stderr.write('\nSet this in Vercel (Production, and any environment that needs editing):\n\n')
  process.stdout.write(`STAFF_MANAGER_PIN_HASH=${hash}\n`)
  process.stderr.write(
    '\nA 6-digit PIN is ~10^6 combinations, so the hash protects it at rest but\n' +
      'would not survive an offline attack for long. The controls that matter are\n' +
      'that it stays server-side and that the attempt throttle caps online\n' +
      'guessing at 5 tries per 10 minutes.\n'
  )
}

main().catch((error) => {
  console.error('[HASH_STAFF_PIN] failed', error)
  process.exit(1)
})
