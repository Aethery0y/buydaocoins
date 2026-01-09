import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolForServer } from '@/lib/dbPool';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';

const MAX_AMOUNT = 10000;
const MIN_AMOUNT = 1;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS_PER_WINDOW = 5;
const REQUEST_TIMEOUT = 30000;

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^\w-]/g, '');
}

function validateAmount(amount: any): { valid: boolean; error?: string; sanitized?: number } {
  if (amount === null || amount === undefined) {
    return { valid: false, error: 'Amount is required' };
  }

  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    return { valid: false, error: 'Invalid amount format' };
  }

  if (amount < MIN_AMOUNT) {
    return { valid: false, error: `Minimum purchase is $${MIN_AMOUNT}` };
  }

  if (amount > MAX_AMOUNT) {
    return { valid: false, error: `Maximum purchase is $${MAX_AMOUNT}` };
  }

  const sanitizedAmount = Math.round(amount * 100) / 100;

  if (sanitizedAmount !== amount) {
    return { valid: false, error: 'Amount must have maximum 2 decimal places' };
  }

  if (sanitizedAmount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  return { valid: true, sanitized: sanitizedAmount };
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

    const { amount, couponCode, packages, discordId: codeAuthDiscordId, server } = body;
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    const activeServer = server || 'S0';
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sanitizedUserId = sanitizeUserId(userId);
    
    if (!sanitizedUserId || sanitizedUserId !== userId) {
      console.error('Invalid user ID format:', userId);
      return NextResponse.json({ error: 'Invalid user session' }, { status: 401 });
    }

    if (!checkRateLimit(sanitizedUserId)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429 }
      );
    }
    const validation = validateAmount(amount);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const sanitizedAmount = validation.sanitized!;

    // Get connection from the correct server's pool
    const db = getPoolForServer(activeServer);
    connection = await db.getConnection();

    // Validate and calculate package totals
    const PACKAGE_DEFINITIONS = [
      { id: 'pkg1', type: 'Starter', coins: 50, price: 40 },
      { id: 'pkg2', type: 'Popular', coins: 100, price: 80 },
      { id: 'pkg3', type: 'Great Value', coins: 150, price: 125 },
      { id: 'pkg4', type: 'Ultimate', coins: 200, price: 150 },
    ];

    let calculatedPrice = 0;
    let baseCoins = 0;
    let validatedPackages: any[] = [];

    if (packages && Array.isArray(packages) && packages.length > 0) {
      // Validate each package
      for (const pkg of packages) {
        const definition = PACKAGE_DEFINITIONS.find(p => p.id === pkg.id);
        
        if (!definition) {
          return NextResponse.json(
            { error: `Invalid package ID: ${pkg.id}` },
            { status: 400 }
          );
        }

        const quantity = parseInt(pkg.quantity);
        if (!quantity || quantity < 1 || quantity > 100) {
          return NextResponse.json(
            { error: `Invalid quantity for package ${pkg.id}` },
            { status: 400 }
          );
        }

        calculatedPrice += definition.price * quantity;
        baseCoins += definition.coins * quantity;
        
        validatedPackages.push({
          ...definition,
          quantity
        });
      }

      // Verify the amount matches calculated price
      if (Math.abs(calculatedPrice - sanitizedAmount) > 0.01) {
        console.error('Price mismatch:', { calculatedPrice, sanitizedAmount, packages });
        return NextResponse.json(
          { error: 'Package price mismatch. Please refresh and try again.' },
          { status: 400 }
        );
      }
    } else {
      // Custom amount purchase (not a package)
      baseCoins = Math.floor(sanitizedAmount);
    }

    // Validate coupon if provided (only for custom amounts, not packages)
    let couponData = null;
    if (couponCode && typeof couponCode === 'string') {
      // Reject coupons for package purchases
      if (validatedPackages.length > 0) {
        return NextResponse.json(
          { error: 'Coupon codes cannot be used with package purchases' },
          { status: 400 }
        );
      }
      
      const code = couponCode.trim().toUpperCase();
      
      const [coupons] = await connection.execute<RowDataPacket[]>(
        `SELECT * FROM dao_coupons 
         WHERE code = ? AND active = TRUE 
         AND valid_from <= NOW() 
         AND valid_until >= NOW()
         LIMIT 1`,
        [code]
      );

      if (coupons.length > 0) {
        const coupon = coupons[0];
        
        if (sanitizedAmount >= coupon.min_purchase_amount) {
          if (coupon.max_uses === null || coupon.current_uses < coupon.max_uses) {
            couponData = {
              code: coupon.code,
              bonusPercentage: coupon.bonus_percentage
            };
          }
        }
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

    // Calculate total coins (base + bonus)
    const bonusCoins = couponData ? Math.floor(baseCoins * (couponData.bonusPercentage / 100)) : 0;
    const totalCoins = baseCoins + bonusCoins;

    let description = `${baseCoins} DAO Coins`;
    if (bonusCoins > 0 && couponData) {
      description += ` + ${bonusCoins} Bonus (${couponData.code})`;
    }
    if (packages && Array.isArray(packages) && packages.length > 0) {
      description += ` (${packages.length} package${packages.length > 1 ? 's' : ''})`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let paypalResponse;
    try {
      paypalResponse = await fetch(`${paypalUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            amount: {
              currency_code: 'USD',
              value: sanitizedAmount.toFixed(2),
            },
            description,
          }],
          application_context: {
            return_url: `${process.env.NEXTAUTH_URL}/success`,
            cancel_url: `${process.env.NEXTAUTH_URL}/payment`,
            brand_name: 'DAOverse',
            user_action: 'PAY_NOW',
          },
        }),
        signal: controller.signal,
      });
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('PayPal request timeout');
        return NextResponse.json(
          { error: 'Payment request timeout. Please try again.' },
          { status: 504 }
        );
      }
      console.error('PayPal request failed:', error);
      return NextResponse.json(
        { error: 'Failed to connect to payment system' },
        { status: 500 }
      );
    }

    clearTimeout(timeoutId);

    let data;
    try {
      data = await paypalResponse.json();
    } catch (e) {
      console.error('Failed to parse PayPal response');
      return NextResponse.json(
        { error: 'Invalid payment response' },
        { status: 500 }
      );
    }

    if (!paypalResponse.ok) {
      console.error('PayPal error:', data);
      return NextResponse.json(
        { error: 'Failed to create payment order' },
        { status: 500 }
      );
    }

    if (!data.id || typeof data.id !== 'string') {
      console.error('PayPal did not return valid order ID:', data);
      return NextResponse.json(
        { error: 'Invalid payment response' },
        { status: 500 }
      );
    }

    const orderId = data.id.replace(/[^\w-]/g, '');
    
    if (!orderId || orderId.length < 10) {
      console.error('Invalid PayPal order ID format:', data.id);
      return NextResponse.json(
        { error: 'Invalid payment response' },
        { status: 500 }
      );
    }

    // Store metadata in database for capture
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    await connection.execute(
      `INSERT INTO paypal_order_metadata 
       (order_id, user_id, amount, base_coins, bonus_coins, coupon_code, bonus_percentage, packages, expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        sanitizedUserId,
        sanitizedAmount,
        baseCoins,
        bonusCoins,
        couponData?.code || null,
        couponData?.bonusPercentage || 0,
        validatedPackages.length > 0 ? JSON.stringify(validatedPackages) : null,
        expiresAt
      ]
    );

    // Clean up expired metadata
    await connection.execute(
      'DELETE FROM paypal_order_metadata WHERE expires_at < NOW()'
    );

    return NextResponse.json({ orderId, server: activeServer });
    
  } catch (error) {
    console.error('Error creating PayPal order:', error);
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
