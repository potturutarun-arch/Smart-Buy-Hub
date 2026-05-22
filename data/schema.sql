-- SmartBuyHub PostgreSQL Database Schema
-- Paste this script into your Supabase SQL Editor and click 'Run' to initialize your database!

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT UNIQUE NOT NULL,
    "phone" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalProfit" NUMERIC(10, 2) DEFAULT 5.00
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS "products" (
    "id" BIGINT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalPrice" NUMERIC(10, 2) NOT NULL,
    "discountPrice" NUMERIC(10, 2) NOT NULL,
    "profit" TEXT,
    "image" TEXT,
    "bgColor" TEXT,
    "badge" TEXT,
    "affiliateLink" TEXT
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "retailer" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" NUMERIC(10, 2) NOT NULL,
    "profit" NUMERIC(10, 2) NOT NULL,
    "status" TEXT NOT NULL
);

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" NUMERIC(10, 2) NOT NULL,
    "date" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "utr" TEXT
);

-- 5. Clicks Table
CREATE TABLE IF NOT EXISTS "clicks" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "retailer" TEXT NOT NULL,
    "clicks" BIGINT DEFAULT 0,
    "earnings" NUMERIC(10, 2) DEFAULT 0.00
);

-- 6. Referrals Table
CREATE TABLE IF NOT EXISTS "referrals" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "referredUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateJoined" TEXT NOT NULL,
    "earningsContribution" NUMERIC(10, 2) DEFAULT 0.00
);
