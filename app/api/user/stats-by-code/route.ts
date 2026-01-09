import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const serverConfigs: { [key: string]: { host: string; user: string; password: string; database: string } } = {
  'S0': {
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!
  },
  'DS1': {
    host: process.env.DB_HOST_DS1 || process.env.DB_HOST!,
    user: process.env.DB_USER_DS1 || process.env.DB_USER!,
    password: process.env.DB_PASSWORD_DS1 || process.env.DB_PASSWORD!,
    database: process.env.DB_NAME_DS1 || 'DS1'
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const discordId = searchParams.get('discordId');
    const server = searchParams.get('server') || 'S0';

    if (!discordId) {
      return NextResponse.json({ error: 'Discord ID required' }, { status: 400 });
    }

    const config = serverConfigs[server] || serverConfigs['S0'];
    
    const pool = await mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4'
    });

    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT id, realm, stage, qi, prestige, dao_coins, dao_coins_spent, spirit_stones FROM players WHERE discord_id = ?',
      [discordId]
    );

    await pool.end();

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const player = rows[0];
    
    return NextResponse.json({
      userId: discordId,
      realm: player.realm,
      stage: player.stage,
      qi: player.qi?.toString() || '0',
      prestige: player.prestige || 0,
      daoCoins: Number(player.dao_coins) || 0,
      daoCoinsSpent: Number(player.dao_coins_spent) || 0,
      spiritStones: player.spirit_stones?.toString() || '0',
      server: server
    });
  } catch (error) {
    console.error('Stats by code error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
