import React from 'react';
import { AlertOctagon } from 'lucide-react';

interface UnconfirmedIndicatorProps {
  unconfirmedCount: number;
}

/**
 * Highlights the number of unconfirmed payment periods.
 * Makes the ✗ status impossible to miss on a projector.
 */
export const UnconfirmedIndicator: React.FC<UnconfirmedIndicatorProps> = ({
  unconfirmedCount,
}) => {
  if (unconfirmedCount === 0) {
    return null;
  }

  return (
    <div className="alert-summary">
      <AlertOctagon size={24} />
      <span>
        ⚠️ <strong>{unconfirmedCount}</strong> unconfirmed payment period
        {unconfirmedCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
};
