import { useId } from 'react';

export function LogoMark({ size = 36, title = 'Greenbit' }: { size?: number; title?: string }) {
  const gid = `gb-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={title}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3BA368" />
          <stop offset="1" stopColor="#1C5E3D" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gid})`} />
      <path d="M256 384 C256 330 254 290 262 236" fill="none" stroke="#fff" strokeWidth="22" strokeLinecap="round" />
      <path d="M252 300 C200 304 142 276 124 206 C190 196 240 226 252 300 Z" fill="#F2FAF4" />
      <path d="M262 240 C268 170 318 112 402 108 C404 190 348 240 262 240 Z" fill="#F2FAF4" />
      <path d="M246 292 C214 270 182 246 150 214" fill="none" stroke="#3BA368" strokeWidth="7" strokeLinecap="round" opacity=".55" />
      <path d="M270 232 C310 204 344 170 380 130" fill="none" stroke="#3BA368" strokeWidth="7" strokeLinecap="round" opacity=".55" />
      <rect x="220" y="372" width="72" height="72" rx="16" fill="#F4BE4F" />
    </svg>
  );
}

export const AUTHOR = { name: 'Amir Ali', url: 'https://amir-ali.me' };

export function Credit({ className = 'credit' }: { className?: string }) {
  return (
    <p className={className}>
      Crafted with care by{' '}
      <a href={AUTHOR.url} target="_blank" rel="noopener noreferrer">
        {AUTHOR.name}
      </a>
    </p>
  );
}
