// Native TTS Service using Web Speech API - Português Brasileiro OBRIGATÓRIO
// Vozes naturais de alta qualidade com configurações otimizadas

const VOICE_STORAGE_KEY = 'inovabank_selected_voice';

// Vozes de alta qualidade (Neural/Natural) - ordem de preferência
// Google e Microsoft têm as vozes mais naturais
const HIGH_QUALITY_VOICES = [
  // Google Neural voices (mais naturais)
  'Google português do Brasil',
  'Google Português do Brasil',
  // Microsoft Neural voices (excelente qualidade)
  'Microsoft Francisca Online (Natural)',
  'Microsoft Thalita Online (Natural)', 
  'Microsoft Antonio Online (Natural)',
  'Francisca',
  'Thalita',
  'Antonio',
  // Apple voices (macOS/iOS)
  'Luciana',
  'Felipe',
  // Outras vozes brasileiras
  'Maria',
  'Daniel',
  'Portuguese Brazil Female',
  'Portuguese Brazil Male',
  'pt-BR-Wavenet',
  'pt-BR-Neural',
];

// Vozes a EVITAR (muito robóticas)
const AVOID_VOICES = [
  'espeak',
  'eSpeak',
  'MBROLA',
  'Festival',
];

let selectedVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;
let onVoiceSelectedCallback: (() => void) | null = null;

/**
 * Check if a voice is Portuguese (pt-BR preferred)
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
 * Check if voice is high quality (Neural/Natural)
 */
function isHighQualityVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  
  // Avoid robotic voices
  if (AVOID_VOICES.some(avoid => name.includes(avoid.toLowerCase()))) {
    return false;
  }
  
  // Prefer Neural/Natural/Online voices
  return (
    name.includes('neural') ||
    name.includes('natural') ||
    name.includes('online') ||
    name.includes('google') ||
    name.includes('wavenet') ||
    voice.localService === false // Remote voices are usually better
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
 * Get the best pt-BR voice based on quality
 */
export function getBestPtBrVoice(): SpeechSynthesisVoice | null {
  const ptBrVoices = getPtBrVoices();
  
  if (ptBrVoices.length === 0) {
    console.warn('TTS: Nenhuma voz pt-BR encontrada!');
    return null;
  }
  
  console.log('TTS: Vozes pt-BR disponíveis:', ptBrVoices.map(v => 
    `${v.name} (${v.lang}) ${isHighQualityVoice(v) ? '⭐' : ''}`
  ));
  
  // First: Try to find a high-quality prioritized voice
  for (const priorityName of HIGH_QUALITY_VOICES) {
    const found = ptBrVoices.find(v => 
      v.name.toLowerCase().includes(priorityName.toLowerCase()) &&
      !AVOID_VOICES.some(avoid => v.name.toLowerCase().includes(avoid.toLowerCase()))
    );
    if (found) {
      console.log('TTS: ⭐ Voz de alta qualidade encontrada:', found.name);
      return found;
    }
  }
  
  // Second: Find any high-quality pt-BR voice
  const highQualityVoice = ptBrVoices.find(isHighQualityVoice);
  if (highQualityVoice) {
    console.log('TTS: Voz de qualidade encontrada:', highQualityVoice.name);
    return highQualityVoice;
  }
  
  // Third: Find any non-robotic voice
  const nonRoboticVoice = ptBrVoices.find(v => 
    !AVOID_VOICES.some(avoid => v.name.toLowerCase().includes(avoid.toLowerCase()))
  );
  if (nonRoboticVoice) {
    console.log('TTS: Voz não-robótica encontrada:', nonRoboticVoice.name);
    return nonRoboticVoice;
  }
  
  // Last resort: first pt-BR voice
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

    // Configurações para voz mais natural
    // Rate um pouco mais lento = mais natural
    utterance.rate = 0.95;
    // Pitch levemente mais baixo = menos robótico
    utterance.pitch = 0.98;
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
