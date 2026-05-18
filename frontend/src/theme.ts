// ── UPSA Brand Theme: "UPSA Light" ──
// University of Professional Studies, Accra

export const theme = {
  // Core Brand
  navy: '#00004E',
  gold: '#FFB606',
  orange: '#F27229',
  darkSlate: '#29344B',

  // Functional
  success: '#0F766E',
  successLight: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerBorder: '#FCA5A5',
  info: '#3C62EB',
  infoLight: '#DBEAFE',
  infoBorder: '#BFDBFE',
  warning: '#92400E',
  warningLight: '#FFFBEB',
  warningBorder: '#FCD34D',

  // Neutrals
  white: '#FFFFFF',
  bg: '#06062B',
  cardBg: 'rgba(14,14,58,0.92)',
  textPrimary: '#E2E8F0',
  textSecondary: '#8892B0',
  textMuted: '#64748B',
  border: 'rgba(255,255,255,0.08)',
  borderFocus: '#FFB606',

  // Gradients
  gradientBg: 'linear-gradient(180deg, #06062B 0%, #0E0E3A 50%, #080820 100%)',
  gradientHero: 'linear-gradient(135deg, #00004E 0%, #1E3A8A 50%, #F27229 100%)',

  // Shadows
  shadowSm: '0 2px 8px rgba(0,0,0,0.25)',
  shadowMd: '0 4px 20px rgba(0,0,0,0.30)',
  shadowLg: '0 10px 20px -5px rgba(0,0,0,0.35)',
  shadowXl: '0 20px 25px -5px rgba(0,0,0,0.40)',

  // Radii
  radiusSm: '12px',
  radiusMd: '14px',
  radiusLg: '16px',
  radiusXl: '20px',

  // Spacing scale
  space: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    xxl: '2rem',
    xxxl: '2.5rem',
  },

  // Transitions
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  transitionSlow: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',

  // Typography
  fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
} as const;

// ── Reusable Style Helpers ──

export const cardStyle = (elevated = false): React.CSSProperties => ({
  background: theme.cardBg,
  borderRadius: theme.radiusLg,
  padding: theme.space.xl,
  boxShadow: elevated ? theme.shadowMd : theme.shadowSm,
  border: `1px solid ${theme.border}`,
  transition: theme.transition,
});

export const primaryButton: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  backgroundColor: theme.orange,
  color: theme.white,
  border: 'none',
  borderRadius: theme.radiusMd,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.95rem',
  transition: theme.transition,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
};

export const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: theme.navy,
};

export const goldButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: theme.gold,
  color: theme.navy,
};

export const successButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: theme.success,
};

export const dangerButton: React.CSSProperties = {
  ...primaryButton,
  backgroundColor: theme.danger,
};

export const outlineButton: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  backgroundColor: 'transparent',
  color: theme.navy,
  border: `2px solid ${theme.gold}`,
  borderRadius: theme.radiusMd,
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.95rem',
  transition: theme.transition,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radiusMd,
  fontSize: '0.95rem',
  transition: theme.transition,
  backgroundColor: theme.white,
  color: theme.textPrimary,
  boxSizing: 'border-box' as const,
  outline: 'none',
};

export const pillBadge = (color: string, bg: string): React.CSSProperties => ({
  padding: '0.25rem 0.75rem',
  borderRadius: '9999px',
  fontSize: '0.8rem',
  fontWeight: 500,
  color,
  backgroundColor: bg,
});

export const pageWrapper: React.CSSProperties = {
  minHeight: 'calc(100vh - 68px)',
  width: '100%',
  background: theme.gradientBg,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  padding: theme.space.xxl,
};

export const contentContainer: React.CSSProperties = {
  maxWidth: '1280px',
  margin: '0 auto',
};

export const pageTitle: React.CSSProperties = {
  fontSize: '2.25rem',
  margin: 0,
  color: theme.navy,
  fontWeight: 700,
};

export const pageSubtitle: React.CSSProperties = {
  color: theme.textSecondary,
  marginTop: '0.5rem',
  fontSize: '1rem',
};
