'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { CategoryMutationError } from '@/lib/admin/category-client'

export interface DeleteCategoryTarget {
  id: string
  label: string
}

interface DeleteCategoryModalProps {
  target: DeleteCategoryTarget | null
  blockInfo: CategoryMutationError | null
  isDeleting: boolean
  onClose: () => void
  onConfirm: (options: { cascade: boolean }) => void
}

function childName(child: { name?: { en?: string; he?: string } | string }): string {
  if (typeof child.name === 'string') return child.name
  return child.name?.en || child.name?.he || 'Unnamed category'
}

export function DeleteCategoryModal({
  target,
  blockInfo,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteCategoryModalProps) {
  const isOpen = Boolean(target)
  const blockedByProducts = blockInfo?.code === 'HAS_PRODUCTS'
  const blockedByChildren = blockInfo?.code === 'HAS_CHILDREN'

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
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <Dialog.Title as="h3" className="text-lg font-medium text-gray-900">
                      Delete category
                    </Dialog.Title>

                    {!blockInfo && target && (
                      <p className="mt-2 text-sm text-gray-600">
                        Are you sure you want to delete <span className="font-medium text-gray-900">{target.label}</span>?
                        This cannot be undone.
                      </p>
                    )}

                    {blockedByProducts && (
                      <div className="mt-2 space-y-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium text-gray-900">{target?.label}</span> cannot be deleted because{' '}
                          <span className="font-medium text-red-700">{blockInfo?.productCount}</span>{' '}
                          {blockInfo?.productCount === 1 ? 'product references' : 'products reference'} it or one of
                          its sub-categories.
                        </p>
                        <p>Reassign or remove those products from this category first, then try again.</p>
                      </div>
                    )}

                    {blockedByChildren && (
                      <div className="mt-2 space-y-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium text-gray-900">{target?.label}</span> still has{' '}
                          <span className="font-medium text-amber-700">{blockInfo?.childCount}</span>{' '}
                          {blockInfo?.childCount === 1 ? 'sub-category' : 'sub-categories'}:
                        </p>
                        <ul className="max-h-32 overflow-y-auto list-disc list-inside rounded-md border border-gray-200 bg-gray-50 p-2">
                          {blockInfo?.children?.map((child) => (
                            <li key={child.id}>{childName(child)}</li>
                          ))}
                        </ul>
                        <p>
                          Deleting will permanently remove <span className="font-medium">all</span> of the above along
                          with the category itself. This cannot be undone.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  {blockedByProducts ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto"
                    >
                      Close
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => onConfirm({ cascade: blockedByChildren })}
                        className="inline-flex w-full justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 sm:w-auto"
                      >
                        {isDeleting ? 'Deleting…' : blockedByChildren ? 'Delete category and sub-categories' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={onClose}
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 sm:mt-0 sm:w-auto"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
