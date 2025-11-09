import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CouponDiscountType } from '@prisma/client'
import { z } from 'zod'

const discountTypeValues: [CouponDiscountType, CouponDiscountType, CouponDiscountType, CouponDiscountType] = [
  'percent_all',
  'percent_specific',
  'fixed',
  'bogo'
]

const couponFieldsSchema = z.object({
  code: z.string().min(1),
  name_en: z.string().min(1),
  name_he: z.string().min(1),
  description_en: z.string().optional().nullable(),
  description_he: z.string().optional().nullable(),
  discountType: z.enum(discountTypeValues),
  discountValue: z.number().nonnegative().nullable().optional(),
  minCartValue: z.number().nonnegative().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  usageLimit: z.number().int().nonnegative().nullable().optional(),
  usageLimitPerUser: z.number().int().nonnegative().nullable().optional(),
  stackable: z.boolean().optional(),
  autoApply: z.boolean().optional(),
  eligibleProducts: z.array(z.string()).optional(),
  eligibleCategories: z.array(z.string()).optional(),
  bogoBuyQuantity: z.number().int().min(1).nullable().optional(),
  bogoGetQuantity: z.number().int().min(1).nullable().optional(),
  bogoEligibleSkus: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
})

const createCouponSchema = couponFieldsSchema.superRefine((data, ctx) => {
  if (data.discountType === 'percent_all' || data.discountType === 'percent_specific' || data.discountType === 'fixed') {
    if (typeof data.discountValue !== 'number' || data.discountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Discount value is required for percentage and fixed coupons.'
      })
    }
  }
})

const updateCouponSchema = couponFieldsSchema.partial().superRefine((data, ctx) => {
  const discountType = data.discountType
  const discountValue = data.discountValue

  if (discountType === 'percent_all' || discountType === 'percent_specific' || discountType === 'fixed') {
    if (typeof discountValue !== 'number' || discountValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Discount value must be greater than zero when updating percentage or fixed coupons.'
      })
    }
  }

  if (!discountType && discountValue !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['discountType'],
      message: 'Provide a discount type when updating discount value.'
    })
  }
})

function sanitizeStringArray(values?: string[] | null): string[] {
  if (!values) return []
  return values
    .map(value => value.trim())
    .filter(Boolean)
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100)
    const skip = (page - 1) * limit

    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const autoApply = searchParams.get('autoApply')
    const expiresBefore = searchParams.get('expiresBefore')
    const expiresAfter = searchParams.get('expiresAfter')

    const whereClause: any = {}

    if (status === 'active') {
      whereClause.isActive = true
    } else if (status === 'inactive') {
      whereClause.isActive = false
    }

    if (type && discountTypeValues.includes(type as CouponDiscountType)) {
      whereClause.discountType = type as CouponDiscountType
    }

    if (autoApply === 'true') {
      whereClause.autoApply = true
    } else if (autoApply === 'false') {
      whereClause.autoApply = false
    }

    if (expiresBefore) {
      const parsed = parseDate(expiresBefore)
      if (parsed) {
        whereClause.endDate = { lt: parsed }
      }
    }

    if (expiresAfter) {
      const parsed = parseDate(expiresAfter)
      if (parsed) {
        whereClause.endDate = { ...(whereClause.endDate ?? {}), gt: parsed }
      }
    }

    if (search) {
      whereClause.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name_en: { contains: search, mode: 'insensitive' } },
        { name_he: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.coupon.count({ where: whereClause })
    ])

    const now = new Date()
    const expiredCouponIds = coupons
      .filter(coupon => coupon.isActive && coupon.endDate && coupon.endDate < now)
      .map(coupon => coupon.id)

    if (expiredCouponIds.length > 0) {
      await prisma.coupon.updateMany({
        where: { id: { in: expiredCouponIds } },
        data: { isActive: false }
      })

      for (const coupon of coupons) {
        if (expiredCouponIds.includes(coupon.id)) {
          coupon.isActive = false
        }
      }
    }

    return NextResponse.json({
      data: coupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[ADMIN_COUPONS_LIST_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupons' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = createCouponSchema.parse(body)

    const code = normalizeCode(payload.code)

    const existing = await prisma.coupon.findUnique({
      where: { code }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Coupon code already exists' },
        { status: 409 }
      )
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        name_en: payload.name_en,
        name_he: payload.name_he,
        description_en: payload.description_en ?? null,
        description_he: payload.description_he ?? null,
        discountType: payload.discountType,
        discountValue: payload.discountValue ?? null,
        minCartValue: payload.minCartValue ?? null,
        startDate: parseDate(payload.startDate),
        endDate: parseDate(payload.endDate),
        usageLimit: payload.usageLimit ?? null,
        usageLimitPerUser: payload.usageLimitPerUser ?? null,
        stackable: payload.stackable ?? false,
        autoApply: payload.autoApply ?? false,
        eligibleProducts: sanitizeStringArray(payload.eligibleProducts),
        eligibleCategories: sanitizeStringArray(payload.eligibleCategories),
        bogoBuyQuantity: payload.bogoBuyQuantity ?? 1,
        bogoGetQuantity: payload.bogoGetQuantity ?? 1,
        bogoEligibleSkus: sanitizeStringArray(payload.bogoEligibleSkus),
        isActive: payload.isActive ?? true
      }
    })

    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      )
    }

    console.error('[ADMIN_COUPONS_CREATE_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to create coupon' },
      { status: 500 }
    )
  }
}

