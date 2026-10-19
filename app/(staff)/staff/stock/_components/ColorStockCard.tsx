'use client'

import { useState } from 'react'

import type { StaffColorCard } from '@/lib/staff/combine-stock'
import type { LocationsState } from '@/lib/staff/api-types'
import { formatLocation, staffText } from '@/lib/staff/messages'
import { staffTheme } from '../../../_components/staffTheme'

/**
 * One colour of one model: its name, its warehouse location, and its sizes.
 *
 * Everything a picker needs is on this card, with no navigation step per
 * colour, and the location is the largest thing on it.
 *
 * Three rules this component exists to enforce:
 *
 *  1. **No image means no image element.** Not a placeholder, not a "no image"
 *     message, not an empty column holding space. A failed load removes the
 *     area entirely and leaves the stock and location untouched.
 *  2. **A location failure is not an unassigned location.** Those are different
 *     sentences, and showing the wrong one would send someone looking for a
 *     drawer that is actually recorded.
 *  3. **No quantity is rendered unless the quantity is known.** When Verifone
 *     could not be reached the card still shows where the colour lives, but the
 *     size table is absent rather than zeroed.
 */
export default function ColorStockCard({
  card,
  locationsState,
  onEditLocation,
  editDisabled,
}: {
  card: StaffColorCard
  locationsState: LocationsState
  onEditLocation: (card: StaffColorCard) => void
  editDisabled: boolean
}) {
  // Starts true and only ever goes false: a URL that 404s or a CDN hiccup must
  // degrade to "no image", never to a broken-image glyph on a picking screen.
  const [imageOk, setImageOk] = useState(true)
  const showImage = Boolean(card.image?.url) && imageOk

  return (
    <article className={staffTheme.card} data-testid="staff-color-card" data-color-code={card.colorCode}>
      <div className={staffTheme.cardHeader}>
        <div className="min-w-0">
          <h2 className={staffTheme.colorName} data-testid="staff-color-name">
            {card.colorName}
          </h2>
          {/* The Verifone colour code, which is the stable identifier and the
              thing to quote when something looks wrong. */}
          <p className={staffTheme.meta}>
            <span dir="ltr" className="inline-block tabular-nums">
              {card.colorCode}
            </span>
          </p>
        </div>

        {showImage && (
          // Plain <img>, not next/image: these are Firebase Storage URLs for
          // products that may not be on the storefront at all, and routing them
          // through the optimizer would make a missing image a 400 instead of a
          // quiet onError we can recover from.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image!.url}
            alt={card.image!.alt}
            width={72}
            height={72}
            loading="lazy"
            onError={() => setImageOk(false)}
            className="h-[72px] w-[72px] shrink-0 rounded-sako-sm object-cover"
            data-testid="staff-color-image"
          />
        )}
      </div>

      {/* The location, as prominent as the brief asks for. */}
      <div className={staffTheme.locationBlock}>
        {locationsState === 'error' ? (
          <p className={staffTheme.locationEmpty} data-testid="staff-location-error">
            {staffText.locationUnavailable}
          </p>
        ) : card.location ? (
          <p className={staffTheme.locationValue} data-testid="staff-location">
            {formatLocation(card.location)}
          </p>
        ) : (
          <p className={staffTheme.locationEmpty} data-testid="staff-location-unassigned">
            {staffText.noLocation}
          </p>
        )}

        <button
          type="button"
          onClick={() => onEditLocation(card)}
          disabled={editDisabled}
          className={`${staffTheme.buttonGhost} mt-1 ps-0`}
          data-testid="staff-edit-location"
        >
          {staffText.editLocation}
        </button>
      </div>

      {/* Sizes. Absent entirely when stock is not known -- see rule 3 above. */}
      {card.stockKnown ? (
        <table className={staffTheme.sizeTable} data-testid="staff-size-table">
          <caption className="sr-only">
            {staffText.sizeColumn} / {staffText.quantityColumn}
          </caption>
          <thead className={staffTheme.sizeHead}>
            <tr>
              <th scope="col" className={staffTheme.sizeCell}>
                {staffText.sizeColumn}
              </th>
              <th scope="col" className={staffTheme.sizeCell}>
                {staffText.quantityColumn}
              </th>
            </tr>
          </thead>
          <tbody>
            {card.sizes.map((row) => (
              <tr key={row.size} data-testid="staff-size-row">
                <td className={staffTheme.sizeCell}>{row.label}</td>
                <td
                  className={`${staffTheme.sizeCell} ${
                    row.quantity === 0 ? staffTheme.sizeCellZero : ''
                  }`}
                  data-testid="staff-size-quantity"
                >
                  {row.quantity}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={staffTheme.totalRow}>
              <td className={staffTheme.sizeCell}>{staffText.totalLabel}</td>
              <td className={staffTheme.sizeCell} data-testid="staff-color-total">
                {card.totalQuantity}
              </td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className={`${staffTheme.sizeCell} ${staffTheme.meta}`}>
          {staffText.stockUnavailable}
        </p>
      )}
    </article>
  )
}
