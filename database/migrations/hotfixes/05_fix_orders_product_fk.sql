-- ==============================================================================
-- DESCU MARKETPLACE - HOTFIX: FIX ORDERS-PRODUCT RELATIONSHIP
-- ==============================================================================
-- Fixes "Product information unavailable" in Order List.
-- The API query `select('*, product:products(*)')` fails if there is no Foreign Key.
-- This script explicitly adds the FK constraint on `orders.product_id`.

DO $$
BEGIN
    -- 1. Ensure product_id is UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'product_id' AND data_type = 'text'
    ) THEN
        ALTER TABLE orders ALTER COLUMN product_id TYPE UUID USING product_id::uuid;
    END IF;

    -- 2. Add Foreign Key Constraint (if not exists)
    -- We first drop it to be safe (in case it's broken or named differently)
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_product;
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_product_id_fkey;

    ALTER TABLE orders
    ADD CONSTRAINT fk_orders_product
    FOREIGN KEY (product_id) 
    REFERENCES products(id)
    ON DELETE SET NULL;

END $$;
