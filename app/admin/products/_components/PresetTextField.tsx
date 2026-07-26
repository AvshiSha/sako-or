'use client'

import { useState } from 'react'
import type { TextPreset } from '@/lib/product-text-presets'

const CUSTOM_PRESET_ID = 'custom'

interface PresetTextFieldProps {
  idPrefix: string
  labelEn: string
  labelHe: string
  valueEn: string
  valueHe: string
  onChangeEn: (value: string) => void
  onChangeHe: (value: string) => void
  presets: TextPreset[]
  placeholderEn?: string
  placeholderHe?: string
  rows?: number
}

const fieldClass =
  'mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 text-gray-700'

function findMatchingPreset(presets: TextPreset[], valueEn: string, valueHe: string): TextPreset | undefined {
  return presets.find((preset) => preset.text_en === valueEn && preset.text_he === valueHe)
}

/**
 * A dropdown of predefined Hebrew/English text pairs (care instructions, sizing
 * recommendations, ...) that fills both language fields at once, plus a "Custom"
 * option for free text. Both fields stay editable after a preset is applied.
 * Switching presets only prompts for confirmation when it would discard text the
 * admin actually typed (anything that isn't empty and isn't an untouched preset).
 */
export default function PresetTextField({
  idPrefix,
  labelEn,
  labelHe,
  valueEn,
  valueHe,
  onChangeEn,
  onChangeHe,
  presets,
  placeholderEn,
  placeholderHe,
  rows = 3,
}: PresetTextFieldProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    const match = findMatchingPreset(presets, valueEn, valueHe)
    return match ? match.id : CUSTOM_PRESET_ID
  })

  const applySelection = (nextPresetId: string) => {
    if (nextPresetId === selectedPresetId) return

    const isCurrentContentSafeToReplace =
      (valueEn.trim() === '' && valueHe.trim() === '') || Boolean(findMatchingPreset(presets, valueEn, valueHe))

    if (!isCurrentContentSafeToReplace) {
      const confirmed = confirm('This will replace the current text in both languages. Continue?')
      if (!confirmed) return
    }

    setSelectedPresetId(nextPresetId)
    if (nextPresetId === CUSTOM_PRESET_ID) {
      onChangeEn('')
      onChangeHe('')
      return
    }
    const preset = presets.find((p) => p.id === nextPresetId)
    if (!preset) return
    onChangeEn(preset.text_en)
    onChangeHe(preset.text_he)
  }

  return (
    <div className="sm:col-span-2 space-y-3">
      <div>
        <label htmlFor={`${idPrefix}_preset`} className="block text-sm font-medium text-gray-700">
          {labelEn} / {labelHe}
        </label>
        <select
          id={`${idPrefix}_preset`}
          value={selectedPresetId}
          onChange={(e) => applySelection(e.target.value)}
          className={fieldClass}
        >
          <option value={CUSTOM_PRESET_ID}>Custom</option>
          {presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label_en} / {preset.label_he}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}_en`} className="block text-sm font-medium text-gray-700">
            {labelEn} (English)
          </label>
          <textarea
            id={`${idPrefix}_en`}
            dir="ltr"
            rows={rows}
            value={valueEn}
            onChange={(e) => onChangeEn(e.target.value)}
            className={fieldClass}
            placeholder={placeholderEn}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}_he`} className="block text-sm font-medium text-gray-700">
            {labelHe} (Hebrew)
          </label>
          <textarea
            id={`${idPrefix}_he`}
            dir="rtl"
            rows={rows}
            value={valueHe}
            onChange={(e) => onChangeHe(e.target.value)}
            className={fieldClass}
            placeholder={placeholderHe}
          />
        </div>
      </div>
    </div>
  )
}
