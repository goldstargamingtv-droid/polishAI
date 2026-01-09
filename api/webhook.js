// PolishAI API - Stripe Webhook Handler
// Creates license in Supabase after successful payment

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Get raw body for signature verification
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    try {
      // Get customer email
      const customerEmail = session.customer_details?.email || session.customer_email;

      if (!customerEmail) {
        console.error('No customer email found in session');
        return res.status(400).json({ error: 'No customer email' });
      }

      const normalizedEmail = customerEmail.toLowerCase().trim();

      // Check if license already exists
      const { data: existing } = await supabase
        .from('polishai_licenses')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('product', 'polishai')
        .single();

      if (existing) {
        // Reactivate existing license
        await supabase
          .from('polishai_licenses')
          .update({ 
            active: true, 
            updated_at: new Date().toISOString(),
            stripe_session_id: session.id
          })
          .eq('id', existing.id);

        console.log(`Reactivated license for ${normalizedEmail}`);
      } else {
        // Create new license
        const { error: insertError } = await supabase
          .from('polishai_licenses')
          .insert({
            email: normalizedEmail,
            product: 'polishai',
            active: true,
            stripe_session_id: session.id,
            stripe_customer_id: session.customer,
            amount_paid: session.amount_total,
            currency: session.currency,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('Failed to create license:', insertError);
          return res.status(500).json({ error: 'Failed to create license', details: insertError.message, code: insertError.code });
        }

        console.log(`Created license for ${normalizedEmail}`);
      }

      return res.status(200).json({ received: true, email: normalizedEmail });

    } catch (error) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Return 200 for other event types
  return res.status(200).json({ received: true });
};

// Helper to get raw body
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

// Disable body parsing for this route (needed for Stripe signature verification)
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
