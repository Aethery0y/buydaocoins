import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code, amount } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Coupon code required' }, { status: 400 });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid purchase amount required' }, { status: 400 });
    }

    const couponCode = code.trim().toUpperCase();

    const [coupons] = await db.execute<RowDataPacket[]>(
      `SELECT * FROM dao_coupons 
       WHERE code = ? AND active = TRUE 
       AND valid_from <= NOW() 
       AND valid_until >= NOW()
       LIMIT 1`,
      [couponCode]
    );

    if (coupons.length === 0) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid or expired coupon code' 
      }, { status: 200 });
    }

    const coupon = coupons[0];

    if (amount < coupon.min_purchase_amount) {
      return NextResponse.json({ 
        valid: false, 
        error: `Minimum purchase of $${coupon.min_purchase_amount} required for this coupon` 
      }, { status: 200 });
    }

    if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
      return NextResponse.json({ 
        valid: false, 
        error: 'This coupon has reached its usage limit' 
      }, { status: 200 });
    }

    const validUntil = new Date(coupon.valid_until);
    const timeRemaining = validUntil.getTime() - Date.now();
    const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60));

    return NextResponse.json({
      valid: true,
      code: coupon.code,
      bonusPercentage: coupon.bonus_percentage,
      minPurchase: coupon.min_purchase_amount,
      timeRemaining: {
        days: daysRemaining,
        hours: hoursRemaining,
        validUntil: coupon.valid_until
      }
    });

  } catch (error) {
    console.error('Error validating coupon:', error);
    return NextResponse.json(
      { error: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}
