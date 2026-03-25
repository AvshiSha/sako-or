'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '@/app/components/ProtectedRoute'
import { useAuth } from '@/app/contexts/AuthContext'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline'

type ManualFormState = {
  orderNumber: string
  user: { ChainID: string; Username: string; Password: string }
  invoice: {
    DocNo: string
    DocType: string
    StoreNo: string
    CustomerNo: string
    CustomerName: string
    CreateDate: string
    SupplyStoreNo: string
    CurrencyID: string
    CurrencyRate: string
    PriceList: string
    NotebookID: string
    Published: string
    TotalBeforeDiscount_WithoutVAT: string
    Discount: string
    DiscountPercent: string
    TotalAfterDiscount_WithoutVAT: string
    VatPercent: string
    VAT: string
    TotalPriceIncludeVAT: string
    TotalItems: string
    TotalLines: string
  }
  documentLines: Array<{
    LineNo: string
    ItemID: string
    UnitPrice: string
    Qty: string
    DiscountPercent: string
    TotalPrice: string
    VatPercent: string
    CreditPointsAccumPrecent: string
  }>
  receipt: {
    ReceiptNo: string
    StoreNo: string
    CustomerNo: string
    CustomerName: string
    CreateDate: string
    CurrencyID: string
    CurrencyRate: string
    RecieptTotal: string
    receiptLines: {
      Sum: string
      paymentType: string
      creditCard: {
        PaymentType: string
        FirstPayment: string
        OtherPayments: string
        CreditCardNo: string
        ExpireDate: string
        CreditCardType: string
        CustomerIdentity: string
        ClearanceApproval: string
        NumberOfPayments: string
      }
    }
  }
}

function todayYYYYMMDD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password' | 'number'
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  )
}

function ManualVerifoneInvoicePageInner() {
  const router = useRouter()
  const { user } = useAuth()

  const [form, setForm] = useState<ManualFormState>(() => ({
    orderNumber: '',
    user: { ChainID: '', Username: '', Password: '' },
    invoice: {
      DocNo: '0',
      DocType: '1',
      StoreNo: '98',
      CustomerNo: '',
      CustomerName: '',
      CreateDate: todayYYYYMMDD(),
      SupplyStoreNo: '13',
      CurrencyID: '1',
      CurrencyRate: '1',
      PriceList: '1',
      NotebookID: '2',
      Published: 'true',
      TotalBeforeDiscount_WithoutVAT: '',
      Discount: '0',
      DiscountPercent: '0',
      TotalAfterDiscount_WithoutVAT: '',
      VatPercent: '18',
      VAT: '',
      TotalPriceIncludeVAT: '',
      TotalItems: '',
      TotalLines: ''
    },
    documentLines: [
      {
        LineNo: '1',
        ItemID: '',
        UnitPrice: '',
        Qty: '1',
        DiscountPercent: '0',
        TotalPrice: '',
        VatPercent: '18',
        CreditPointsAccumPrecent: '5'
      }
    ],
    receipt: {
      ReceiptNo: '0',
      StoreNo: '98',
      CustomerNo: '',
      CustomerName: '',
      CreateDate: todayYYYYMMDD(),
      CurrencyID: '1',
      CurrencyRate: '1',
      RecieptTotal: '',
      receiptLines: {
        Sum: '',
        paymentType: 'CreditCard',
        creditCard: {
          PaymentType: '3',
          FirstPayment: '',
          OtherPayments: '0',
          CreditCardNo: '0000',
          ExpireDate: '0000',
          CreditCardType: '9',
          CustomerIdentity: '123456789',
          ClearanceApproval: '',
          NumberOfPayments: '1'
        }
      }
    }
  }))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any | null>(null)

  const requiredErrors = useMemo(() => {
    const errs: string[] = []
    if (!form.user.ChainID.trim()) errs.push('ChainID is required')
    if (!form.user.Username.trim()) errs.push('Username is required')
    if (!form.user.Password.trim()) errs.push('Password is required')

    if (!form.invoice.CustomerNo.trim()) errs.push('Invoice.CustomerNo is required')
    if (!form.invoice.CustomerName.trim()) errs.push('Invoice.CustomerName is required')
    if (!/^\d{8}$/.test(form.invoice.CreateDate.trim()))
      errs.push('Invoice.CreateDate must be YYYYMMDD')

    if (form.documentLines.length === 0) errs.push('At least one DocumentLine is required')
    form.documentLines.forEach((l, idx) => {
      if (!l.ItemID.trim()) errs.push(`DocumentLines[${idx}].ItemID is required`)
      if (!l.UnitPrice.trim()) errs.push(`DocumentLines[${idx}].UnitPrice is required`)
      if (!l.TotalPrice.trim()) errs.push(`DocumentLines[${idx}].TotalPrice is required`)
    })

    if (!form.receipt.CustomerNo.trim()) errs.push('Receipt.CustomerNo is required')
    if (!form.receipt.CustomerName.trim()) errs.push('Receipt.CustomerName is required')
    if (!/^\d{8}$/.test(form.receipt.CreateDate.trim()))
      errs.push('Receipt.CreateDate must be YYYYMMDD')
    if (!form.receipt.RecieptTotal.trim()) errs.push('Receipt.RecieptTotal is required')

    if (!form.receipt.receiptLines.Sum.trim()) errs.push('ReceiptLines.Sum is required')
    if (!form.receipt.receiptLines.creditCard.FirstPayment.trim())
      errs.push('CreditCard.FirstPayment is required')

    return errs
  }, [form])

  const addLine = () => {
    setForm((prev) => {
      const nextNo = String(prev.documentLines.length + 1)
      return {
        ...prev,
        documentLines: [
          ...prev.documentLines,
          {
            LineNo: nextNo,
            ItemID: '',
            UnitPrice: '',
            Qty: '1',
            DiscountPercent: '0',
            TotalPrice: '',
            VatPercent: '18',
            CreditPointsAccumPrecent: '5'
          }
        ]
      }
    })
  }

  const removeLine = (index: number) => {
    setForm((prev) => {
      const next = prev.documentLines.filter((_, i) => i !== index)
      // Re-number LineNo to keep it simple
      const renumbered = next.map((l, i) => ({ ...l, LineNo: String(i + 1) }))
      return { ...prev, documentLines: renumbered }
    })
  }

  const submit = async () => {
    setError(null)
    setResult(null)

    if (requiredErrors.length) {
      setError(requiredErrors.join('\n'))
      return
    }

    if (!user) {
      setError('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const token = await user.getIdToken()
      const response = await fetch('/api/admin/verifone/manual-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          orderNumber: form.orderNumber.trim() || undefined,
          user: form.user,
          invoice: form.invoice,
          documentLines: form.documentLines,
          receipt: form.receipt
        })
      })

      const data = await response.json().catch(() => ({}))
      setResult({ httpOk: response.ok, httpStatus: response.status, data })

      if (!response.ok) {
        setError(data?.error || `HTTP ${response.status}`)
      }
    } catch (e: any) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const status = result?.data?.success === true ? 'success' : result ? 'failed' : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Manual Verifone Invoice Creation
                </h1>
                <p className="mt-1 text-sm text-gray-700">
                  Recovery tool for resending `CreateInvoice` to Verifone (Admin-only)
                </p>
              </div>
            </div>
            <button
              onClick={submit}
              disabled={loading}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit to Verifone'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="whitespace-pre-wrap bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div
            className={`border rounded-lg p-4 ${
              status === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            <div className="flex items-start">
              <div className="mr-3 mt-0.5">
                {status === 'success' ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-500" />
                ) : (
                  <ExclamationCircleIcon className="h-6 w-6 text-yellow-600" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-800">
                  <div>
                    <span className="font-medium">Audit ID:</span>{' '}
                    <span className="font-mono">{String(result.data?.auditId ?? '-')}</span>
                  </div>
                  <div>
                    <span className="font-medium">HTTP:</span>{' '}
                    <span className="font-mono">{String(result.httpStatus)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Verifone status:</span>{' '}
                    <span className="font-mono">
                      {String(result.data?.parsedResult?.status ?? '-')}
                    </span>
                  </div>
                </div>
                {result.data?.parsedResult?.statusDescription && (
                  <div className="mt-2 text-sm text-gray-700">
                    <span className="font-medium">Message:</span>{' '}
                    {String(result.data.parsedResult.statusDescription)}
                  </div>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-900">
                    Raw Verifone response XML
                  </summary>
                  <textarea
                    readOnly
                    className="mt-2 w-full h-56 font-mono text-xs rounded-md border border-gray-300 p-3 bg-white text-gray-900"
                    value={String(result.data?.rawResponseXml ?? '')}
                  />
                </details>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-gray-900">
                    Parsed response (JSON)
                  </summary>
                  <textarea
                    readOnly
                    className="mt-2 w-full h-40 font-mono text-xs rounded-md border border-gray-300 p-3 bg-white text-gray-900"
                    value={JSON.stringify(result.data?.parsedResult ?? null, null, 2)}
                  />
                </details>
              </div>
            </div>
          </div>
        )}

        <Section title="Context (optional)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Order Number (for linking/audit only)"
              value={form.orderNumber}
              onChange={(v) => setForm((p) => ({ ...p, orderNumber: v }))}
              placeholder="e.g. 10001234"
            />
          </div>
        </Section>

        <Section title="User/Auth (sent to Verifone)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TextField
              label="ChainID"
              value={form.user.ChainID}
              onChange={(v) => setForm((p) => ({ ...p, user: { ...p.user, ChainID: v } }))}
              placeholder="e.g. 1494"
            />
            <TextField
              label="Username"
              value={form.user.Username}
              onChange={(v) => setForm((p) => ({ ...p, user: { ...p.user, Username: v } }))}
              placeholder="e.g. BO_1494"
            />
            <TextField
              label="Password"
              type="password"
              value={form.user.Password}
              onChange={(v) => setForm((p) => ({ ...p, user: { ...p.user, Password: v } }))}
              placeholder="Verifone password"
            />
          </div>
          <p className="mt-3 text-xs text-gray-700">
            Password is used to send the request but is not stored in the audit record.
          </p>
        </Section>

        <Section title="Invoice">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextField label="DocNo" value={form.invoice.DocNo} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, DocNo: v } }))} />
            <TextField label="DocType" value={form.invoice.DocType} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, DocType: v } }))} />
            <TextField label="StoreNo" value={form.invoice.StoreNo} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, StoreNo: v } }))} />
            <TextField label="SupplyStoreNo" value={form.invoice.SupplyStoreNo} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, SupplyStoreNo: v } }))} />

            <TextField label="CustomerNo" value={form.invoice.CustomerNo} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, CustomerNo: v }, receipt: { ...p.receipt, CustomerNo: v } }))} />
            <TextField label="CustomerName" value={form.invoice.CustomerName} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, CustomerName: v }, receipt: { ...p.receipt, CustomerName: v } }))} />
            <TextField
              label="CreateDate (YYYYMMDD)"
              value={form.invoice.CreateDate}
              onChange={(v) =>
                setForm((p) => ({
                  ...p,
                  invoice: { ...p.invoice, CreateDate: v },
                  receipt: { ...p.receipt, CreateDate: v }
                }))
              }
            />

            <TextField label="CurrencyID" value={form.invoice.CurrencyID} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, CurrencyID: v }, receipt: { ...p.receipt, CurrencyID: v } }))} />
            <TextField label="CurrencyRate" value={form.invoice.CurrencyRate} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, CurrencyRate: v }, receipt: { ...p.receipt, CurrencyRate: v } }))} />
            <TextField label="PriceList" value={form.invoice.PriceList} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, PriceList: v } }))} />
            <TextField label="NotebookID" value={form.invoice.NotebookID} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, NotebookID: v } }))} />
            <TextField label="Published" value={form.invoice.Published} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, Published: v } }))} />

            <TextField label="TotalBeforeDiscount_WithoutVAT" value={form.invoice.TotalBeforeDiscount_WithoutVAT} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, TotalBeforeDiscount_WithoutVAT: v } }))} />
            <TextField label="Discount" value={form.invoice.Discount} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, Discount: v } }))} />
            <TextField label="DiscountPercent" value={form.invoice.DiscountPercent} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, DiscountPercent: v } }))} />
            <TextField label="TotalAfterDiscount_WithoutVAT" value={form.invoice.TotalAfterDiscount_WithoutVAT} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, TotalAfterDiscount_WithoutVAT: v } }))} />
            <TextField label="VatPercent" value={form.invoice.VatPercent} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, VatPercent: v } }))} />
            <TextField label="VAT" value={form.invoice.VAT} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, VAT: v } }))} />
            <TextField
              label="TotalPriceIncludeVAT"
              value={form.invoice.TotalPriceIncludeVAT}
              onChange={(v) =>
                setForm((p) => ({
                  ...p,
                  invoice: { ...p.invoice, TotalPriceIncludeVAT: v },
                  receipt: {
                    ...p.receipt,
                    RecieptTotal: v,
                    receiptLines: {
                      ...p.receipt.receiptLines,
                      Sum: v,
                      creditCard: { ...p.receipt.receiptLines.creditCard, FirstPayment: v }
                    }
                  }
                }))
              }
            />
            <TextField label="TotalItems" value={form.invoice.TotalItems} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, TotalItems: v } }))} />
            <TextField label="TotalLines" value={form.invoice.TotalLines} onChange={(v) => setForm((p) => ({ ...p, invoice: { ...p.invoice, TotalLines: v } }))} />
          </div>
        </Section>

        <Section title="Invoice Lines (DocumentLines)">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-800">
              Add one line per item. Line numbers are auto-renumbered.
            </p>
            <button
              onClick={addLine}
              className="inline-flex items-center rounded-md bg-white border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add line
            </button>
          </div>

          <div className="space-y-4">
            {form.documentLines.map((line, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <div className="text-sm font-medium text-gray-900">
                    Line #{line.LineNo}
                  </div>
                  {form.documentLines.length > 1 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="inline-flex items-center text-sm text-red-600 hover:text-red-700"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <TextField
                    label="ItemID"
                    value={line.ItemID}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, ItemID: v } : l
                        )
                      }))
                    }
                    placeholder="e.g. 4922-53940137"
                  />
                  <TextField
                    label="UnitPrice"
                    value={line.UnitPrice}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, UnitPrice: v } : l
                        )
                      }))
                    }
                  />
                  <TextField
                    label="Qty"
                    value={line.Qty}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, Qty: v } : l
                        )
                      }))
                    }
                  />
                  <TextField
                    label="TotalPrice"
                    value={line.TotalPrice}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, TotalPrice: v } : l
                        )
                      }))
                    }
                  />
                  <TextField
                    label="DiscountPercent"
                    value={line.DiscountPercent}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, DiscountPercent: v } : l
                        )
                      }))
                    }
                  />
                  <TextField
                    label="VatPercent"
                    value={line.VatPercent}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, VatPercent: v } : l
                        )
                      }))
                    }
                  />
                  <TextField
                    label="CreditPointsAccumPrecent"
                    value={line.CreditPointsAccumPrecent}
                    onChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        documentLines: p.documentLines.map((l, i) =>
                          i === idx ? { ...l, CreditPointsAccumPrecent: v } : l
                        )
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Receipt + ReceiptLines + CreditCard">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextField label="ReceiptNo" value={form.receipt.ReceiptNo} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, ReceiptNo: v } }))} />
            <TextField label="StoreNo" value={form.receipt.StoreNo} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, StoreNo: v } }))} />
            <TextField label="RecieptTotal" value={form.receipt.RecieptTotal} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, RecieptTotal: v } }))} />
            <TextField label="ReceiptLines.Sum" value={form.receipt.receiptLines.Sum} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, Sum: v } } }))} />
            <TextField label="ReceiptLines.paymentType" value={form.receipt.receiptLines.paymentType} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, paymentType: v } } }))} />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <TextField label="CreditCard.PaymentType" value={form.receipt.receiptLines.creditCard.PaymentType} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, PaymentType: v } } } }))} />
            <TextField label="CreditCard.FirstPayment" value={form.receipt.receiptLines.creditCard.FirstPayment} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, FirstPayment: v } } } }))} />
            <TextField label="CreditCard.OtherPayments" value={form.receipt.receiptLines.creditCard.OtherPayments} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, OtherPayments: v } } } }))} />
            <TextField label="CreditCard.CreditCardNo" value={form.receipt.receiptLines.creditCard.CreditCardNo} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, CreditCardNo: v } } } }))} />
            <TextField label="CreditCard.ExpireDate" value={form.receipt.receiptLines.creditCard.ExpireDate} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, ExpireDate: v } } } }))} />
            <TextField label="CreditCard.CreditCardType" value={form.receipt.receiptLines.creditCard.CreditCardType} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, CreditCardType: v } } } }))} />
            <TextField label="CreditCard.CustomerIdentity" value={form.receipt.receiptLines.creditCard.CustomerIdentity} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, CustomerIdentity: v } } } }))} />
            <TextField label="CreditCard.ClearanceApproval" value={form.receipt.receiptLines.creditCard.ClearanceApproval} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, ClearanceApproval: v } } } }))} />
            <TextField label="CreditCard.NumberOfPayments" value={form.receipt.receiptLines.creditCard.NumberOfPayments} onChange={(v) => setForm((p) => ({ ...p, receipt: { ...p.receipt, receiptLines: { ...p.receipt.receiptLines, creditCard: { ...p.receipt.receiptLines.creditCard, NumberOfPayments: v } } } }))} />
          </div>
        </Section>
      </div>
    </div>
  )
}

export default function ManualVerifoneInvoicePage() {
  return (
    <ProtectedRoute requireAdmin={true}>
      <ManualVerifoneInvoicePageInner />
    </ProtectedRoute>
  )
}

