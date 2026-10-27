/**
 * Reads — and with `--apply`, sets — the ELEC10 coupon's end date so the
 * coupon stops validating at exactly the moment the on-site countdown reaches
 * zero.
 *
 *   npx tsx scripts/election-coupon-deadline.ts            # report only
 *   npx tsx scripts/election-coupon-deadline.ts --apply    # write it
 *
 * A script rather than the admin screen because the two deadlines have to
 * agree to the second, and the admin form takes a local date/time that a human
 * has to convert. The single source of truth is `ELECTION_SALE_END` in
 * app/components/PromoCountdown.tsx, which this imports rather than restates —
 * so the countdown and the coupon cannot drift apart by being edited in one
 * place only.
 *
 * `endDate` is compared as `coupon.endDate < now` in validateCouponForCart, so
 * the coupon is accepted right up to the instant the countdown hides itself and
 * refused from that instant on.
 */
import 'dotenv/config'

import { prisma } from '../lib/prisma'
import { ELECTION_SALE_END } from '../app/components/PromoCountdown'

const CODE = 'ELEC10'

function describe(label: string, value: Date | null | undefined): string {
  if (!value) return `${label}: (none)`
  return [
    `${label}: ${value.toISOString()}`,
    `(Jerusalem: ${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      dateStyle: 'full',
      timeStyle: 'long',
      hour12: false,
    }).format(value)})`,
  ].join('\n    ')
}

async function main() {
  const apply = process.argv.includes('--apply')
  const target = new Date(ELECTION_SALE_END)

  if (Number.isNaN(target.valueOf())) {
    throw new Error(`ELECTION_SALE_END is not a valid date: ${ELECTION_SALE_END}`)
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: CODE },
    select: { id: true, code: true, isActive: true, startDate: true, endDate: true },
  })

  if (!coupon) {
    throw new Error(`Coupon ${CODE} not found.`)
  }

  console.log(`Coupon ${coupon.code} (${coupon.id}) — active: ${coupon.isActive}`)
  console.log('  ' + describe('starts  ', coupon.startDate))
  console.log('  ' + describe('ends    ', coupon.endDate))
  console.log('  ' + describe('countdown', target))

  const alreadyCorrect = coupon.endDate?.getTime() === target.getTime()
  if (alreadyCorrect) {
    console.log('\nIn sync — coupon ends exactly when the countdown does.')
    return
  }

  if (!apply) {
    console.log('\nOUT OF SYNC. Re-run with --apply to set the coupon end date to the countdown deadline.')
    process.exitCode = 1
    return
  }

  const updated = await prisma.coupon.update({
    where: { id: coupon.id },
    data: { endDate: target },
    select: { endDate: true },
  })

  console.log('\nUpdated.')
  console.log('  ' + describe('ends now', updated.endDate))
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
