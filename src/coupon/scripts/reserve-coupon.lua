-- Redis LUA script for atomic coupon reservation
-- KEYS[1]: quota key (e.g., "coupon:quota:123")
-- KEYS[2]: reservation key (e.g., "coupon:reservation:uuid")
-- ARGV[1]: reservation metadata JSON string
-- ARGV[2]: TTL in seconds (default 900)
-- Returns: "OK" or "NO_QUOTA" or "ERROR:message"

local quota_key = KEYS[1]
local reservation_key = KEYS[2]
local metadata = ARGV[1]
local ttl = tonumber(ARGV[2]) or 900

-- Check if quota exists and is > 0
local quota = redis.call('GET', quota_key)
if quota == false then
  -- Quota not initialized, allow (for unlimited coupons)
  quota = -1
else
  quota = tonumber(quota)
end

-- If quota is 0 or negative (and not -1 for unlimited), reject
if quota ~= -1 and quota <= 0 then
  return "NO_QUOTA"
end

-- Decrement quota (if not unlimited)
if quota ~= -1 then
  local new_quota = redis.call('DECR', quota_key)
  if new_quota < 0 then
    -- Over-decremented, restore and reject
    redis.call('INCR', quota_key)
    return "NO_QUOTA"
  end
end

-- Create reservation hash
redis.call('HSET', reservation_key, 'metadata', metadata, 'created_at', redis.call('TIME')[1])
redis.call('EXPIRE', reservation_key, ttl)

return "OK"


