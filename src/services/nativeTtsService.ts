// Native TTS Service using Web Speech API - Português Brasileiro
// Persists voice selection in localStorage

const VOICE_STORAGE_KEY = 'inovabank_selected_voice';

// Prioritized pt-BR voice names (in order of preference)
const PRIORITY_VOICES = [
  'Google português do Brasil',
  'Luciana',
  'Microsoft Maria',
  'Maria',
  'Francisca',
  'pt-BR',
  'Portuguese (Brazil)',
];

let selectedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let onVoiceSelectedCallback: (() => void) | null = null;

/**
 * Get all available pt-BR voices
 */
export function getPtBrVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(v => 
    v.lang === 'pt-BR' || 
    v.lang === 'pt_BR' ||
    v.lang.startsWith('pt-BR') ||
    v.lang.startsWith('pt_BR') ||
    (v.lang.startsWith('pt') && v.name.toLowerCase().includes('brasil'))
  );
}

/**
 * Get the best pt-BR voice based on priority list
 */
export function getBestPtBrVoice(): SpeechSynthesisVoice | null {
  const ptBrVoices = getPtBrVoices();
  
  if (ptBrVoices.length === 0) return null;
  
  // Try to find a prioritized voice
  for (const priorityName of PRIORITY_VOICES) {
    const found = ptBrVoices.find(v => 
      v.name.toLowerCase().includes(priorityName.toLowerCase())
    );
    if (found) return found;
  }
  
  // Return first pt-BR voice as fallback
  return ptBrVoices[0];
}

/**
 * Load saved voice from localStorage
 */
function loadSavedVoice(): SpeechSynthesisVoice | null {
  const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY);
  if (!savedVoiceName) return null;
  
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.name === savedVoiceName) || null;
}

/**
 * Save selected voice to localStorage
 */
function saveVoice(voice: SpeechSynthesisVoice): void {
  localStorage.setItem(VOICE_STORAGE_KEY, voice.name);
}

/**
 * Initialize the TTS service
 * Shows voice selector if no voice is saved
 */
export function initNativeTts(onReady?: () => void): void {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported');
    return;
  }

  onVoiceSelectedCallback = onReady || null;

  const tryInit = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return false;
    
    voicesLoaded = true;
    
    // Try to load saved voice
    selectedVoice = loadSavedVoice();
    
    if (selectedVoice) {
      console.log('TTS: Using saved voice:', selectedVoice.name);
      onVoiceSelectedCallback?.();
      return true;
    }
    
    // Auto-select best pt-BR voice
    autoSelectVoice();
    return true;
  };

  // Try immediately
  if (!tryInit()) {
    // Wait for voices to load
    window.speechSynthesis.onvoiceschanged = () => {
      tryInit();
    };
  }
}

/**
 * Auto-select the best pt-BR voice (no prompt needed)
 */
function autoSelectVoice(): void {
  const bestVoice = getBestPtBrVoice();
  
  if (bestVoice) {
    selectedVoice = bestVoice;
    saveVoice(selectedVoice);
    console.log('TTS: Auto-selected pt-BR voice:', selectedVoice.name);
  } else {
    // Fallback to any available voice
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length > 0) {
      selectedVoice = allVoices[0];
      saveVoice(selectedVoice);
      console.log('TTS: Using fallback voice:', selectedVoice.name);
    }
  }
  
  onVoiceSelectedCallback?.();
}

/**
 * Get currently selected voice
 */
export function getSelectedVoice(): SpeechSynthesisVoice | null {
  if (!selectedVoice && voicesLoaded) {
    selectedVoice = loadSavedVoice();
  }
  return selectedVoice;
}

/**
 * Check if a voice is selected
 */
export function hasVoiceSelected(): boolean {
  return selectedVoice !== null || localStorage.getItem(VOICE_STORAGE_KEY) !== null;
}

/**
 * Reset voice selection (will show selector again on next speak)
 */
export function resetVoiceSelection(): void {
  localStorage.removeItem(VOICE_STORAGE_KEY);
  selectedVoice = null;
}

/**
 * Speak text using selected voice
 */
export function speakNative(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('Speech synthesis not supported'));
      return;
    }

    if (!text || text.trim() === '') {
      resolve();
      return;
    }

    // Clean text
    const cleanText = text
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, '. ')
      .replace(/•/g, '')
      .trim();

    if (!cleanText) {
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Use selected voice or try to load it
    let voice = selectedVoice;
    if (!voice) {
      voice = loadSavedVoice();
      if (voice) {
        selectedVoice = voice;
      }
    }

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'pt-BR';
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      console.error('TTS error:', event.error);
      reject(new Error(event.error));
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if currently speaking
 */
export function isSpeaking(): boolean {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}
