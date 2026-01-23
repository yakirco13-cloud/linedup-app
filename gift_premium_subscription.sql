-- Gift a premium subscription for 1 year to a business
-- Replace 'BUSINESS_CODE_HERE' or 'BUSINESS_NAME_HERE' with the actual business info

-- Step 1: Find the business ID (run this first to get the business_id)
SELECT 
  id as business_id,
  name,
  business_code,
  owner_id
FROM businesses
WHERE business_code = 'BUSINESS_CODE_HERE'
  -- OR name = 'BUSINESS_NAME_HERE'
LIMIT 1;

-- Step 2: Check if they already have a subscription
SELECT * FROM subscriptions 
WHERE business_id = 'BUSINESS_ID_FROM_STEP_1';

-- Step 3: Create the premium subscription (replace BUSINESS_ID with actual ID)
INSERT INTO subscriptions (
  business_id,
  plan_id,
  status,
  start_date,
  end_date,
  created_at,
  updated_at
) VALUES (
  'BUSINESS_ID_FROM_STEP_1',  -- Replace with actual business ID
  'premium',                   -- Premium plan
  'active',                    -- Active status
  NOW(),                       -- Start now
  NOW() + INTERVAL '1 year',  -- End in 1 year
  NOW(),
  NOW()
)
ON CONFLICT (business_id) 
DO UPDATE SET
  plan_id = 'premium',
  status = 'active',
  start_date = NOW(),
  end_date = NOW() + INTERVAL '1 year',
  updated_at = NOW();

-- Step 4: Verify the subscription was created
SELECT 
  s.*,
  b.name as business_name,
  b.business_code
FROM subscriptions s
JOIN businesses b ON s.business_id = b.id
WHERE s.business_id = 'BUSINESS_ID_FROM_STEP_1';
