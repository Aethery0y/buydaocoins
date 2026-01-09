-- Create coupons table for tracking promotional codes
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add coupon tracking columns to dao_transactions if they don't exist
ALTER TABLE dao_transactions 
ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS bonus_coins INT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS package_type VARCHAR(50) NULL;

-- Insert the FIRSTCC promotional coupon (4 days from now)
INSERT INTO dao_coupons (code, bonus_percentage, min_purchase_amount, valid_until, max_uses)
VALUES ('FIRSTCC', 100, 10.00, DATE_ADD(NOW(), INTERVAL 4 DAY), NULL)
ON DUPLICATE KEY UPDATE 
    bonus_percentage = 100,
    min_purchase_amount = 10.00,
    valid_until = DATE_ADD(NOW(), INTERVAL 4 DAY);
