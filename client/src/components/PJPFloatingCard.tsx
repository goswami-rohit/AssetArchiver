import React from 'react';
import { MapPin, ChevronRight } from 'lucide-react';

// --- Props Interface ---
interface PJPCardProps {
  pjp: any; // Using 'any' to match the original component's flexibility
  onCardPress?: (pjp: any) => void;
}

/**
 * A card component to display a summary of a PJP (Permanent Journey Plan).
 * It shows the dealer's name, address, and the PJP status.
 */
export const PJPFloatingCard: React.FC<PJPCardProps> = ({ pjp, onCardPress }) => {
  // Safely access properties with fallbacks
  const dealerName = pjp?.dealerName || pjp?.name || 'Unknown Dealer';
  const dealerAddress = pjp?.dealerAddress || pjp?.location || pjp?.address || 'Location TBD';
  const status = pjp?.status || 'planned';

  /**
   * Determines the Tailwind CSS classes for the status badge based on the PJP status.
   * @param pjpStatus The status string of the PJP.
   * @returns A string of Tailwind CSS classes.
   */
  const getStatusBadgeClasses = (pjpStatus: string) => {
    switch (pjpStatus?.toLowerCase()) {
      case 'active':
        return 'border-blue-400 bg-blue-500/20 text-blue-300';
      case 'completed':
        return 'border-green-400 bg-green-500/20 text-green-300';
      case 'planned':
        return 'border-yellow-400 bg-yellow-500/20 text-yellow-300';
      case 'cancelled':
        return 'border-red-400 bg-red-500/20 text-red-300';
      default:
        return 'border-gray-400 bg-gray-500/20 text-gray-300';
    }
  };

  const statusClasses = getStatusBadgeClasses(status);

  return (
    // The main container is a simple div; it's meant to be placed inside a LiquidGlassCard
    // The onClick handler is passed down to allow the parent to control the action
    <div 
      className="flex w-full items-center"
      onClick={() => onCardPress?.(pjp)}
    >
      {/* Status Bar on the left */}
      <div className={`w-1.5 h-16 rounded-full mr-4 ${statusClasses.replace('border-', 'bg-').split(' ')[0]}`} />
      
      {/* Main Content */}
      <div className="flex-grow">
        <div className="flex justify-between items-start">
          <h3 className="text-lg font-bold text-white pr-2">{dealerName}</h3>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusClasses}`}>
            {status.toUpperCase()}
          </span>
        </div>
        
        <div className="flex items-center mt-1 text-gray-300">
          <MapPin size={14} className="mr-2 flex-shrink-0" />
          <p className="text-xs truncate">{dealerAddress}</p>
        </div>
      </div>

      {/* "View Details" Chevron */}
      <div className="ml-4">
        <ChevronRight size={20} className="text-gray-400" />
      </div>
    </div>
  );
};

export default PJPFloatingCard;
