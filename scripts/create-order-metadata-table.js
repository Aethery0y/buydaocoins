const mysql = require('mysql2/promise');

async function createTable() {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('Error: Database environment variables not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS paypal_order_metadata (
        order_id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        base_coins INT NOT NULL,
        bonus_coins INT NOT NULL DEFAULT 0,
        coupon_code VARCHAR(50) NULL,
        bonus_percentage INT NOT NULL DEFAULT 0,
        packages JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        INDEX idx_expires_at (expires_at),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('✓ Table paypal_order_metadata created successfully');
    
    await connection.end();
  } catch (error) {
    console.error('Error creating table:', error);
    await connection.end();
    process.exit(1);
  }
}

createTable();
