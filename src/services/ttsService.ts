import { supabase } from '@/integrations/supabase/client';

// Cache for audio to avoid repeated API calls
const audioCache = new Map<string, string>();

export interface TTSResult {
  audio: HTMLAudioElement | null;
  error: string | null;
}

/**
 * Text-to-Speech service using Hugging Face API via Edge Function
 * Converts text to audio and plays it
 */
export async function speak(text: string): Promise<HTMLAudioElement | null> {
  if (!text || text.trim() === '') {
    console.warn('TTS: Empty text provided');
    return null;
  }

  // Normalize text for caching
  const cacheKey = text.trim().toLowerCase();

  // Check cache first
  if (audioCache.has(cacheKey)) {
    console.log('TTS: Using cached audio');
    const cachedAudio = audioCache.get(cacheKey)!;
    const audio = new Audio(cachedAudio);
    audio.play().catch(err => console.error('TTS playback error:', err));
    return audio;
  }

  try {
    console.log('TTS: Requesting speech for:', text.substring(0, 50));

    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: { text: text.trim() }
    });

    if (error) {
      console.error('TTS: Edge function error:', error);
      return null;
    }

    if (data.loading) {
      console.warn('TTS: Model is loading, retrying in 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      return speak(text); // Retry once
    }

    if (data.error) {
      console.error('TTS: API error:', data.error);
      return null;
    }

    if (!data.audio) {
      console.error('TTS: No audio data received');
      return null;
    }

    // Create audio URL from base64
    const audioUrl = `data:${data.contentType || 'audio/wav'};base64,${data.audio}`;
    
    // Cache the audio
    audioCache.set(cacheKey, audioUrl);

    // Create and play audio
    const audio = new Audio(audioUrl);
    audio.play().catch(err => console.error('TTS playback error:', err));
    
    console.log('TTS: Audio playing successfully');
    return audio;

  } catch (err) {
    console.error('TTS: Service error:', err);
    return null;
  }
}

/**
 * Preload audio for common phrases
 */
export async function preloadCommonPhrases(phrases: string[]): Promise<void> {
  for (const phrase of phrases) {
    const cacheKey = phrase.trim().toLowerCase();
    if (!audioCache.has(cacheKey)) {
      try {
        const { data } = await supabase.functions.invoke('text-to-speech', {
          body: { text: phrase }
        });
        if (data?.audio) {
          const audioUrl = `data:${data.contentType || 'audio/wav'};base64,${data.audio}`;
          audioCache.set(cacheKey, audioUrl);
        }
      } catch (err) {
        console.error('TTS preload error:', err);
      }
    }
  }
}

/**
 * Clear the audio cache
 */
export function clearCache(): void {
  audioCache.clear();
}
