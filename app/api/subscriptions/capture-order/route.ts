import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import poolDS1 from '@/lib/dbDS1';

const subscriptionTiers: { [key: number]: { name: string; qiBoostPercent: number; pricePerMonth: number } } = {
  1: { name: 'Cultivator', qiBoostPercent: 100, pricePerMonth: 5 },
  2: { name: 'Dao Seeker', qiBoostPercent: 200, pricePerMonth: 10 },
  3: { name: 'Immortal', qiBoostPercent: 400, pricePerMonth: 15 },
  4: { name: 'Divine', qiBoostPercent: 800, pricePerMonth: 22 }
};

function getPool(server: string) {
  return server === 'DS1' ? poolDS1 : pool;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, discordId: codeAuthDiscordId, server } = body;
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!token) {
      return NextResponse.json({ error: 'Payment token required' }, { status: 400 });
    }

    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
    const paypalBaseUrl = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    if (!paypalClientId || !paypalSecret) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 500 });
    }

    const auth = Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64');
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
    }

    const { access_token } = await tokenResponse.json();

    const captureResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      if (captureData.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
        return NextResponse.json({ error: 'This order has already been processed' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 });
    }

    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
    }

    const customId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id;
    if (!customId || !customId.startsWith('subscription:')) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    const [, tierIdStr, monthsStr, orderUserId, orderServer] = customId.split(':');
    const tierId = parseInt(tierIdStr);
    const months = parseInt(monthsStr);
    
    if (orderUserId !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    const tier = subscriptionTiers[tierId];
    if (!tier) {
      return NextResponse.json({ error: 'Invalid subscription tier' }, { status: 400 });
    }

    const captureAmount = parseFloat(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || '0');
    const paymentId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;

    const dbPool = getPool(orderServer || server || 'S0');

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const [existingSubs] = await dbPool.execute(
      `SELECT id, expires_at FROM player_subscriptions 
       WHERE user_id = ? AND is_active = TRUE AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );

    const existingSubsArray = existingSubs as any[];
    
    if (existingSubsArray.length > 0) {
      const currentExpiry = new Date(existingSubsArray[0].expires_at);
      expiresAt.setTime(currentExpiry.getTime());
      expiresAt.setMonth(expiresAt.getMonth() + months);
      
      await dbPool.execute(
        `UPDATE player_subscriptions SET is_active = FALSE WHERE user_id = ? AND is_active = TRUE`,
        [userId]
      );
    }

    await dbPool.execute(
      `INSERT INTO player_subscriptions 
       (user_id, tier, tier_name, qi_boost_percent, duration_months, price_paid, payment_id, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [userId, tierId, tier.name, tier.qiBoostPercent, months, captureAmount, paymentId, expiresAt]
    );

    console.log(`[SUBSCRIPTION] Activated ${tier.name} for user ${userId} until ${expiresAt.toISOString()}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        tierName: tier.name,
        qiBoostPercent: tier.qiBoostPercent,
        months: months,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error capturing subscription order:', error);
    return NextResponse.json(
      { error: 'Failed to process subscription' },
      { status: 500 }
    );
  }
}
