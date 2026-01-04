// Native TTS Service using Web Speech API with Microsoft voices
// Persists voice selection in localStorage

const VOICE_STORAGE_KEY = 'inovafinance_selected_voice';

// Known masculine pt-BR voice names (Microsoft and others)
const MASCULINE_VOICE_PATTERNS = [
  'Daniel',
  'Antonio',
  'Humberto',
  'Rafael',
  'Male',
  'Masculino',
  'Homem',
];

let selectedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let onVoiceSelectedCallback: (() => void) | null = null;

/**
 * Get all available pt-BR voices
 */
export function getPtBrVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(v => v.lang === 'pt-BR' || v.lang.startsWith('pt-BR'));
}

/**
 * Get masculine pt-BR voices
 */
export function getMasculinePtBrVoices(): SpeechSynthesisVoice[] {
  const ptBrVoices = getPtBrVoices();
  return ptBrVoices.filter(voice => 
    MASCULINE_VOICE_PATTERNS.some(pattern => 
      voice.name.toLowerCase().includes(pattern.toLowerCase())
    )
  );
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
    
    // Show voice selector
    showVoiceSelector();
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
 * Show native voice selector prompt
 */
function showVoiceSelector(): void {
  const ptBrVoices = getPtBrVoices();
  
  if (ptBrVoices.length === 0) {
    console.warn('TTS: No pt-BR voices available');
    // Use any available voice as fallback
    const allVoices = window.speechSynthesis.getVoices();
    if (allVoices.length > 0) {
      selectedVoice = allVoices[0];
      saveVoice(selectedVoice);
    }
    onVoiceSelectedCallback?.();
    return;
  }

  // Prioritize masculine voices
  const masculineVoices = getMasculinePtBrVoices();
  
  // Build selection options
  let voiceOptions = masculineVoices.length > 0 ? masculineVoices : ptBrVoices;
  
  // Create options string for prompt
  const optionsText = voiceOptions
    .map((v, i) => `${i + 1}. ${v.name}`)
    .join('\n');
  
  const message = `Escolha uma voz masculina pt-BR:\n\n${optionsText}\n\nDigite o número da voz (1-${voiceOptions.length}):`;
  
  // Use native prompt
  const selection = prompt(message, '1');
  
  if (selection) {
    const index = parseInt(selection, 10) - 1;
    if (index >= 0 && index < voiceOptions.length) {
      selectedVoice = voiceOptions[index];
      saveVoice(selectedVoice);
      console.log('TTS: Voice selected:', selectedVoice.name);
    } else {
      // Default to first option
      selectedVoice = voiceOptions[0];
      saveVoice(selectedVoice);
    }
  } else {
    // User cancelled, use first available
    selectedVoice = voiceOptions[0];
    saveVoice(selectedVoice);
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
