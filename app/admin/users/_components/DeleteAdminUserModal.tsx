'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { adminTheme } from '@/app/admin/_components/adminTheme'

interface DeleteAdminUserModalProps {
  isOpen: boolean
  email: string | null
  isDeleting: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteAdminUserModal({
  isOpen,
  email,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteAdminUserModalProps) {
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
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium text-black">
                      Revoke admin access
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-[#856D55]">
                        Are you sure you want to revoke admin access for{' '}
                        <span className="font-medium text-black">{email}</span>? They will no
                        longer be able to sign in to the admin panel. Their customer account and
                        Firebase login will remain unchanged.
                      </p>
                    </div>
                    {error && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                        {error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onConfirm}
                    className="inline-flex w-full justify-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 sm:w-auto"
                  >
                    {isDeleting ? 'Revoking...' : 'Revoke admin access'}
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={onClose}
                    className={`${adminTheme.buttonSecondary} mt-3 w-full sm:mt-0 sm:w-auto`}
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
