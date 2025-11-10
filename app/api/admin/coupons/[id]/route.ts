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

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  name_he: z.string().min(1).optional(),
  description_en: z.string().nullable().optional(),
  description_he: z.string().nullable().optional(),
  discountType: z.enum(discountTypeValues).optional(),
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
  bogoBuySkus: z.array(z.string()).optional(),
  bogoGetSkus: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
})

function normalizeCode(code?: string): string | undefined {
  if (!code) return undefined
  return code.trim().toUpperCase()
}

function sanitizeStringArray(values?: string[] | null): string[] | undefined {
  if (values === undefined || values === null) return undefined
  return values
    .map(value => value.trim())
    .filter(Boolean)
}

function parseDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: true,
        orderCoupons: {
          select: {
            discountAmount: true
          }
        }
      }
    })

    if (!coupon) {
      return NextResponse.json(
        { error: 'Coupon not found' },
        { status: 404 }
      )
    }

    const totalRedemptions = coupon.redemptions.reduce((total, redemption) => total + redemption.usageCount, 0)
    const totalDiscountGranted = coupon.orderCoupons.reduce((total, orderCoupon) => total + orderCoupon.discountAmount, 0)

    return NextResponse.json({
      coupon: {
        ...coupon,
        redemptions: undefined,
        orderCoupons: undefined
      },
      stats: {
        totalRedemptions,
        totalDiscountGranted
      }
    })
  } catch (error) {
    console.error('[ADMIN_COUPONS_GET_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to fetch coupon' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const payload = updateSchema.parse(body)

    const existingCoupon = await prisma.coupon.findUnique({
      where: { id }
    })

    if (!existingCoupon) {
      return NextResponse.json(
        { error: 'Coupon not found' },
        { status: 404 }
      )
    }

    const updatedCode = normalizeCode(payload.code)
    if (updatedCode && updatedCode !== existingCoupon.code) {
      const duplicate = await prisma.coupon.findUnique({
        where: { code: updatedCode }
      })

      if (duplicate) {
        return NextResponse.json(
          { error: 'Coupon code already exists' },
          { status: 409 }
        )
      }
    }

    const discountType = payload.discountType ?? existingCoupon.discountType
    if ((discountType === 'percent_all' || discountType === 'percent_specific' || discountType === 'fixed')) {
      const effectiveDiscountValue = payload.discountValue ?? existingCoupon.discountValue
      if (!effectiveDiscountValue || effectiveDiscountValue <= 0) {
        return NextResponse.json(
          { error: 'Discount value must be greater than zero for the selected discount type.' },
          { status: 400 }
        )
      }
    }

    if (discountType === 'bogo') {
      const effectiveBogoDiscount =
        payload.discountValue ?? existingCoupon.discountValue ?? 100
      if (effectiveBogoDiscount <= 0 || effectiveBogoDiscount > 100) {
        return NextResponse.json(
          { error: 'BOGO discount percentage must be between 0 and 100.' },
          { status: 400 }
        )
      }
    }

    const discountValueForUpdate =
      payload.discountValue !== undefined
        ? discountType === 'bogo'
          ? Math.min(Math.max(payload.discountValue ?? 100, 0), 100)
          : payload.discountValue
        : discountType === 'bogo' && existingCoupon.discountValue == null
          ? 100
          : undefined

    const updatedCoupon = await prisma.coupon.update({
      where: { id },
      data: {
        code: updatedCode,
        name_en: payload.name_en,
        name_he: payload.name_he,
        description_en: payload.description_en,
        description_he: payload.description_he,
        discountType: payload.discountType,
        discountValue: discountValueForUpdate,
        minCartValue: payload.minCartValue,
        startDate: parseDate(payload.startDate),
        endDate: parseDate(payload.endDate),
        usageLimit: payload.usageLimit,
        usageLimitPerUser: payload.usageLimitPerUser,
        stackable: payload.stackable,
        autoApply: payload.autoApply,
        eligibleProducts: sanitizeStringArray(payload.eligibleProducts),
        eligibleCategories: sanitizeStringArray(payload.eligibleCategories),
        bogoBuyQuantity: payload.bogoBuyQuantity ?? undefined,
        bogoGetQuantity: payload.bogoGetQuantity ?? undefined,
        bogoEligibleSkus: sanitizeStringArray(payload.bogoEligibleSkus),
        bogoBuySkus: sanitizeStringArray(payload.bogoBuySkus),
        bogoGetSkus: sanitizeStringArray(payload.bogoGetSkus),
        isActive: payload.isActive
      } as any
    })

    return NextResponse.json(updatedCoupon)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      )
    }

    console.error('[ADMIN_COUPONS_UPDATE_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to update coupon' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    await prisma.orderCoupon.deleteMany({
      where: { couponId: id }
    })

    await prisma.couponRedemption.deleteMany({
      where: { couponId: id }
    })

    await prisma.coupon.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_COUPONS_DELETE_ERROR]', error)
    return NextResponse.json(
      { error: 'Failed to delete coupon' },
      { status: 500 }
    )
  }
}

