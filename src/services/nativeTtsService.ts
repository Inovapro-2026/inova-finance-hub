// Native TTS Service using Web Speech API - Português Brasileiro OBRIGATÓRIO
// Persists voice selection in localStorage

const VOICE_STORAGE_KEY = 'inovabank_selected_voice';

// Prioritized pt-BR voice names (in order of preference)
const PRIORITY_VOICES = [
  'Google português do Brasil',
  'Luciana',
  'Microsoft Maria',
  'Maria',
  'Francisca',
  'Daniel', // pt-BR male voice
  'Portuguese Brazil',
];

let selectedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let onVoiceSelectedCallback: (() => void) | null = null;

/**
 * Check if a voice is Portuguese (pt-BR or pt-PT)
 */
function isPortugueseVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  
  return (
    lang === 'pt-br' ||
    lang === 'pt_br' ||
    lang.startsWith('pt-br') ||
    lang.startsWith('pt_br') ||
    lang === 'pt' ||
    lang.startsWith('pt-') ||
    name.includes('brasil') ||
    name.includes('portuguese') ||
    name.includes('português')
  );
}

/**
 * Get all available pt-BR voices
 */
export function getPtBrVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(isPortugueseVoice);
}

/**
 * Get the best pt-BR voice based on priority list
 */
export function getBestPtBrVoice(): SpeechSynthesisVoice | null {
  const ptBrVoices = getPtBrVoices();
  
  if (ptBrVoices.length === 0) {
    console.warn('TTS: Nenhuma voz pt-BR encontrada!');
    return null;
  }
  
  console.log('TTS: Vozes pt-BR disponíveis:', ptBrVoices.map(v => `${v.name} (${v.lang})`));
  
  // Try to find a prioritized voice
  for (const priorityName of PRIORITY_VOICES) {
    const found = ptBrVoices.find(v => 
      v.name.toLowerCase().includes(priorityName.toLowerCase())
    );
    if (found) {
      console.log('TTS: Voz prioritária encontrada:', found.name);
      return found;
    }
  }
  
  // Return first pt-BR voice as fallback
  console.log('TTS: Usando primeira voz pt-BR:', ptBrVoices[0].name);
  return ptBrVoices[0];
}

/**
 * Load saved voice from localStorage - ONLY if it's Portuguese
 */
function loadSavedVoice(): SpeechSynthesisVoice | null {
  const savedVoiceName = localStorage.getItem(VOICE_STORAGE_KEY);
  if (!savedVoiceName) return null;
  
  const voices = window.speechSynthesis.getVoices();
  const savedVoice = voices.find(v => v.name === savedVoiceName);
  
  // Verify saved voice is Portuguese, otherwise clear it
  if (savedVoice && isPortugueseVoice(savedVoice)) {
    return savedVoice;
  }
  
  // Clear invalid saved voice
  console.log('TTS: Voz salva não é português, limpando:', savedVoiceName);
  localStorage.removeItem(VOICE_STORAGE_KEY);
  return null;
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
 * Auto-select the best pt-BR voice (SOMENTE pt-BR!)
 */
function autoSelectVoice(): void {
  const bestVoice = getBestPtBrVoice();
  
  if (bestVoice) {
    selectedVoice = bestVoice;
    saveVoice(selectedVoice);
    console.log('TTS: Voz pt-BR selecionada:', selectedVoice.name, `(${selectedVoice.lang})`);
  } else {
    // NÃO usar fallback não-português - manter null
    console.warn('TTS: Nenhuma voz pt-BR disponível! TTS não funcionará corretamente.');
    selectedVoice = null;
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

    // Use selected voice or try to load/find one
    let voice = selectedVoice;
    if (!voice) {
      voice = loadSavedVoice();
      if (!voice) {
        // Try to auto-select again
        voice = getBestPtBrVoice();
      }
      if (voice) {
        selectedVoice = voice;
        saveVoice(voice);
      }
    }

    // SEMPRE forçar pt-BR
    utterance.lang = 'pt-BR';
    
    if (voice && isPortugueseVoice(voice)) {
      utterance.voice = voice;
      console.log('TTS: Falando com voz:', voice.name, `(${voice.lang})`);
    } else {
      console.warn('TTS: Usando lang pt-BR sem voz específica');
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
