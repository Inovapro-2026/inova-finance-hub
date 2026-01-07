// ISA Voice Service - Intelligent System Assistant for INOVAHUB
// Uses ElevenLabs for main pages, native browser voice for secondary pages

import { speakWithElevenLabs, stopElevenLabsSpeaking } from './elevenlabsTtsService';
import { speakNative, stopSpeaking as stopNativeSpeaking } from './nativeTtsService';

const ISA_GREETING_KEY = 'isa_last_greeting_date';
const ISA_TAB_GREETED_KEY = 'isa_tab_greeted';
const ISA_VOICE_ENABLED_KEY = 'isa_voice_enabled';

// Main pages that use ElevenLabs (premium voice)
const PREMIUM_VOICE_PAGES = ['dashboard', 'planner', 'card', 'goals', 'ai'];

/**
 * Check if ISA voice is enabled
 */
export function isVoiceEnabled(): boolean {
  const stored = localStorage.getItem(ISA_VOICE_ENABLED_KEY);
  // Default to true if not set
  return stored === null ? true : stored === 'true';
}

/**
 * Set ISA voice enabled/disabled
 */
export function setVoiceEnabled(enabled: boolean): void {
  localStorage.setItem(ISA_VOICE_ENABLED_KEY, enabled.toString());
}

/**
 * Convert currency value to natural Brazilian Portuguese speech
 * Examples:
 * - 10.50 → "dez reais e cinquenta centavos"
 * - 2000 → "dois mil reais"
 * - 150.00 → "cento e cinquenta reais"
 * - 0.99 → "noventa e nove centavos"
 */
export function currencyToSpeech(value: number): string {
  if (value === 0) return 'zero reais';
  
  const absValue = Math.abs(value);
  const reais = Math.floor(absValue);
  const centavos = Math.round((absValue - reais) * 100);
  
  let result = '';
  
  // Handle reais
  if (reais > 0) {
    result = numberToWords(reais);
    result += reais === 1 ? ' real' : ' reais';
  }
  
  // Handle centavos
  if (centavos > 0) {
    if (reais > 0) {
      result += ' e ';
    }
    result += numberToWords(centavos);
    result += centavos === 1 ? ' centavo' : ' centavos';
  }
  
  return value < 0 ? `menos ${result}` : result;
}

/**
 * Convert number to Portuguese words
 */
function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    const remainder = num % 1000000;
    let result = millions === 1 ? 'um milhão' : `${numberToWords(millions)} milhões`;
    if (remainder > 0) {
      result += remainder < 100 ? ' e ' : ' ';
      result += numberToWords(remainder);
    }
    return result;
  }
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = thousands === 1 ? 'mil' : `${numberToWords(thousands)} mil`;
    if (remainder > 0) {
      result += remainder < 100 ? ' e ' : ' ';
      result += numberToWords(remainder);
    }
    return result;
  }
  
  if (num >= 100) {
    if (num === 100) return 'cem';
    const h = Math.floor(num / 100);
    const remainder = num % 100;
    let result = hundreds[h];
    if (remainder > 0) {
      result += ' e ' + numberToWords(remainder);
    }
    return result;
  }
  
  if (num >= 20) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    let result = tens[t];
    if (u > 0) {
      result += ' e ' + units[u];
    }
    return result;
  }
  
  if (num >= 10) {
    return teens[num - 10];
  }
  
  return units[num];
}

/**
 * Check if this is the first access of the day
 */
export function isFirstAccessToday(): boolean {
  const lastGreeting = localStorage.getItem(ISA_GREETING_KEY);
  const today = new Date().toDateString();
  return lastGreeting !== today;
}

/**
 * Mark today as greeted
 */
export function markGreetedToday(): void {
  const today = new Date().toDateString();
  localStorage.setItem(ISA_GREETING_KEY, today);
}

/**
 * Check if a specific tab was already greeted in this session
 */
export function wasTabGreeted(tabName: string): boolean {
  const greetedTabs = sessionStorage.getItem(ISA_TAB_GREETED_KEY);
  if (!greetedTabs) return false;
  const tabs = JSON.parse(greetedTabs) as string[];
  return tabs.includes(tabName);
}

/**
 * Mark a tab as greeted for this session
 */
export function markTabGreeted(tabName: string): void {
  const greetedTabs = sessionStorage.getItem(ISA_TAB_GREETED_KEY);
  const tabs = greetedTabs ? JSON.parse(greetedTabs) as string[] : [];
  if (!tabs.includes(tabName)) {
    tabs.push(tabName);
    sessionStorage.setItem(ISA_TAB_GREETED_KEY, JSON.stringify(tabs));
  }
}

/**
 * Get time-based greeting
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Speak with ISA - automatically selects ElevenLabs or native voice based on context
 * @param text - Text to speak
 * @param pageType - The page type to determine voice engine
 * @param forceNative - Force use of native voice
 */
export async function isaSpeak(
  text: string, 
  pageType: string = 'other',
  forceNative: boolean = false
): Promise<void> {
  // Check if voice is enabled
  if (!isVoiceEnabled()) {
    console.log('ISA: Voice is disabled');
    return;
  }
  
  // Stop any ongoing speech
  stopElevenLabsSpeaking();
  stopNativeSpeaking();
  
  const usePremiumVoice = !forceNative && PREMIUM_VOICE_PAGES.includes(pageType.toLowerCase());
  
  try {
    if (usePremiumVoice) {
      console.log('ISA: Using ElevenLabs voice for:', pageType);
      await speakWithElevenLabs(text);
    } else {
      console.log('ISA: Using native browser voice for:', pageType);
      await speakNative(text);
    }
  } catch (error) {
    console.error('ISA voice error:', error);
    // Fallback to native voice if ElevenLabs fails
    if (usePremiumVoice) {
      console.log('ISA: Falling back to native voice');
      try {
        await speakNative(text);
      } catch (fallbackError) {
        console.error('ISA fallback voice error:', fallbackError);
      }
    }
  }
}

/**
 * Stop ISA from speaking
 */
export function isaStop(): void {
  stopElevenLabsSpeaking();
  stopNativeSpeaking();
}

/**
 * Generate ISA greeting message for first access
 */
export function generateFirstAccessGreeting(userName: string): string {
  const firstName = userName.split(' ')[0];
  const timeGreeting = getTimeGreeting();
  return `${timeGreeting}, ${firstName}! Sou a ISA, suporte oficial do INOVAHUB. Como posso te ajudar hoje?`;
}

/**
 * Generate Dashboard/Home greeting with financial data
 */
export function generateHomeGreeting(
  userName: string,
  balance: number,
  todaySpent: number,
  paymentsDueToday: number,
  daysUntilSalary: number | null
): string {
  const firstName = userName.split(' ')[0];
  const timeGreeting = getTimeGreeting();
  
  let message = `${timeGreeting}, ${firstName}! `;
  message += `Seu saldo disponível é de ${currencyToSpeech(balance)}. `;
  
  if (todaySpent > 0) {
    message += `Hoje você gastou ${currencyToSpeech(todaySpent)}. `;
  }
  
  if (paymentsDueToday > 0) {
    message += `Você tem ${currencyToSpeech(paymentsDueToday)} para pagar hoje. `;
  }
  
  if (daysUntilSalary !== null && daysUntilSalary >= 0) {
    if (daysUntilSalary === 0) {
      message += 'Hoje é dia de salário! ';
    } else if (daysUntilSalary === 1) {
      message += 'Amanhã é dia de salário. ';
    } else if (daysUntilSalary <= 5) {
      message += `Faltam ${daysUntilSalary} dias para seu próximo recebimento. `;
    }
  }
  
  message += 'Clique no microfone para falar comigo.';
  
  return message;
}

/**
 * Generate Planner tab greeting with goals and payments data
 */
export function generatePlannerGreeting(
  activeGoals: number,
  goalsWithoutProgress: number,
  monthlyPayments: number,
  daysUntilSalary: number | null
): string {
  let message = '';
  
  if (activeGoals > 0) {
    message += `Você tem ${activeGoals} ${activeGoals === 1 ? 'meta cadastrada' : 'metas cadastradas'}. `;
    
    if (goalsWithoutProgress > 0) {
      message += `${goalsWithoutProgress === 1 ? 'Uma meta está' : `${goalsWithoutProgress} metas estão`} sem progresso. Atualize suas metas clicando em editar. `;
    }
  } else {
    message += 'Você ainda não tem metas cadastradas. Que tal criar uma agora? ';
  }
  
  if (monthlyPayments > 0) {
    message += `Você tem ${currencyToSpeech(monthlyPayments)} a pagar este mês. `;
  }
  
  if (daysUntilSalary !== null && daysUntilSalary > 0) {
    message += `Faltam ${daysUntilSalary} dias para seu próximo recebimento. `;
  }
  
  message += 'Clique no microfone para falar com a IA.';
  
  return message;
}

/**
 * Generate Card tab greeting
 */
export function generateCardGreeting(
  creditLimit: number,
  creditUsed: number
): string {
  const available = creditLimit - creditUsed;
  const usagePercent = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;
  
  let message = `Seu limite de crédito é de ${currencyToSpeech(creditLimit)}. `;
  
  if (creditUsed > 0) {
    message += `Você já gastou ${currencyToSpeech(creditUsed)} do seu limite. `;
    message += `Resta ${currencyToSpeech(available)} disponível. `;
  } else {
    message += 'Você não utilizou seu limite ainda. ';
  }
  
  if (usagePercent < 30 && creditLimit > 0) {
    message += 'Você está usando seu crédito de forma responsável. Continue assim!';
  } else if (usagePercent >= 80) {
    message += 'Atenção! Seu limite está quase no máximo. Organize seus pagamentos no painel.';
  }
  
  return message;
}

/**
 * Generate Profile/Goals tab greeting
 */
export function generateProfileGreeting(activeGoals: number): string {
  let message = '';
  
  if (activeGoals > 0) {
    message = `Você tem ${activeGoals} ${activeGoals === 1 ? 'meta ativa' : 'metas ativas'} no seu perfil. `;
  } else {
    message = 'Você ainda não cadastrou metas. ';
  }
  
  message += 'Acesse a aba planejamento para atualizar suas metas.';
  
  return message;
}

/**
 * Calculate days until a specific day of the month
 */
export function calculateDaysUntilDay(targetDay: number): number {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let targetDate: Date;
  
  if (currentDay <= targetDay) {
    // Target is this month
    targetDate = new Date(currentYear, currentMonth, targetDay);
  } else {
    // Target is next month
    targetDate = new Date(currentYear, currentMonth + 1, targetDay);
  }
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}
