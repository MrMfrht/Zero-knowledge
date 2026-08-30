import React from 'react';
import { Lock } from 'lucide-react';

/**
 * Privacy notice: emphasizes that salaries are sealed and not readable by anyone,
 * including this page. Core to the project's claim about selective disclosure.
 */
export const PrivacyNotice: React.FC = () => {
  return (
    <div className="sealed-notice">
      <Lock size={20} />
      <div>
        <strong>Salary:</strong> 🔒 sealed — not readable by anyone, including this page
      </div>
    </div>
  );
};
