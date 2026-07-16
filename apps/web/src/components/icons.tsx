import type { ReactNode, SVGProps } from 'react';

// Inline SVG icon set — zero dependency, offline-first. All icons share an 18px
// box, currentColor stroke, and a consistent 1.6 line width (Lucide-style).
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function FilesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h3.7l1.8 2H18.5A1.5 1.5 0 0 1 20 7.5v10A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.6-3.6" />
    </Icon>
  );
}

export function DiscussionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 4V6a1 1 0 0 1 1-1Z" />
    </Icon>
  );
}

export function VersionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 8v4l2.5 2.5" />
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5v3.4h3.4" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 12a7.4 7.4 0 0 0-.1-1.3l1.7-1.3-1.7-3-2 .8a7.3 7.3 0 0 0-2.2-1.3L14.5 3h-3.4l-.3 2.1a7.3 7.3 0 0 0-2.2 1.3l-2-.8-1.7 3 1.7 1.3a7.4 7.4 0 0 0 0 2.6L2.6 15l1.7 3 2-.8a7.3 7.3 0 0 0 2.2 1.3l.3 2.1h3.4l.3-2.1a7.3 7.3 0 0 0 2.2-1.3l2 .8 1.7-3-1.7-1.3a7.4 7.4 0 0 0 .1-1.3Z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Icon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Icon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 13.5A7.5 7.5 0 1 1 10.5 4a6 6 0 0 0 9.5 9.5Z" />
    </Icon>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20h6M12 16.5V20" />
    </Icon>
  );
}

export function TypographyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 7V5.5h14V7M12 5.5V19M9.5 19h5" />
    </Icon>
  );
}

export function GraphIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="16" cy="17.5" r="2.5" />
      <path d="M8.2 7.2 15.6 6M8 7.6l6.4 8.4" />
    </Icon>
  );
}
