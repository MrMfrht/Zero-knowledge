/**
 * NightShift Design Tokens
 * Shared theme configuration for all apps
 */

export const designTokens = {
  // Colors
  colors: {
    bg: {
      dark: '#0b0f19',
      DEFAULT: '#111827',
      light: '#1f2937',
      lighter: '#374151',
    },
    text: {
      primary: '#f3f4f6',
      secondary: '#9ca3af',
      muted: '#6b7280',
    },
    accent: {
      indigo: '#6366f1',
      purple: '#a855f7',
      cyan: '#06b6d4',
      emerald: '#10b981',
      amber: '#f59e0b',
      rose: '#f43f5e',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#f43f5e',
      pending: '#f59e0b',
    },
  },

  // Spacing scale (Tailwind compatible)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px',
  },

  // Border radius
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },

  // Typography
  fonts: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Monaco", monospace',
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    glow: '0 0 20px rgba(99, 102, 241, 0.4)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '200ms ease-in-out',
    slow: '300ms ease-in-out',
  },
};

export type DesignTokens = typeof designTokens;
