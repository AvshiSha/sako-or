'use client'

import React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  isRTL?: boolean
  isLoading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isRTL = false,
  isLoading = false
}: ConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-surface-primary rounded-lg shadow-xl max-w-md w-full ${
            isRTL ? 'text-right' : 'text-left'
          }`}
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border-subtle">
            <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
            <button
              onClick={onCancel}
              className="text-sako-gray-500 hover:text-text-primary transition-colors"
              disabled={isLoading}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-sm text-text-secondary">{message}</p>
          </div>

          {/* Footer */}
          <div
            className={`flex gap-3 p-6 border-t border-border-subtle ${
              isRTL ? 'flex-row-reverse' : ''
            }`}
          >
            <button
              onClick={onCancel}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm font-medium text-btn-secondary-text bg-btn-secondary-bg border border-border-default rounded-md hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isRTL ? 'order-2' : ''
              }`}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm font-medium text-text-inverse bg-surface-dark rounded-md hover:bg-sako-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isRTL ? 'order-1' : ''
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-text-inverse"></span>
                  {confirmLabel}
                </span>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
