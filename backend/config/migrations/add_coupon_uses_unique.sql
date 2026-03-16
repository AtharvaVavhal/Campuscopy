-- Migration: one coupon use per job — prevents double-deduction on Razorpay webhook retry
ALTER TABLE coupon_uses DROP CONSTRAINT IF EXISTS coupon_uses_job_id_key;
ALTER TABLE coupon_uses ADD CONSTRAINT coupon_uses_job_id_key UNIQUE (job_id);