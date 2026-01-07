import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, testVoice } = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key não fornecida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test the API key with user subscription info
    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API Key inválida ou sem créditos",
          details: errorText
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscriptionData = await response.json();
    console.log("Subscription data:", JSON.stringify(subscriptionData));
    
    // Extract usage info from subscription endpoint
    const characterCount = subscriptionData.character_count || 0;
    const characterLimit = subscriptionData.character_limit || 10000;

    let audioBase64 = null;

    // If testVoice is true, generate a test audio
    if (testVoice) {
      const voiceId = "pFZP5JQG7iQjIQuC4Bku"; // Lily - Portuguese voice
      const testText = "Olá! Teste de voz realizado com sucesso. A chave está funcionando perfeitamente!";

      const ttsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: testText,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (ttsResponse.ok) {
        const audioBuffer = await ttsResponse.arrayBuffer();
        audioBase64 = base64Encode(audioBuffer);
      } else {
        console.error("TTS error:", await ttsResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "API Key válida!",
        usage: {
          used: characterCount,
          limit: characterLimit,
          remaining: characterLimit - characterCount
        },
        audio: audioBase64
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error testing ElevenLabs key:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
