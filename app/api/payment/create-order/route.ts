import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  try {
    const { item, amount, description, discordId: codeAuthDiscordId, server } = await request.json();
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!item || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!paypalClientId || !paypalSecret) {
      console.error('[PAYMENT] Missing PayPal credentials');
      return NextResponse.json({ error: 'Payment configuration error' }, { status: 500 });
    }

    // Generate access token
    const auth = Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64');
    
    const tokenRes = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      throw new Error('Failed to get PayPal access token');
    }

    const { access_token } = await tokenRes.json();

    // Create order
    const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        ...(session?.user?.email && {
          payer: {
            email_address: session.user.email,
          },
        }),
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: amount.toString(),
            },
            description,
            custom_id: `${item}:${userId}:${Date.now()}`,
          },
        ],
        application_context: {
          return_url: `${process.env.NEXTAUTH_URL}/payment/return`,
          cancel_url: `${process.env.NEXTAUTH_URL}/shop/${item}`,
          brand_name: 'DaoVerse',
          locale: 'en-US',
        },
      }),
    });

    if (!orderRes.ok) {
      throw new Error('Failed to create PayPal order');
    }

    const order = await orderRes.json();
    const approvalUrl = order.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      throw new Error('No approval URL in PayPal response');
    }

    return NextResponse.json({ 
      orderId: order.id,
      approvalUrl,
      status: order.status 
    });

  } catch (error) {
    console.error('[PAYMENT] Error:', error);
    return NextResponse.json(
      { error: 'Payment initialization failed' },
      { status: 500 }
    );
  }
}
