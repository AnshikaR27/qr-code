-- Track how each order was paid
CREATE TYPE payment_method AS ENUM ('cash', 'upi', 'card');
ALTER TABLE orders ADD COLUMN payment_method payment_method;
