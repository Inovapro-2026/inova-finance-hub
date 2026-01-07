import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, Tag, Repeat, CalendarCheck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface SchedulePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (payment: {
    name: string;
    amount: number;
    dueDay: number;
    isRecurring: boolean;
    specificMonth?: Date;
    category: string;
  }) => void;
  preFill?: {
    amount?: number;
    dueDay?: number;
    name?: string;
  } | null;
}

const PAYMENT_CATEGORIES = [
  { id: 'aluguel', label: 'Aluguel', icon: '🏠' },
  { id: 'energia', label: 'Energia', icon: '⚡' },
  { id: 'agua', label: 'Água', icon: '💧' },
  { id: 'internet', label: 'Internet', icon: '🌐' },
  { id: 'telefone', label: 'Telefone', icon: '📱' },
  { id: 'academia', label: 'Academia', icon: '🏋️' },
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'seguro', label: 'Seguro', icon: '🛡️' },
  { id: 'escola', label: 'Escola', icon: '📚' },
  { id: 'outros', label: 'Outros', icon: '📋' },
];

export function SchedulePaymentModal({ isOpen, onClose, onSchedule, preFill }: SchedulePaymentModalProps) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [isRecurring, setIsRecurring] = useState(true);
  const [category, setCategory] = useState('outros');

  // Pre-fill values when modal opens with data
  useEffect(() => {
    if (isOpen && preFill) {
      if (preFill.name) setName(preFill.name);
      if (preFill.amount) setAmount(preFill.amount.toString());
      if (preFill.dueDay) {
        const now = new Date();
        const preFilledDate = new Date(now.getFullYear(), now.getMonth(), preFill.dueDay);
        setSelectedDate(preFilledDate);
      }
    }
    // Reset when modal closes without preFill
    if (!isOpen) {
      setName('');
      setAmount('');
      setSelectedDate(undefined);
      setIsRecurring(true);
      setCategory('outros');
    }
  }, [isOpen, preFill]);

  const handleSubmit = () => {
    if (!name.trim() || !amount || !selectedDate) return;

    const amountValue = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountValue) || amountValue <= 0) return;

    onSchedule({
      name: name.trim(),
      amount: amountValue,
      dueDay: selectedDate.getDate(),
      isRecurring,
      specificMonth: isRecurring ? undefined : selectedDate,
      category,
    });

    // Reset form
    setName('');
    setAmount('');
    setSelectedDate(undefined);
    setIsRecurring(true);
    setCategory('outros');
    onClose();
  };

  const handleAmountChange = (value: string) => {
    // Allow only numbers and comma/period
    const cleaned = value.replace(/[^\d,\.]/g, '');
    setAmount(cleaned);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pb-24"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md mx-auto my-auto"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="bg-card rounded-3xl shadow-2xl border border-border overflow-hidden max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="bg-gradient-to-r from-primary to-secondary p-5 relative flex-shrink-0">
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <h2 className="text-xl font-bold text-white">Agendar Pagamento</h2>
                <p className="text-white/80 text-sm mt-1">Configure seu lembrete de pagamento</p>
              </div>

              {/* Content */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="payment-name" className="text-sm font-medium flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    Nome do pagamento
                  </Label>
                  <Input
                    id="payment-name"
                    placeholder="Ex: Aluguel, Internet, Academia..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="payment-amount" className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Valor (R$)
                  </Label>
                  <Input
                    id="payment-amount"
                    placeholder="0,00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="h-12 rounded-xl text-lg font-semibold"
                    inputMode="decimal"
                  />
                </div>

                {/* Date Picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    Data do pagamento
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-12 rounded-xl justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarCheck className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : "Escolha a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Recurring Toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-primary" />
                    Frequência
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsRecurring(true)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-sm font-medium",
                        isRecurring
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Repeat className="w-5 h-5 mx-auto mb-2" />
                      Recorrente mensal
                    </button>
                    <button
                      onClick={() => setIsRecurring(false)}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-sm font-medium",
                        !isRecurring
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Calendar className="w-5 h-5 mx-auto mb-2" />
                      Somente este mês
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Categoria</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {PAYMENT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        className={cn(
                          "p-3 rounded-xl border transition-all flex flex-col items-center gap-1",
                          category === cat.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 pt-0 flex-shrink-0">
                <Button
                  onClick={handleSubmit}
                  disabled={!name.trim() || !amount || !selectedDate}
                  className="w-full h-14 rounded-2xl text-lg font-semibold bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  Agendar Lembrete
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render in portal to ensure it's above everything
  return createPortal(modalContent, document.body);
}
