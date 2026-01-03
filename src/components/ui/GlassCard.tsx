import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";

interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  hover?: boolean;
}

export function GlassCard({ 
  children, 
  className, 
  glow = false,
  hover = true,
  ...props 
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "glass-card p-4",
        glow && "animate-glow-pulse",
        hover && "transition-transform duration-300 hover:scale-[1.02]",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
