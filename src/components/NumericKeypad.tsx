import { motion } from 'framer-motion';
import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
}

export function NumericKeypad({ 
  value, 
  onChange, 
  onSubmit,
  maxLength = 6 
}: NumericKeypadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['delete', '0', 'submit'],
  ];

  const handleKeyPress = (key: string) => {
    if (key === 'delete') {
      onChange(value.slice(0, -1));
    } else if (key === 'submit') {
      if (value.length > 0) {
        onSubmit();
      }
    } else if (value.length < maxLength) {
      onChange(value + key);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4 w-full max-w-xs mx-auto">
      {keys.flat().map((key, index) => {
        const isDelete = key === 'delete';
        const isSubmit = key === 'submit';
        const isDisabled = isSubmit && value.length === 0;

        return (
          <motion.button
            key={index}
            type="button"
            disabled={isDisabled}
            className={cn(
              "keypad-btn",
              isSubmit && !isDisabled && "bg-gradient-primary glow-primary",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleKeyPress(key)}
          >
            {isDelete ? (
              <Delete className="w-6 h-6 text-muted-foreground" />
            ) : isSubmit ? (
              <Check className="w-6 h-6" />
            ) : (
              key
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
