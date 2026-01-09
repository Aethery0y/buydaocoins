import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPoolForServer } from '@/lib/dbPool';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const server = searchParams.get('server') || 'S0';
    const discordId = searchParams.get('discordId');
    
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || discordId;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getPoolForServer(server);

    const [rows] = await db.execute(
      `SELECT 
        id, 
        realm, 
        stage, 
        qi, 
        prestige, 
        dao_coins, 
        dao_coins_spent,
        spirit_stones
      FROM players 
      WHERE id = ?`,
      [userId]
    );

    const player = (rows as any[])[0];
    
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    return NextResponse.json({
      userId: player.id,
      realm: player.realm,
      stage: player.stage,
      qi: player.qi.toString(),
      prestige: player.prestige,
      daoCoins: parseInt(player.dao_coins) || 0,
      daoCoinsSpent: parseInt(player.dao_coins_spent) || 0,
      spiritStones: player.spirit_stones.toString(),
      server: server,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
