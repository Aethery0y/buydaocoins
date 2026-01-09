import pool from './db';
import poolDS1 from './dbDS1';

export function getPoolForServer(server: string | null | undefined) {
  if (server === 'DS1') {
    return poolDS1;
  }
  return pool;
}

export function validateServer(server: string | null | undefined): 'S0' | 'DS1' {
  if (server === 'DS1') {
    return 'DS1';
  }
  return 'S0';
}

export { pool, poolDS1 };
