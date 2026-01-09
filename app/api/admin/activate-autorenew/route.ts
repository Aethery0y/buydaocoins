import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, paymentId, amount } = await request.json();

    if (!userId || !paymentId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    // Validate database configuration
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      console.error('[AUTORENEW] Database configuration incomplete');
      return NextResponse.json({ message: 'Database configuration error' }, { status: 500 });
    }

    // Use native SQL to insert AutoRenew purchase
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 1,
      queueLimit: 0,
    });

    try {
      await connection.execute(
        `INSERT INTO autorenew_purchases (user_id, payment_id, is_active, created_at, last_renewed_at) 
         VALUES (?, ?, TRUE, NOW(), NOW())
         ON DUPLICATE KEY UPDATE is_active = TRUE, last_renewed_at = NOW()`,
        [userId, paymentId]
      );

      console.log(`[AUTORENEW] Purchase activated for user ${userId}`);

      return NextResponse.json({
        message: 'AutoRenew purchase activated successfully',
        userId,
        paymentId
      }, { status: 200 });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('[AUTORENEW ACTIVATION] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { message: 'Failed to activate AutoRenew purchase' },
      { status: 500 }
    );
  }
}
