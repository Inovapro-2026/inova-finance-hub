import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showText, setShowText] = useState(false);
  const [showSubtext, setShowSubtext] = useState(false);

  useEffect(() => {
    // Sequence animations
    const textTimer = setTimeout(() => setShowText(true), 600);
    const subtextTimer = setTimeout(() => setShowSubtext(true), 1200);
    
    // Play welcome audio
    const audioTimer = setTimeout(() => {
      playWelcomeAudio();
    }, 800);

    // Complete splash after animations
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(textTimer);
      clearTimeout(subtextTimer);
      clearTimeout(audioTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const playWelcomeAudio = () => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance('Bem-vindo ao Inova Bank');
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      // Try to find a Brazilian Portuguese voice
      const voices = window.speechSynthesis.getVoices();
      const ptBrVoice = voices.find(
        voice => voice.lang === 'pt-BR' || voice.lang.startsWith('pt')
      );
      
      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }

      // If voices aren't loaded yet, wait for them
      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          const loadedVoices = window.speechSynthesis.getVoices();
          const voice = loadedVoices.find(
            v => v.lang === 'pt-BR' || v.lang.startsWith('pt')
          );
          if (voice) {
            utterance.voice = voice;
          }
          window.speechSynthesis.speak(utterance);
        };
      } else {
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Primary glow */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/30 rounded-full blur-[150px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
          
          {/* Secondary glow */}
          <motion.div
            className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-secondary/20 rounded-full blur-[100px]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />

          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/40 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                y: [0, -100],
              }}
              transition={{
                duration: 3,
                delay: i * 0.1,
                repeat: Infinity,
                repeatDelay: Math.random() * 2,
              }}
            />
          ))}

          {/* Pulse rings */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={`ring-${i}`}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-primary/20 rounded-full"
              initial={{ width: 100, height: 100, opacity: 0 }}
              animate={{
                width: [100, 600],
                height: [100, 600],
                opacity: [0.5, 0],
              }}
              transition={{
                duration: 2.5,
                delay: i * 0.8,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        {/* Logo Container */}
        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Shield Icon with Glow */}
          <motion.div
            className="relative mb-6"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 200, 
              damping: 15,
              duration: 0.8 
            }}
          >
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 w-24 h-24 bg-gradient-primary rounded-2xl blur-xl"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            
            {/* Icon container */}
            <div className="relative w-24 h-24 rounded-2xl bg-gradient-primary flex items-center justify-center glow-primary">
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Shield className="w-12 h-12 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Bank Name */}
          <AnimatePresence>
            {showText && (
              <motion.h1
                className="font-display text-5xl font-bold gradient-text mb-2"
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                INOVA BANK
              </motion.h1>
            )}
          </AnimatePresence>

          {/* Tagline */}
          <AnimatePresence>
            {showSubtext && (
              <motion.p
                className="text-muted-foreground text-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                Seu controle financeiro inteligente
              </motion.p>
            )}
          </AnimatePresence>

          {/* Loading indicator */}
          <motion.div
            className="mt-12 flex gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-primary rounded-full"
                animate={{
                  y: [0, -8, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.15,
                  repeat: Infinity,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
