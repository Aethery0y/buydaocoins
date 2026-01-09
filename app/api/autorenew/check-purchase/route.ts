import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const codeAuthDiscordId = searchParams.get('discordId');
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ hasPurchased: false }, { status: 200 });
    }

    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      console.error('[AUTORENEW CHECK] Database configuration incomplete');
      return NextResponse.json({ hasPurchased: false, error: 'Database config error' }, { status: 500 });
    }

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
      const [result] = await connection.execute(
        'SELECT id FROM autorenew_purchases WHERE user_id = ? AND is_active = TRUE LIMIT 1',
        [userId]
      );

      return NextResponse.json({ 
        hasPurchased: result && result.length > 0 
      });
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error('[AUTORENEW CHECK] Error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ hasPurchased: false, error: 'Check failed' }, { status: 500 });
  }
}
