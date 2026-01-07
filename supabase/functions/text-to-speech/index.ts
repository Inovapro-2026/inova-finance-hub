import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || text.trim() === '') {
      throw new Error('Text is required');
    }

    // Try custom key first, then fall back to connector-managed key
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY_CUSTOM') || Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured');
    }

    console.log('TTS request received for text:', text.substring(0, 50) + '...');

    // Limpar emojis e formatação do texto
    const cleanText = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/💸|💰|📊|📈|📉|📅|📌|🏆|😤|😒|🤡|😱|😭|🔥|💀|🎉|🙏|💪|💵|🚨|😐|💔|😩|🌪️|☕|🍕|🏥|🚲|🌉|😰|🎊|💳|🙄|👀|✍️|🤔|😅/g, '')
      .trim();

    if (!cleanText) {
      return new Response(
        JSON.stringify({ error: 'No text to speak after cleaning' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Using ElevenLabs API with Brazilian Portuguese female voice
    // Voice: Laura - warm, friendly female voice perfect for Brazilian Portuguese
    const voiceId = "FGY2WhTYpPnrIDTdsKH5"; // Laura - friendly female voice
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2', // Supports Brazilian Portuguese with native accent
          voice_settings: {
            stability: 0.4, // Lower for more expressive/funny delivery
            similarity_boost: 0.75,
            style: 0.6, // Higher style for more personality
            use_speaker_boost: true,
            speed: 1.05 // Slightly faster for comedic timing
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      
      if (response.status === 401) {
        throw new Error('ElevenLabs API key invalid');
      }
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded, please try again later',
            loading: true 
          }),
          { 
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Get the audio as array buffer and encode to base64 safely
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = base64Encode(audioBuffer);

    console.log('TTS audio generated successfully, size:', audioBuffer.byteLength);

    return new Response(
      JSON.stringify({ 
        audio: base64Audio,
        contentType: 'audio/mpeg'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TTS Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
