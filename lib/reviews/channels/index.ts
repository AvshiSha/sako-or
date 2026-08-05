import 'server-only'
import { emailReviewChannel } from './email'
import { inforuReviewChannel } from './inforu'
import type { ReviewChannel } from './types'

export type { ReviewChannel, ReviewChannelContext, ReviewChannelResult } from './types'

/**
 * All known review-request channels, in send order.
 *
 * Email is first because it is fully under our control — the template lives in this
 * repo, so it works the moment the code deploys. The Inforu channel depends on an
 * automation configured in their console and stays disabled until
 * INFORU_REVIEW_EVENT_NAME names it.
 */
const allChannels: ReviewChannel[] = [emailReviewChannel, inforuReviewChannel]

export function getEnabledReviewChannels(): ReviewChannel[] {
  return allChannels.filter((channel) => channel.isEnabled())
}

export function getAllReviewChannels(): ReviewChannel[] {
  return allChannels
}
