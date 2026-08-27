'use client'

import { Fragment, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export interface DeleteProductTarget {
  id: string
  /** English title, for the dialog heading. */
  title: string
  /** Hebrew title, shown underneath when it differs. */
  titleHe?: string
  sku: string
  /** Total units across every colour variant and size. */
  stock: number
  isActive: boolean
  colorVariantCount: number
}

/**
 * Whether this delete should demand the SKU be typed out.
 *
 * True for anything a customer could reach or that still represents inventory.
 * Everything else — an inactive product with no stock — is almost certainly
 * cleanup, and gating that behind transcription would just train people to
 * copy-paste past the dialog without reading it.
 */
export function isHighRiskProductDelete(
  target: Pick<DeleteProductTarget, 'isActive' | 'stock'> | null
): boolean {
  if (!target) return false
  return target.isActive || target.stock > 0
}

/** Case- and whitespace-insensitive: the point is intent, not transcription accuracy. */
export function skuConfirmationMatches(typed: string, sku: string): boolean {
  const normalized = typed.trim().toUpperCase()
  if (!normalized) return false
  return normalized === sku.trim().toUpperCase()
}

interface DeleteProductModalProps {
  target: DeleteProductTarget | null
  isDeleting: boolean
  /** Set when the delete failed, so the dialog can show why without closing. */
  error?: string | null
  onClose: () => void
  onConfirm: () => void
}

/**
 * Confirmation for a permanent product delete.
 *
 * Replaces a bare window.confirm(), which gave the admin no idea what they were
 * about to remove — no name, no SKU, no stock — and no way to tell a
 * discontinued draft from a live product with inventory on the shelf.
 *
 * Follows DeleteCategoryModal: same headlessui Dialog, same layout and red
 * confirm button, so destructive actions look identical everywhere in the admin.
 *
 * The typed-SKU step is deliberately conditional. Requiring it for every delete
 * would make clearing out old drafts tedious enough that people stop reading the
 * dialog at all; requiring it only for a product that is live or holds stock
 * puts the friction exactly where the mistake is expensive.
 */
export function DeleteProductModal({
  target,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteProductModalProps) {
  const [typed, setTyped] = useState('')

  const isOpen = Boolean(target)
  const isHighRisk = isHighRiskProductDelete(target)
  const canConfirm =
    !isDeleting && (!isHighRisk || skuConfirmationMatches(typed, target?.sku ?? ''))

  // Reset between targets, or the confirmation typed for one product would
  // still be sitting in the box for the next one.
  useEffect(() => {
    setTyped('')
  }, [target?.id])

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={isDeleting ? () => {} : onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 w-full min-w-0 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                      Delete product
                    </Dialog.Title>

                    {target && (
                      <div className="mt-2 space-y-3 text-sm text-gray-600">
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-left">
                          <p className="break-words font-medium text-gray-900">{target.title}</p>
                          {target.titleHe && target.titleHe !== target.title && (
                            <p className="break-words text-gray-500" dir="rtl">
                              {target.titleHe}
                            </p>
                          )}
                          <p className="mt-1 font-mono text-xs text-gray-500">{target.sku}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                                target.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {target.isActive ? 'Active on the site' : 'Inactive'}
                            </span>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${
                                target.stock > 0
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {target.stock} in stock
                            </span>
                            {target.colorVariantCount > 0 && (
                              <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 font-semibold text-gray-700">
                                {target.colorVariantCount}{' '}
                                {target.colorVariantCount === 1 ? 'colour' : 'colours'}
                              </span>
                            )}
                          </div>
                        </div>

                        {isHighRisk && (
                          <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-left text-amber-900">
                            {target.isActive && target.stock > 0
                              ? 'This product is live on the site and still has stock.'
                              : target.isActive
                                ? 'This product is currently live on the site.'
                                : 'This product still has stock recorded against it.'}{' '}
                            Consider setting it to inactive instead — that removes it from the
                            storefront without losing the record.
                          </p>
                        )}

                        <div className="text-left">
                          <p className="font-medium text-gray-900">What this does</p>
                          <ul className="mt-1 list-disc space-y-1 ps-5">
                            <li>
                              Removes the product, all of its colours and its stock from the
                              catalogue immediately. This cannot be undone.
                            </li>
                            <li>
                              Its images stay in storage, and the search index and reporting
                              database still hold it until{' '}
                              <Link
                                href="/admin/products/sync"
                                className="text-[#856D55] underline hover:text-[#95816C]"
                              >
                                Sync Products
                              </Link>{' '}
                              runs and clears them.
                            </li>
                            <li>
                              Past orders are not affected — each order keeps its own copy of the
                              name, price and image.
                            </li>
                          </ul>
                        </div>

                        {isHighRisk && (
                          <div className="text-left">
                            <label
                              htmlFor="delete-product-confirm"
                              className="block font-medium text-gray-900"
                            >
                              Type <span className="font-mono">{target.sku}</span> to confirm
                            </label>
                            <input
                              id="delete-product-confirm"
                              type="text"
                              value={typed}
                              onChange={(event) => setTyped(event.target.value)}
                              autoComplete="off"
                              disabled={isDeleting}
                              className="mt-1 block w-full rounded-md border border-[#B2A28E] bg-white px-3 py-2 font-mono text-sm text-black placeholder-[#B2A28E] focus:border-[#856D55] focus:outline-none focus:ring-1 focus:ring-[#856D55] disabled:opacity-50"
                            />
                          </div>
                        )}

                        {error && (
                          <p
                            role="alert"
                            className="rounded-md border border-red-300 bg-red-50 p-2 text-left text-red-700"
                          >
                            {error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 gap-3 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    disabled={!canConfirm}
                    onClick={onConfirm}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isDeleting ? 'Deleting…' : 'Delete permanently'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
