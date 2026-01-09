// PolishAI API - Text Polish Endpoint
// Uses Claude Haiku for fast, high-quality text transformations

const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompts for each mode
const MODE_PROMPTS = {
  rewrite: `You are a text rewriting assistant. Rewrite the given text to express the same meaning using different words and sentence structures. Keep the tone similar but make it fresh and engaging. Output only the rewritten text, nothing else.`,
  
  simplify: `You are a simplification assistant. Rewrite the given text to make it easier to understand. Use simpler words, shorter sentences, and clearer structure. Maintain the original meaning but make it accessible to a wider audience. Output only the simplified text, nothing else.`,
  
  grammar: `You are a grammar correction assistant. Fix any grammar, spelling, punctuation, or syntax errors in the given text. Make minimal changes - only correct actual errors while preserving the original style and voice. Output only the corrected text, nothing else.`,
  
  formalize: `You are a professional writing assistant. Rewrite the given text in a formal, professional tone suitable for business communication. Use sophisticated vocabulary and proper structure. Output only the formalized text, nothing else.`,
  
  casual: `You are a friendly writing assistant. Rewrite the given text in a casual, conversational tone. Make it sound natural and approachable, like talking to a friend. Output only the casualized text, nothing else.`,
  
  shorten: `You are a concision expert. Condense the given text to be more concise while preserving the essential meaning and key points. Remove redundancy and unnecessary words. Output only the shortened text, nothing else.`,
  
  expand: `You are an elaboration assistant. Expand the given text with more detail, examples, or explanation while maintaining the original message and tone. Make it more comprehensive. Output only the expanded text, nothing else.`,
  
  translate: `You are a translation assistant. Translate the given text to English. If it's already in English, translate it to a cleaner, more natural English. Maintain the original meaning and tone. Output only the translated text, nothing else.`,
  
  custom: `You are a versatile text transformation assistant. Follow the user's specific instructions to transform the text as requested. Output only the transformed text, nothing else.`
};

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
    const { text, mode, customPrompt } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!mode || !MODE_PROMPTS[mode]) {
      return res.status(400).json({ error: 'Invalid mode' });
    }

    // Limit text length
    const maxLength = 5000;
    const trimmedText = text.slice(0, maxLength);

    // Build the prompt
    let systemPrompt = MODE_PROMPTS[mode];
    let userMessage = trimmedText;

    // For custom mode, include the custom instructions
    if (mode === 'custom' && customPrompt) {
      userMessage = `Instructions: ${customPrompt}\n\nText to transform:\n${trimmedText}`;
    }

    // Call Claude Haiku
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const polishedText = message.content[0].text;

    return res.status(200).json({
      success: true,
      polished: polishedText,
      mode: mode,
      inputLength: trimmedText.length,
      outputLength: polishedText.length
    });

  } catch (error) {
    console.error('Polish API Error:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limited. Please try again in a moment.' });
    }

    return res.status(500).json({ 
      error: 'Failed to process text. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
