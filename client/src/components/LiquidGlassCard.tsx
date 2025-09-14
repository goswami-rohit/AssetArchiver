import React from 'react';

// --- Props Interface ---
interface LiquidGlassCardProps {
  children: React.ReactNode;
  className?: string; // To allow for additional custom styling
  onPress?: () => void; // Optional click handler
}

/**
 * A reusable card component with a "liquid glass" or "frosted glass" effect.
 * It uses CSS backdrop filters for the blur and is styled with Tailwind CSS.
 * An optional onPress prop adds a subtle press animation.
 */
export default function LiquidGlassCard({
  children,
  className = '',
  onPress,
}: LiquidGlassCardProps) {

  // Base classes for the glass effect
  const baseClasses = "bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 my-2 shadow-lg";

  // Classes to add for the press animation if onPress is provided
  const interactiveClasses = onPress 
    ? "cursor-pointer transition-all duration-150 ease-in-out active:scale-[0.98] active:opacity-80" 
    : "";

  // Combine all classes
  const combinedClasses = `${baseClasses} ${interactiveClasses} ${className}`;

  return (
    <div
      className={combinedClasses}
      onClick={onPress}
    >
      {children}
    </div>
  );
}
