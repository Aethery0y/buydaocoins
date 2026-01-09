import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import pool from '@/lib/db';
import poolDS1 from '@/lib/dbDS1';

function getPool(server: string) {
  return server === 'DS1' ? poolDS1 : pool;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const codeAuthDiscordId = searchParams.get('discordId');
    const server = searchParams.get('server') || 'S0';
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || codeAuthDiscordId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbPool = getPool(server);
    const [subscriptions] = await dbPool.execute(
      `SELECT tier, tier_name, qi_boost_percent, expires_at FROM player_subscriptions 
       WHERE user_id = ? AND is_active = TRUE AND expires_at > NOW()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );

    const subs = subscriptions as any[];
    
    if (subs.length > 0) {
      return NextResponse.json({
        hasActiveSubscription: true,
        subscription: subs[0]
      });
    }

    return NextResponse.json({
      hasActiveSubscription: false,
      subscription: null
    });
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}
