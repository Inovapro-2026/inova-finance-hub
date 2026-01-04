import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, 
  CreditCard, 
  Mic,
  User,
  CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  
  // Filtrar itens baseado se usuário tem cartão de crédito
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/planner', icon: CalendarCheck, label: 'Planner' },
    { path: '/ai', icon: Mic, label: 'AI Voice', isCenter: true },
    ...(user?.hasCreditCard ? [{ path: '/card', icon: CreditCard, label: 'Cartão' }] : []),
    { path: '/goals', icon: User, label: 'Perfil' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Background */}
      <div className="absolute inset-0 bg-[#f5f5f0] dark:bg-[#1a1a1a] rounded-t-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)]" />
      
      {/* Nav Items */}
      <div className="relative flex items-end justify-around px-2 pb-6 pt-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          // Center floating button for AI Voice
          if (item.isCenter) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="relative flex flex-col items-center -mt-8"
              >
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                    isActive 
                      ? "bg-primary shadow-primary/40" 
                      : "bg-[#6366f1] shadow-[#6366f1]/30"
                  )}
                >
                  <Icon className="w-7 h-7 text-white" />
                </motion.div>
                <span className={cn(
                  "text-[11px] mt-2 font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className="relative flex flex-col items-center justify-center w-16 py-1"
            >
              <Icon 
                className={cn(
                  "w-6 h-6 transition-colors duration-200",
                  isActive ? "text-[#1a1a2e] dark:text-white" : "text-muted-foreground"
                )} 
              />
              <span className={cn(
                "text-[11px] mt-1 font-medium transition-colors",
                isActive ? "text-[#1a1a2e] dark:text-white" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
              
              {/* Active indicator line */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute -bottom-1 w-6 h-0.5 bg-[#1a1a2e] dark:bg-white rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
      
      {/* Safe area for mobile */}
      <div className="h-safe-area-inset-bottom bg-[#f5f5f0] dark:bg-[#1a1a1a]" />
    </nav>
  );
}
