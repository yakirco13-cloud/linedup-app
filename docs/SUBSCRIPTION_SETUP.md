# LinedUp Subscription System Setup

This document explains how to set up the subscription system with Grow payments.

## Overview

The subscription system consists of:
1. **Supabase Tables** - Store subscription and usage data (subscriptions table already exists)
2. **Frontend Components** - Display subscription status and gate features
3. **Webhook Handler** - Receive payment notifications from Grow

## Step 1: Create Additional Supabase Tables

You already have the `subscriptions` table. Run the SQL in `supabase-schema.sql` to create:
- `message_usage` - Tracks monthly WhatsApp message usage
- `payments` - Stores payment history (optional)
- RPC function `increment_message_count` for tracking messages

Go to Supabase → SQL Editor and run the contents of `supabase-schema.sql`.

## Step 2: Configure Grow Webhooks

Configure Grow's built-in webhook service to call your backend when payments occur.

### Webhook Endpoint

Add this endpoint to your Railway backend (`linedup-official-production.up.railway.app`):

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// POST /api/webhooks/grow
app.post('/api/webhooks/grow', async (req, res) => {
  const payload = req.body;

  try {
    const { event, phone, plan_type, billing_cycle, amount } = payload;

    // Normalize phone number
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '972' + normalizedPhone.substring(1);
    }
    if (!normalizedPhone.startsWith('972')) {
      normalizedPhone = '972' + normalizedPhone;
    }

    // Find business by owner phone
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('phone', normalizedPhone)
      .single();

    if (!profile?.business_id) {
      return res.status(404).json({ error: 'Business not found for phone: ' + phone });
    }

    const businessId = profile.business_id;

    if (event === 'payment.success') {
      // Calculate period end
      const now = new Date();
      const isYearly = billing_cycle === 'yearly' || billing_cycle === 'annual';
      const periodEnd = isYearly
        ? new Date(now.setFullYear(now.getFullYear() + 1))
        : new Date(now.setMonth(now.getMonth() + 1));

      // Update subscription
      await supabase
        .from('subscriptions')
        .upsert({
          business_id: businessId,
          plan_type: plan_type || 'starter',
          billing_cycle: isYearly ? 'yearly' : 'monthly',
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'business_id'
        });

      console.log('Subscription activated:', { businessId, plan_type, billing_cycle });
      return res.json({ success: true, businessId });
    }

    if (event === 'subscription.cancelled') {
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          grace_period_ends_at: gracePeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('business_id', businessId);

      return res.json({ success: true, message: 'Subscription cancelled' });
    }

    res.json({ success: true, message: 'Event processed' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Configure Grow Webhook

In Grow dashboard:
1. Go to Settings → Webhooks
2. Add webhook URL: `https://linedup-official-production.up.railway.app/api/webhooks/grow`
3. Select events to trigger on

## Plan Configuration

Plans are defined in `src/config/plans.js`:

| Plan | Monthly | Yearly | Messages/Month | Staff | Key Features |
|------|---------|--------|----------------|-------|--------------|
| Free | ₪0 | ₪0 | 0 | 1 | Basic booking |
| Starter | ₪49 | ₪490 | 200 | 1 | + Reminders, Statistics |
| Pro | ₪79 | ₪790 | 750 | 1 | + Waiting list, Recurring |
| Premium | ₪129 | ₪1290 | ∞ | ∞ | All features |

Payment Links:
- Monthly: `https://pay.grow.link/3ba886feae7cd44666ee681dfaadd2ce-Mjk2NDU2Mw`
- Annual: `https://pay.grow.link/d5cba3b1c23b75cd189355f3bf1ce0ec-Mjk2NDYzOQ`

## Feature Gating

Use the `FeatureGate` component to restrict access to premium features:

```jsx
import { FeatureGate } from '@/components/FeatureGate';

<FeatureGate feature="statistics">
  <StatisticsComponent />
</FeatureGate>
```

Or use the hook for conditional logic:

```jsx
import { useFeatureGate } from '@/components/FeatureGate';

function MyComponent() {
  const { hasAccess, UpgradePrompt } = useFeatureGate('waitingList');

  if (!hasAccess) {
    return <UpgradePrompt />;
  }

  return <WaitingListComponent />;
}
```

### Available Features

| Feature | Starter | Pro | Premium |
|---------|---------|-----|---------|
| autoReminders | ✓ | ✓ | ✓ |
| statistics | ✓ | ✓ | ✓ |
| waitingList | | ✓ | ✓ |
| recurringBookings | | ✓ | ✓ |
| dataExport | | ✓ | ✓ |
| broadcastMessages | | | ✓ |
| multipleStaff | | | ✓ |

## Upgrade Modal

Show upgrade prompts when users try locked features:

```jsx
import UpgradeModal, { useUpgradeModal } from '@/components/UpgradeModal';

function MyComponent() {
  const { isOpen, feature, openModal, closeModal } = useUpgradeModal();

  const handleLockedFeature = () => {
    openModal('statistics');
  };

  return (
    <>
      <button onClick={handleLockedFeature}>View Statistics</button>
      <UpgradeModal isOpen={isOpen} onClose={closeModal} feature={feature} />
    </>
  );
}
```

## Subscription Card

The `SubscriptionCard` component (in Settings page) shows:
- Current plan and status
- Usage limits
- Message usage progress bar
- Upgrade/manage buttons

## Testing

### Test Subscription Activation

```bash
curl -X POST https://linedup-official-production.up.railway.app/api/webhooks/grow \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.success",
    "phone": "0501234567",
    "plan_type": "pro",
    "billing_cycle": "monthly"
  }'
```

### Verify in Supabase

```sql
SELECT * FROM subscriptions WHERE business_id = 'your-business-id';
```

## Troubleshooting

### Subscription Not Updating
1. Check phone number format (should normalize to 972XXXXXXXXX)
2. Verify business exists for the owner's phone
3. Check Supabase logs for errors

### Features Still Locked
1. Refresh the page (invalidates React Query cache)
2. Check subscription status: `SELECT status, plan_type FROM subscriptions WHERE business_id = ?`
3. Verify subscription is 'active' or 'trial' with valid dates
