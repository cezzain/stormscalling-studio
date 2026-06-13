import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function S({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Search: (p: P) => (
    <S {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </S>
  ),
  Focus: (p: P) => (
    <S {...p}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </S>
  ),
  Chat: (p: P) => (
    <S {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </S>
  ),
  Manuscript: (p: P) => (
    <S {...p} strokeWidth={1.8}>
      <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4H11v16H4.5A1.5 1.5 0 0 1 3 18.5zM21 5.5A1.5 1.5 0 0 0 19.5 4H13v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </S>
  ),
  Codex: (p: P) => (
    <S {...p} strokeWidth={1.8}>
      <path d="M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z" />
      <path d="m14.5 9.5-1.8 4.2-4.2 1.8 1.8-4.2z" />
    </S>
  ),
  Timeline: (p: P) => (
    <S {...p} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </S>
  ),
  Map: (p: P) => (
    <S {...p} strokeWidth={1.8}>
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
      <path d="M9 4v13M15 6.5v13" />
    </S>
  ),
  Settings: (p: P) => (
    <S {...p} strokeWidth={1.8}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18 6l-2 2M8 16l-2 2M18 18l-2-2M8 8 6 6" />
    </S>
  ),
  Chevron: (p: P) => (
    <S {...p}>
      <path d="m6 9 6 6 6-6" />
    </S>
  ),
  Check: (p: P) => (
    <S {...p}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </S>
  ),
  Link: (p: P) => (
    <S {...p}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" />
    </S>
  ),
  Send: (p: P) => (
    <S {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </S>
  ),
  Import: (p: P) => (
    <S {...p}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </S>
  ),
  Sun: (p: P) => (
    <S {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
    </S>
  ),
  Moon: (p: P) => (
    <S {...p}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </S>
  ),
  Plus: (p: P) => (
    <S {...p}>
      <path d="M12 5v14M5 12h14" />
    </S>
  ),
  ListBullet: (p: P) => (
    <S {...p}>
      <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </S>
  ),
  ListOrdered: (p: P) => (
    <S {...p}>
      <path d="M10 6h10M10 12h10M10 18h10M4 6h.01M3.4 12H4.6M3.4 18H4.6" />
    </S>
  ),
  Pin: ({ size = 22, ...rest }: P) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="var(--clay)" stroke="var(--canvas)" strokeWidth={1.5} {...rest}>
      <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z" />
      <circle cx="12" cy="9" r="2.4" fill="var(--canvas)" stroke="none" />
    </svg>
  ),
  Close: (p: P) => (
    <S {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </S>
  ),
  Retry: (p: P) => (
    <S {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </S>
  ),
};
