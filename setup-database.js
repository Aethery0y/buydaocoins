const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('Creating dao_coupons table...');
    
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS dao_coupons (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL UNIQUE,
        bonus_percentage INT NOT NULL DEFAULT 100,
        min_purchase_amount DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
        max_uses INT NULL,
        current_uses INT NOT NULL DEFAULT 0,
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_active (active, valid_until)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    
    console.log('✅ dao_coupons table created');

    // Check if columns exist before adding them
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dao_transactions'
    `, [process.env.DB_NAME]);

    const existingColumns = columns.map(c => c.COLUMN_NAME);

    if (!existingColumns.includes('coupon_code')) {
      await connection.execute(`
        ALTER TABLE dao_transactions 
        ADD COLUMN coupon_code VARCHAR(50) NULL
      `);
      console.log('✅ Added coupon_code column to dao_transactions');
    } else {
      console.log('ℹ️  coupon_code column already exists');
    }

    if (!existingColumns.includes('bonus_coins')) {
      await connection.execute(`
        ALTER TABLE dao_transactions 
        ADD COLUMN bonus_coins INT NULL DEFAULT 0
      `);
      console.log('✅ Added bonus_coins column to dao_transactions');
    } else {
      console.log('ℹ️  bonus_coins column already exists');
    }

    if (!existingColumns.includes('package_type')) {
      await connection.execute(`
        ALTER TABLE dao_transactions 
        ADD COLUMN package_type VARCHAR(50) NULL
      `);
      console.log('✅ Added package_type column to dao_transactions');
    } else {
      console.log('ℹ️  package_type column already exists');
    }

    console.log('\nInserting FIRSTCC coupon...');
    
    await connection.execute(`
      INSERT INTO dao_coupons (code, bonus_percentage, min_purchase_amount, valid_until, max_uses)
      VALUES ('FIRSTCC', 100, 10.00, DATE_ADD(NOW(), INTERVAL 4 DAY), NULL)
      ON DUPLICATE KEY UPDATE 
        bonus_percentage = 100,
        min_purchase_amount = 10.00,
        valid_until = DATE_ADD(NOW(), INTERVAL 4 DAY)
    `);
    
    console.log('✅ FIRSTCC coupon created/updated');

    const [coupons] = await connection.execute(`
      SELECT code, bonus_percentage, min_purchase_amount, 
             DATE_FORMAT(valid_until, '%Y-%m-%d %H:%i:%s') as valid_until 
      FROM dao_coupons 
      WHERE code = 'FIRSTCC'
    `);
    
    console.log('\n📋 FIRSTCC Coupon Details:');
    console.log(coupons[0]);
    
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

setupDatabase();
