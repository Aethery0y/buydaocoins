import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import poolDS1 from '@/lib/dbDS1';
import type { RowDataPacket } from 'mysql2';

const subscriptionTiers: { [key: number]: { name: string; qiBoostPercent: number; pricePerMonth: number } } = {
  1: { name: 'Cultivator', qiBoostPercent: 100, pricePerMonth: 5 },
  2: { name: 'Dao Seeker', qiBoostPercent: 200, pricePerMonth: 10 },
  3: { name: 'Immortal', qiBoostPercent: 400, pricePerMonth: 15 },
  4: { name: 'Divine', qiBoostPercent: 800, pricePerMonth: 22 }
};

const durationDiscounts: { [key: number]: number } = {
  1: 0,
  6: 10,
  12: 20
};

function calculatePrice(tierId: number, months: number): number {
  const tier = subscriptionTiers[tierId];
  if (!tier) return 0;

  const basePrice = tier.pricePerMonth * months;
  const discount = durationDiscounts[months] || 0;
  const discountAmount = (basePrice * discount) / 100;
  return Math.round((basePrice - discountAmount) * 100) / 100;
}

function getPool(server: string) {
  return server === 'DS1' ? poolDS1 : pool;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tierId, months, amount, discordId: codeAuthDiscordId, server } = body;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = subscriptionTiers[tierId];
    if (!tier) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // TIER PROTECTION: Prevent downgrading while an active subscription exists
    try {
      const dbPool = getPool(server || 'S0');
      const [activeSubs] = await dbPool.execute<RowDataPacket[]>(
        `SELECT tier FROM player_subscriptions 
         WHERE user_id = ? AND is_active = TRUE AND expires_at > NOW() 
         ORDER BY expires_at DESC LIMIT 1`,
        [userId]
      );

      if (activeSubs.length > 0) {
        const currentTierId = activeSubs[0].tier;
        if (tierId < currentTierId) {
          const currentTierName = subscriptionTiers[currentTierId]?.name || 'Higher Tier';
          return NextResponse.json({
            error: `Cannot downgrade! You have an active ${currentTierName} subscription. Please wait for it to expire or upgrade/extend with the same tier.`
          }, { status: 400 });
        }
      }
    } catch (dbError) {
      console.error('Database error checking active subscription:', dbError);
      // We don't block the purchase on DB error, but log it. 
      // Safer to allow purchase if DB check fails? Or safer to block? 
      // Blocking is safer to prevent accidents.
      return NextResponse.json({ error: 'Failed to verify subscription status' }, { status: 500 });
    }

    if (![1, 6, 12].includes(months)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    const expectedPrice = calculatePrice(tierId, months);
    if (Math.abs(amount - expectedPrice) > 0.01) {
      return NextResponse.json({ error: 'Price mismatch' }, { status: 400 });
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
      console.error('PayPal token error');
      return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
    }

    const { access_token } = await tokenResponse.json();

    const customId = `subscription:${tierId}:${months}:${userId}:${server || 'S0'}`;
    const description = `DaoVerse ${tier.name} Subscription - ${months} Month${months > 1 ? 's' : ''}`;

    const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : process.env.NEXT_PUBLIC_BASE_URL || 'https://buydaocoins.replit.app';

    const orderResponse = await fetch(`${paypalBaseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: amount.toFixed(2),
          },
          description: description,
          custom_id: customId,
        }],
        application_context: {
          brand_name: 'DaoVerse',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/shop/subscriptions/return`,
          cancel_url: `${baseUrl}/shop/subscriptions`,
        },
      }),
    });

    if (!orderResponse.ok) {
      console.error('PayPal order creation error');
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
    }

    const orderData = await orderResponse.json();
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      return NextResponse.json({ error: 'Failed to get payment URL' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: orderData.id,
      approvalUrl,
    });
  } catch (error) {
    console.error('Error creating subscription order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
