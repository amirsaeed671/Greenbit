import type { SVGProps } from 'react';

const base = (p: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...p,
});

export const IconGarden = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 20v-8" /><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7Z" /><path d="M12 14c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5Z" /><path d="M4 20h16" /></svg>
);
export const IconCalendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const IconSettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMinus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 12h14" /></svg>;
export const IconClose = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const IconLeft = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m15 18-6-6 6-6" /></svg>;
export const IconRight = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m9 18 6-6-6-6" /></svg>;
export const IconFlame = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-9-1 2-2 3-4 3 0-2 0-4-2-6-1 4-5 6-5 12 0 4 3 7 8 7Z" /></svg>
);
export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const IconToday = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="12" cy="15.5" r="2" /></svg>
);
export const IconUpcoming = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2" /></svg>
);
export const IconInbox = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z" /></svg>
);
export const IconNotes = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 3h9l4 4v14H6Z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></svg>
);
export const IconBrowse = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></svg>
);
export const IconHash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18" /></svg>;
export const IconTag = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
);
export const IconSync = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>
);
export const IconBug = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="7" y="8" width="10" height="12" rx="5" /><path d="M12 8v12M9 5l1.5 2M15 5l-1.5 2M4 13h3M17 13h3M5 8l2.5 1.5M19 8l-2.5 1.5M5 19l2.5-1.5M19 19l-2.5-1.5" /></svg>
);
