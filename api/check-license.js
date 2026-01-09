// PolishAI API - License Check Endpoint
// Verifies license status from Supabase

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check for valid license in Supabase
    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('product', 'polishai')
      .eq('active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (data) {
      // Update last verified timestamp
      await supabase
        .from('licenses')
        .update({ last_verified: new Date().toISOString() })
        .eq('id', data.id);

      return res.status(200).json({
        valid: true,
        email: normalizedEmail,
        createdAt: data.created_at
      });
    }

    return res.status(200).json({
      valid: false,
      email: normalizedEmail
    });

  } catch (error) {
    console.error('License check error:', error);
    return res.status(500).json({ error: 'Failed to verify license' });
  }
};
