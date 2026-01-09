import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const PAYPAL_API = process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

  try {
    const { token, discordId: codeAuthDiscordId } = await request.json();
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ message: 'Unauthorized', error: 'Not authenticated' }, { status: 401 });
    }
    if (!token || typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 400 });
    }

    // Validate credentials are configured
    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!paypalClientId || !paypalSecret) {
      console.error('[PAYMENT CAPTURE] Missing PayPal credentials');
      return NextResponse.json({ message: 'Payment configuration error' }, { status: 500 });
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
      const errorText = await tokenRes.text();
      console.error('[PAYMENT CAPTURE] PayPal token error:', errorText);
      return NextResponse.json({ message: 'Payment authentication failed' }, { status: 500 });
    }

    const { access_token } = await tokenRes.json();

    // First get order details to retrieve custom_id
    const orderDetailsRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderDetailsRes.ok) {
      console.error('[PAYMENT CAPTURE] Failed to get order details');
      return NextResponse.json({ message: 'Payment verification failed' }, { status: 500 });
    }

    const orderDetails = await orderDetailsRes.json();
    const customId = orderDetails.purchase_units?.[0]?.custom_id;

    if (!customId) {
      console.error('[PAYMENT CAPTURE] No custom_id in order details');
      return NextResponse.json({ message: 'Invalid payment data' }, { status: 400 });
    }

    // Capture order
    const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!captureRes.ok) {
      const errorText = await captureRes.text();
      
      // Check if order was already captured
      if (errorText.includes('ORDER_ALREADY_CAPTURED')) {
        console.log('[PAYMENT CAPTURE] Order already captured - proceeding with activation');
        // Continue with activation even if already captured
      } else {
        console.error('[PAYMENT CAPTURE] PayPal capture error:', errorText);
        return NextResponse.json({ message: 'Payment capture failed' }, { status: 500 });
      }
    }

    let captureData: any = {};
    
    // Only parse response if not already captured error
    if (captureRes.ok) {
      captureData = await captureRes.json();

      // Validate capture response
      if (captureData.status !== 'COMPLETED') {
        console.error('[PAYMENT CAPTURE] Order not completed:', captureData.status);
        return NextResponse.json({ message: 'Payment not completed' }, { status: 400 });
      }
    } else {
      // If already captured, we still need to activate - use order details
      captureData = orderDetails;
    }

    const parts = customId.split(':');
    const [itemType, orderUserId] = parts;

    // Validate item type and user ID
    if (!['autorenew', 'dao_coins'].includes(itemType)) {
      console.error('[PAYMENT CAPTURE] Invalid item type:', itemType);
      return NextResponse.json({ message: 'Invalid purchase type' }, { status: 400 });
    }

    if (orderUserId !== userId) {
      console.error('[PAYMENT CAPTURE] User ID mismatch:', orderUserId, 'vs', userId);
      return NextResponse.json({ message: 'Unauthorized payment' }, { status: 403 });
    }

    // Activate purchase in database based on item type
    if (itemType === 'autorenew') {
      const activationUrl = new URL('/api/admin/activate-autorenew', process.env.NEXTAUTH_URL || 'http://localhost:5000');
      
      const activationResponse = await fetch(activationUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          paymentId: token,
          amount: captureData.purchase_units?.[0]?.amount?.value
        }),
      });

      if (!activationResponse.ok) {
        console.error('[PAYMENT CAPTURE] Activation failed:', await activationResponse.text());
        return NextResponse.json({ message: 'Purchase activation failed' }, { status: 500 });
      }
    }

    console.log(`[PAYMENT CAPTURE] Success: ${itemType} for user ${userId}`);
    
    return NextResponse.json({
      status: 'success',
      message: 'Payment captured and purchase activated successfully!',
      orderId: token,
      itemType
    });

  } catch (error) {
    console.error('[PAYMENT CAPTURE] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { message: 'Payment processing failed' },
      { status: 500 }
    );
  }
}
