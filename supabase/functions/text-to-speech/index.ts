import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const HF_TOKEN = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    
    if (!HF_TOKEN) {
      throw new Error('Hugging Face token not configured');
    }

    console.log('TTS request received for text:', text.substring(0, 50) + '...');

    // Using facebook/mms-tts-por for Portuguese (more stable)
    // Alternative: espnet/kan-bayashi_ljspeech_vits for English
    const response = await fetch(
      'https://api-inference.huggingface.co/models/facebook/mms-tts-por',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      // If model is loading, return a message
      if (response.status === 503) {
        return new Response(
          JSON.stringify({ 
            error: 'Model is loading, please try again in a few seconds',
            loading: true 
          }),
          { 
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      throw new Error(`HF API error: ${response.status}`);
    }

    // Get the audio as array buffer
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(audioBuffer))
    );

    console.log('TTS audio generated successfully, size:', audioBuffer.byteLength);

    return new Response(
      JSON.stringify({ 
        audio: base64Audio,
        contentType: 'audio/wav'
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
