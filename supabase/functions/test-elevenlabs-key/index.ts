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

    let characterCount = 0;
    let characterLimit = 10000;
    let subscriptionSuccess = false;

    // Try to get subscription info first (may fail for Scribe-only keys)
    const subscriptionResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (subscriptionResponse.ok) {
      const subscriptionData = await subscriptionResponse.json();
      console.log("Subscription data:", JSON.stringify(subscriptionData));
      characterCount = subscriptionData.character_count || 0;
      characterLimit = subscriptionData.character_limit || 10000;
      subscriptionSuccess = true;
    } else {
      console.log("Subscription endpoint failed, will test with TTS directly");
    }

    let audioBase64 = null;
    let ttsSuccess = false;

    // Always test TTS to validate the key works for voice
    const voiceId = "pFZP5JQG7iQjIQuC4Bku"; // Lily - Portuguese voice
    const testText = testVoice 
      ? "Olá! Teste de voz realizado com sucesso. A chave está funcionando perfeitamente!"
      : "Teste";

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
      ttsSuccess = true;
      if (testVoice) {
        const audioBuffer = await ttsResponse.arrayBuffer();
        audioBase64 = base64Encode(audioBuffer);
      }
    } else {
      const ttsError = await ttsResponse.text();
      console.error("TTS error:", ttsResponse.status, ttsError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API Key inválida ou sem créditos para TTS",
          details: ttsError
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If subscription failed but TTS worked, try to get usage from user info
    if (!subscriptionSuccess) {
      try {
        const userResponse = await fetch("https://api.elevenlabs.io/v1/user", {
          method: "GET",
          headers: {
            "xi-api-key": apiKey,
          },
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log("User data:", JSON.stringify(userData));
          if (userData.subscription) {
            characterCount = userData.subscription.character_count || 0;
            characterLimit = userData.subscription.character_limit || 10000;
          }
        }
      } catch (e) {
        console.log("Could not fetch user data, using defaults");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "API Key válida! TTS funcionando!",
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
