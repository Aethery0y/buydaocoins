import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolForServer, pool } from '@/lib/dbPool';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';

const REQUEST_TIMEOUT = 30000;
const MAX_AMOUNT = 10000;
const MIN_AMOUNT = 1;

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^\w-]/g, '');
}

function sanitizeOrderId(orderId: string): string {
  return orderId.replace(/[^\w-]/g, '');
}

function validatePayPalAmount(amount: any): boolean {
  if (typeof amount !== 'string' && typeof amount !== 'number') {
    return false;
  }
  
  const numAmount = parseFloat(String(amount));
  
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return false;
  }
  
  if (numAmount < MIN_AMOUNT || numAmount > MAX_AMOUNT) {
    return false;
  }
  
  return true;
}


export async function POST(req: Request) {
  let connection: PoolConnection | null = null;
  
  try {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { orderId, discordId: codeAuthDiscordId, server: requestServer } = body;
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sanitizedUserId = sanitizeUserId(userId);
    
    if (!sanitizedUserId || sanitizedUserId !== userId) {
      console.error('Invalid user ID format:', userId);
      return NextResponse.json({ error: 'Invalid user session' }, { status: 401 });
    }

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 });
    }

    const sanitizedOrderId = sanitizeOrderId(orderId);
    
    if (!sanitizedOrderId || sanitizedOrderId.length < 10) {
      return NextResponse.json({ error: 'Invalid order ID format' }, { status: 400 });
    }

    // Server comes from the request - frontend must pass it
    const activeServer = requestServer || 'S0';
    
    // Get order metadata from S0 (metadata is always stored on S0)
    const metadataConnection = await pool.getConnection();
    let metadata: any = null;
    
    try {
      const [metadataRows] = await metadataConnection.execute<RowDataPacket[]>(
        'SELECT * FROM paypal_order_metadata WHERE order_id = ? AND expires_at > NOW() LIMIT 1',
        [sanitizedOrderId]
      );
      
      if (metadataRows.length > 0) {
        metadata = metadataRows[0];
      }
    } finally {
      metadataConnection.release();
    }

    // Now get connection from the correct server's pool
    const db = getPoolForServer(activeServer);
    connection = await db.getConnection();

    const [existingTransactions] = await connection.execute<RowDataPacket[]>(
      'SELECT id, user_id FROM dao_transactions WHERE description LIKE ? LIMIT 1',
      [`%PayPal Order ${sanitizedOrderId}%`]
    );

    if (existingTransactions.length > 0) {
      const existingTx = existingTransactions[0];
      if (existingTx.user_id === sanitizedUserId) {
        console.warn('Duplicate capture attempt for order:', sanitizedOrderId);
        return NextResponse.json(
          { error: 'This order has already been processed' },
          { status: 409 }
        );
      } else {
        console.error('Order ID collision detected:', sanitizedOrderId);
        return NextResponse.json(
          { error: 'Invalid order' },
          { status: 400 }
        );
      }
    }

    const paypalClientId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;
    
    if (!paypalClientId || !paypalSecret) {
      console.error('PayPal credentials not configured');
      return NextResponse.json(
        { error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const paypalMode = process.env.PAYPAL_MODE || 'sandbox';
    const paypalUrl = paypalMode === 'live' 
      ? 'https://api-m.paypal.com' 
      : 'https://api-m.sandbox.paypal.com';

    const auth = Buffer.from(`${paypalClientId}:${paypalSecret}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let response;
    try {
      response = await fetch(`${paypalUrl}/v2/checkout/orders/${sanitizedOrderId}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        signal: controller.signal,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('PayPal capture timeout');
        return NextResponse.json(
          { error: 'Payment verification timeout. Please contact support if payment was deducted.' },
          { status: 504 }
        );
      }
      console.error('PayPal capture request failed:', error);
      return NextResponse.json(
        { error: 'Failed to verify payment' },
        { status: 500 }
      );
    }

    clearTimeout(timeoutId);

    let data;
    try {
      data = await response.json();
    } catch (e) {
      console.error('Failed to parse PayPal capture response');
      return NextResponse.json(
        { error: 'Invalid payment response' },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('PayPal capture error:', data);
      
      if (data.name === 'UNPROCESSABLE_ENTITY' && data.details?.[0]?.issue === 'ORDER_ALREADY_CAPTURED') {
        return NextResponse.json(
          { error: 'This order has already been processed' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: 'Payment capture failed' },
        { status: 500 }
      );
    }

    if (data.status !== 'COMPLETED') {
      console.error('PayPal order not completed:', data);
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    if (!data.purchase_units || !Array.isArray(data.purchase_units) || data.purchase_units.length === 0) {
      console.error('Invalid PayPal response structure - no purchase units:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'Invalid payment data' },
        { status: 500 }
      );
    }

    const purchaseUnit = data.purchase_units[0];
    const captureData = purchaseUnit?.payments?.captures?.[0];
    
    if (!captureData || !captureData.amount?.value) {
      console.error('Invalid PayPal response structure - no capture data:', JSON.stringify(data, null, 2));
      return NextResponse.json(
        { error: 'Invalid payment data' },
        { status: 500 }
      );
    }

    if (!validatePayPalAmount(captureData.amount.value)) {
      console.error('Invalid amount in PayPal response:', captureData.amount.value);
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 500 }
      );
    }

    if (captureData.status !== 'COMPLETED') {
      console.error('Capture status not completed:', captureData.status);
      return NextResponse.json(
        { error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const amountPaid = parseFloat(captureData.amount.value);
    
    // Use metadata we already fetched
    if (!metadata) {
      console.error('Order metadata not found:', sanitizedOrderId);
      return NextResponse.json(
        { error: 'Order data not found. Please try creating a new order.' },
        { status: 400 }
      );
    }

    // Verify the amount matches
    if (Math.abs(metadata.amount - amountPaid) > 0.01) {
      console.error('Payment amount mismatch:', { expected: metadata.amount, actual: amountPaid });
      const cleanupConn = await pool.getConnection();
      try {
        await cleanupConn.execute(
          'DELETE FROM paypal_order_metadata WHERE order_id = ?',
          [sanitizedOrderId]
        );
      } finally {
        cleanupConn.release();
      }
      return NextResponse.json(
        { error: 'Payment amount verification failed' },
        { status: 400 }
      );
    }

    // Use validated coin totals from metadata
    const baseCoins = metadata.base_coins;
    const bonusCoins = metadata.bonus_coins;
    const couponCode = metadata.coupon_code;
    
    let packageInfo = null;
    if (metadata.packages) {
      try {
        const packages = JSON.parse(metadata.packages);
        packageInfo = packages && packages.length > 0 
          ? packages.map((p: any) => p.type).join(', ')
          : null;
      } catch (e) {
        console.error('Error parsing packages JSON:', e);
      }
    }
    
    const totalCoins = baseCoins + bonusCoins;

    if (totalCoins <= 0) {
      console.error('Invalid DAO coins calculation:', { amountPaid, baseCoins, bonusCoins, totalCoins });
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 500 }
      );
    }

    try {
      await connection.beginTransaction();

      const [playerRows] = await connection.execute<RowDataPacket[]>(
        'SELECT id, dao_coins FROM players WHERE id = ? FOR UPDATE',
        [sanitizedUserId]
      );

      if (playerRows.length === 0) {
        await connection.rollback();
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        );
      }

      // Update player's DAO coins (total including bonus)
      await connection.execute(
        'UPDATE players SET dao_coins = dao_coins + ?, dao_coins_spent = dao_coins_spent + ? WHERE id = ?',
        [totalCoins, totalCoins, sanitizedUserId]
      );

      // Update coupon usage if applicable
      if (couponCode) {
        await connection.execute(
          'UPDATE dao_coupons SET current_uses = current_uses + 1 WHERE code = ?',
          [couponCode]
        );
      }

      // Create transaction record
      let description = `Web purchase - PayPal Order ${sanitizedOrderId} - $${amountPaid.toFixed(2)}`;
      if (bonusCoins > 0 && couponCode) {
        description += ` (Coupon: ${couponCode}, Bonus: +${bonusCoins} coins)`;
      }
      
      await connection.execute(
        'INSERT INTO dao_transactions (user_id, amount, type, description, coupon_code, bonus_coins, package_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          sanitizedUserId,
          totalCoins,
          'web_purchase',
          description,
          couponCode,
          bonusCoins,
          packageInfo
        ]
      );

      await connection.commit();

      // Delete metadata from S0 after successful transaction
      const cleanupConn = await pool.getConnection();
      try {
        await cleanupConn.execute(
          'DELETE FROM paypal_order_metadata WHERE order_id = ?',
          [sanitizedOrderId]
        );
      } finally {
        cleanupConn.release();
      }

      console.log(`[PAYPAL CAPTURE] Success: ${totalCoins} DC for user ${sanitizedUserId} on server ${activeServer}`);

      return NextResponse.json({
        success: true,
        daoCoins: totalCoins,
        baseCoins,
        bonusCoins,
        couponCode,
        transactionId: data.id,
        server: activeServer,
      });
      
    } catch (dbError) {
      console.error('Database error during transaction:', dbError);
      
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
      
      return NextResponse.json(
        { error: 'Failed to process payment. Please contact support with order ID: ' + sanitizedOrderId },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      connection.release();
    }
  }
}
