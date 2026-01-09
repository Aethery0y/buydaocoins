import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
  charset: 'utf8mb4'
});

export async function POST(request: NextRequest) {
  try {
    const { code, server } = await request.json();
    
    if (!code || !server) {
      return NextResponse.json(
        { error: 'Code and server are required' },
        { status: 400 }
      );
    }
    
    const [rows] = await pool.execute<mysql.RowDataPacket[]>(
      'SELECT discord_id FROM global_users WHERE login_code = ? AND current_server = ?',
      [code.toUpperCase(), server]
    );
    
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid code or server selection' },
        { status: 401 }
      );
    }
    
    const user = rows[0];
    
    return NextResponse.json({
      success: true,
      discordId: user.discord_id,
      server: server
    });
    
  } catch (error) {
    console.error('Code login error:', error);
    return NextResponse.json(
      { error: 'Server error during login' },
      { status: 500 }
    );
  }
}
