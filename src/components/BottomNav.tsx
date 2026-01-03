import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  CreditCard, 
  ArrowLeftRight, 
  Target, 
  Mic 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/card', icon: CreditCard, label: 'Cartão' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { path: '/goals', icon: Target, label: 'Metas' },
  { path: '/ai', icon: Mic, label: 'IA' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="floating-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300",
              isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary/20 rounded-full"
                transition={{ type: "spring", duration: 0.5 }}
              />
            )}
            <Icon 
              className={cn(
                "w-5 h-5 relative z-10 transition-transform duration-200",
                isActive && "scale-110"
              )} 
            />
            <span className={cn(
              "text-[10px] mt-0.5 relative z-10 font-medium",
              isActive ? "opacity-100" : "opacity-70"
            )}>
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
