import { profileTheme } from './profileTheme'

/**
 * The loading state for a profile pane - orders, personal details, points,
 * favourites, the overview.
 *
 * It replaces a `min-h-screen flex items-center justify-center` spinner that each
 * of those panes carried its own copy of: nine of them across six files, all the
 * same hand-rolled `animate-spin rounded-full h-12 w-12 border-b-2`. A centred
 * spinner in a full-viewport box reserves nothing the real pane will occupy, so
 * the content did not arrive so much as replace it.
 *
 * Built from `profileTheme` - the same `card`, `section` and `sectionTitle` the
 * real panes use - so the card's border, radius and padding are the loaded pane's,
 * and only the contents are placeholders. Same contract as the other chrome
 * modules, and `profileTheme` is already a plain module, which is what makes it
 * safe to read from either side.
 *
 * `rows` is how many content lines to reserve; callers pass what their pane
 * actually shows. Under-reserve rather than over, as everywhere else.
 */
export default function ProfilePaneSkeleton({
  rows = 3,
  showAction = true,
  label = 'Loading',
}: {
  /** Content rows to stand in for. Orders list ~3, a details form ~6. */
  rows?: number
  /** The pane header's trailing link ("back to profile"), where one exists. */
  showAction?: boolean
  label?: string
}) {
  return (
    <div
      className="pt-6 pb-20 md:pb-6"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <div className={profileTheme.card}>
        {/* Pane header: title on one side, the back link on the other. */}
        <div className="flex items-center justify-between mb-4 px-5 pt-5 sm:px-6 sm:pt-6 md:px-8 md:pt-6">
          <div className="sako-skeleton h-[20px] w-[42%] md:h-[24px]" aria-hidden />
          {showAction && (
            <div
              className="sako-skeleton sako-skeleton-muted h-[16px] w-[96px]"
              aria-hidden
            />
          )}
        </div>

        <div className={profileTheme.section}>
          <div className="flex flex-col gap-[14px]">
            {Array.from({ length: rows }).map((_, index) => (
              <div
                key={`profile-row-${index}`}
                className="flex items-center justify-between gap-4 border-b border-border-subtle pb-[14px] last:border-b-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="sako-skeleton sako-skeleton-muted mb-[8px] h-[14px] w-[58%]"
                    aria-hidden
                  />
                  <div
                    className="sako-skeleton sako-skeleton-muted h-[12px] w-[34%]"
                    aria-hidden
                  />
                </div>
                <div
                  className="sako-skeleton sako-skeleton-muted h-[14px] w-[72px] shrink-0"
                  aria-hidden
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
