import React from 'react';

export type IconName =
  | 'home'
  | 'search'
  | 'library'
  | 'settings'
  | 'play'
  | 'pause'
  | 'next'
  | 'prev'
  | 'forward10'
  | 'back10'
  | 'shuffle'
  | 'repeat'
  | 'repeat-one'
  | 'heart'
  | 'heart-outline'
  | 'lyrics'
  | 'download'
  | 'check-circle'
  | 'trash'
  | 'plus'
  | 'playlist'
  | 'queue'
  | 'moon'
  | 'sun'
  | 'share'
  | 'copy'
  | 'clock'
  | 'speed'
  | 'sync'
  | 'telegram'
  | 'upload'
  | 'close'
  | 'chevron-down'
  | 'chevron-left'
  | 'sparkles'
  | 'external'
  | 'phone'
  | 'music'
  | 'wifi-off';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.9,
}) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block', flexShrink: 0 },
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h4.5v-6h3v6H18a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7.5" />
          <path d="M20.5 20.5l-4.2-4.2" />
        </svg>
      );
    case 'library':
      return (
        <svg {...common}>
          <path d="M4 19.5V5.5A1.5 1.5 0 0 1 5.5 4h2A1.5 1.5 0 0 1 9 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 4 19.5z" />
          <path d="M12 19.5V7.5A1.5 1.5 0 0 1 13.5 6h2A1.5 1.5 0 0 1 17 7.5v12a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 12 19.5z" />
          <path d="M20 19.5v-8" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M7 5.2c0-1.15 1.25-1.86 2.24-1.27l10.2 6.05c.97.57.97 1.97 0 2.54l-10.2 6.05C8.25 19.16 7 18.45 7 17.3V5.2z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common} fill={color} stroke="none">
          <rect x="6" y="4.5" width="4.4" height="15" rx="1.6" />
          <rect x="13.6" y="4.5" width="4.4" height="15" rx="1.6" />
        </svg>
      );
    case 'next':
      return (
        <svg {...common} fill={color} stroke={color}>
          <path d="M5 5.8v12.4c0 .7.75 1.13 1.35.78l9.2-5.4a.9.9 0 0 0 0-1.56l-9.2-5.4A.9.9 0 0 0 5 5.8z" stroke="none" />
          <path d="M18.5 5.5v13" strokeWidth={2.3} />
        </svg>
      );
    case 'prev':
      return (
        <svg {...common} fill={color} stroke={color}>
          <path d="M19 5.8v12.4c0 .7-.75 1.13-1.35.78l-9.2-5.4a.9.9 0 0 1 0-1.56l9.2-5.4c.6-.35 1.35.08 1.35.78z" stroke="none" />
          <path d="M5.5 5.5v13" strokeWidth={2.3} />
        </svg>
      );
    case 'forward10':
      return (
        <svg {...common}>
          <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
          <path d="M19.5 4.5V9H15" />
          <path d="M10.5 10.5v4" />
          <rect x="12.8" y="10.5" width="2.4" height="4" rx="1" />
        </svg>
      );
    case 'back10':
      return (
        <svg {...common}>
          <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
          <path d="M4.5 4.5V9H9" />
          <path d="M10.5 10.5v4" />
          <rect x="12.8" y="10.5" width="2.4" height="4" rx="1" />
        </svg>
      );
    case 'shuffle':
      return (
        <svg {...common}>
          <path d="M16 3h5v5" />
          <path d="M4 20L21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
      );
    case 'repeat':
      return (
        <svg {...common}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case 'repeat-one':
      return (
        <svg {...common}>
          <path d="M17 2l4 4-4 4" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <path d="M7 22l-4-4 4-4" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          <path d="M12 10v5" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...common} fill={color} stroke="none">
          <path d="M12 20.6l-1.45-1.32C5.4 14.62 2 11.53 2 7.75 2 4.66 4.42 2.25 7.5 2.25c1.74 0 3.41.81 4.5 2.09a5.98 5.98 0 0 1 4.5-2.09c3.08 0 5.5 2.41 5.5 5.5 0 3.78-3.4 6.87-8.55 11.54L12 20.6z" />
        </svg>
      );
    case 'heart-outline':
      return (
        <svg {...common}>
          <path d="M12 20.2l-1.35-1.23C5.8 14.6 2.6 11.7 2.6 8.15 2.6 5.25 4.85 3 7.75 3c1.65 0 3.22.77 4.25 1.98C13.03 3.77 14.6 3 16.25 3 19.15 3 21.4 5.25 21.4 8.15c0 3.55-3.2 6.45-8.05 10.82L12 20.2z" />
        </svg>
      );
    case 'lyrics':
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 11h12" />
          <path d="M4 16h8" />
          <circle cx="17.5" cy="17.5" r="2.2" />
          <path d="M19.7 17.5V11l2.3-.7" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="M7.5 10.5L12 15l4.5-4.5" />
          <path d="M4 19.5h16" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 12.2l2.3 2.3 4.8-5" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9.5 4h5" />
          <path d="M6.5 7l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case 'playlist':
      return (
        <svg {...common}>
          <path d="M4 6h12" />
          <path d="M4 11h12" />
          <path d="M4 16h7" />
          <path d="M16 14v6" />
          <path d="M13 17h6" />
        </svg>
      );
    case 'queue':
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
          <path d="M18 16l3 2-3 2v-4z" fill={color} stroke="none" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </svg>
      );
    case 'share':
      return (
        <svg {...common}>
          <circle cx="18" cy="5.5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="18.5" r="2.5" />
          <path d="M8.3 13.2l7.4 4.1M15.7 6.7l-7.4 4.1" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h9.5A1.5 1.5 0 0 1 15 4v1" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </svg>
      );
    case 'speed':
      return (
        <svg {...common}>
          <path d="M4.5 16.5a8.5 8.5 0 1 1 15 0" />
          <path d="M12 14l4-4" />
          <circle cx="12" cy="14.5" r="1.4" fill={color} stroke="none" />
        </svg>
      );
    case 'sync':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.5-4.7L3.5 8.5" />
          <path d="M3.5 4v4.5H8" />
          <path d="M4 13a8 8 0 0 0 14.5 4.7l2-2.2" />
          <path d="M20.5 20v-4.5H16" />
        </svg>
      );
    case 'telegram':
      return (
        <svg {...common}>
          <path d="M21 4.5L3 11.4l6.3 2.1L18 7.8l-6.4 7.1.3 4.6 3-3.1 4.1 2.9L21 4.5z" />
        </svg>
      );
    case 'upload':
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="M7.5 8.5L12 4l4.5 4.5" />
          <path d="M4 19.5h16" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      );
    case 'chevron-left':
      return (
        <svg {...common}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3z" />
          <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
        </svg>
      );
    case 'external':
      return (
        <svg {...common}>
          <path d="M14 4h6v6" />
          <path d="M10 14L20 4" />
          <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M10.5 18.2h3" />
        </svg>
      );
    case 'music':
      return (
        <svg {...common}>
          <path d="M9 18V6l11-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="17.5" cy="16" r="2.5" />
        </svg>
      );
    case 'wifi-off':
      return (
        <svg {...common}>
          <path d="M3 3l18 18" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <path d="M12 20h.01" />
          <path d="M5 12.8a10 10 0 0 1 5.2-2.6" />
          <path d="M16.5 11.2a10 10 0 0 1 2.5 1.6" />
        </svg>
      );
  }
};

