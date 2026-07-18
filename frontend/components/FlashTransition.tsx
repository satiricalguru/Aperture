import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface FlashTransitionProps {
  children: React.ReactNode;
}

export default function FlashTransition({ children }: FlashTransitionProps) {
  const [isFlashed, setIsFlashed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) {
      setIsFlashed(true);
      return;
    }

    const timer = setTimeout(() => {
      setIsFlashed(true);
    }, 120);

    return () => clearTimeout(timer);
  }, [shouldReduceMotion]);

  if (shouldReduceMotion) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Developed Image */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isFlashed ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>

      {/* Camera Flash Overlay */}
      {!isFlashed && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-flash z-10"
        />
      )}
    </div>
  );
}
