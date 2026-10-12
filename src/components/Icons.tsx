/**
 * LIFEKIT icon set — original line icons drawn on a 24x24 grid.
 *
 * They are hand-written paths, not copied from any icon library, so the whole visual
 * language of the app is first-party. Every icon is decorative by default and hidden
 * from assistive technology; the accessible name always comes from adjacent text.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'wallet'
  | 'check-square'
  | 'book'
  | 'briefcase'
  | 'shield'
  | 'users'
  | 'bell'
  | 'settings'
  | 'plus'
  | 'minus'
  | 'download'
  | 'upload'
  | 'trash'
  | 'edit'
  | 'search'
  | 'check'
  | 'close'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-left'
  | 'cloud-off'
  | 'cloud'
  | 'sun'
  | 'moon'
  | 'calculator'
  | 'timer'
  | 'note'
  | 'list'
  | 'arrow-left'
  | 'external'
  | 'info'
  | 'warning'
  | 'bookmark'
  | 'print'
  | 'calendar'
  | 'target'
  | 'repeat'
  | 'filter'
  | 'sparkle'
  | 'lock'
  | 'wifi';

const PATHS: Record<IconName, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z',
  wallet: 'M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9h13M16.5 13.5h.01',
  'check-square': 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM8 12.5l2.5 2.5L16 9.5',
  book: 'M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5zM5 5.5V20.5M9 8h6M9 11.5h4',
  briefcase: 'M4 8.5h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM9 8.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2.5M4 13h16',
  shield: 'M12 3.5 5.5 6v6c0 4 2.8 7.1 6.5 8.5 3.7-1.4 6.5-4.5 6.5-8.5V6zM9.5 12l2 2 3.5-3.5',
  users: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M3.5 19.5c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M16 8.2a2.6 2.6 0 1 1 0 5.2M17.5 15.3c1.6.6 2.6 2 3 4.2',
  bell: 'M12 4a5.5 5.5 0 0 0-5.5 5.5v3.2L5 16.5h14l-1.5-3.8V9.5A5.5 5.5 0 0 0 12 4M10 19.5a2.2 2.2 0 0 0 4 0',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M12 3.5v2M12 18.5v2M4.9 7.8l1.7 1M17.4 15.2l1.7 1M4.9 16.2l1.7-1M17.4 8.8l1.7-1',
  plus: 'M12 5.5v13M5.5 12h13',
  minus: 'M5.5 12h13',
  download: 'M12 4.5v10M8 11l4 4 4-4M5 19.5h14',
  upload: 'M12 19.5v-10M8 13.5l4-4 4 4M5 4.5h14',
  trash: 'M5 7.5h14M9.5 7.5V5.8A1.3 1.3 0 0 1 10.8 4.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M7 7.5l.8 11a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l.8-11M10.5 11v6M13.5 11v6',
  edit: 'M15.5 5.5 18.5 8.5 9 18H6v-3zM14 7l3 3',
  search: 'M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6M15.8 15.8 20 20',
  check: 'M5 12.5 9.5 17 19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  'chevron-right': 'M9.5 6l6 6-6 6',
  'chevron-down': 'M6 9.5l6 6 6-6',
  'chevron-left': 'M14.5 6l-6 6 6 6',
  'cloud-off': 'M4 4l16 16M7 7.5A5 5 0 0 0 8 17h8.5M9.5 4.7A5.5 5.5 0 0 1 17.4 9.4a3.5 3.5 0 0 1 2.4 6',
  cloud: 'M7.5 18h9a3.5 3.5 0 0 0 .4-7A5.5 5.5 0 0 0 7 9.5 4.2 4.2 0 0 0 7.5 18',
  sun: 'M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4M12 3v2M12 19v2M4.9 7.9l1.4 1.4M17.7 14.7l1.4 1.4M4.9 16.1l1.4-1.4M17.7 9.3l1.4-1.4',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5',
  calculator: 'M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5M8 8h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01',
  timer: 'M12 20.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15M12 9.5v4l2.5 1.5M9.5 3.5h5',
  note: 'M6.5 4.5h11a1 1 0 0 1 1 1v10l-4 4h-8a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1M14.5 19.5v-4h4M8.5 8.5h7M8.5 12h4',
  list: 'M8 6.5h11M8 12h11M8 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01',
  'arrow-left': 'M10 6l-6 6 6 6M4 12h16',
  external: 'M14 4.5h5.5V10M19 5 11 13M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10',
  info: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 11v5.5M12 7.8h.01',
  warning: 'M12 4.5 3.5 19h17zM12 9.5v4M12 16.5h.01',
  bookmark: 'M7 4.5h10a1 1 0 0 1 1 1v14l-6-3.5-6 3.5v-14a1 1 0 0 1 1-1',
  print: 'M7 9.5V4.5h10v5M7 17.5H5.5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H17M7 14h10v5.5H7z',
  calendar: 'M5 6.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1M4 11h16M8.5 4v4M15.5 4v4',
  target: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9M12 13.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4',
  repeat: 'M4.5 9.5A5 5 0 0 1 9.5 5h7M14.5 2.5 17 5l-2.5 2.5M19.5 14.5a5 5 0 0 1-5 4.5h-7M9.5 21.5 7 19l2.5-2.5',
  filter: 'M4.5 6.5h15l-6 7v5l-3 1.5v-6.5z',
  sparkle: 'M12 4.5l1.6 4.1 4.1 1.6-4.1 1.6L12 15.9l-1.6-4.1L6.3 10.2l4.1-1.6zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  lock: 'M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5M6 10.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1M12 14v2.5',
  wifi: 'M4.5 9.5a11 11 0 0 1 15 0M7.5 12.8a7 7 0 0 1 9 0M10.5 16a3 3 0 0 1 3 0M12 19h.01',
};

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
  /** Set when the icon is the only content of a control and needs its own label. */
  title?: string;
}

export function Icon({ name, size = 24, title, ...rest }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={rest.className ?? 'nav-icon'}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The LIFEKIT logo mark: three ascending bars and the mint life-dot. */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className ?? 'brand-mark'}
      role="img"
      aria-label="LIFEKIT"
    >
      <rect width="512" height="512" rx="112" fill="#0B1F3A" />
      <rect x="132" y="292" width="62" height="96" rx="31" fill="#FFFFFF" opacity="0.92" />
      <rect x="225" y="232" width="62" height="156" rx="31" fill="#FFFFFF" />
      <rect x="318" y="160" width="62" height="228" rx="31" fill="#2FE0A8" />
      <circle cx="349" cy="112" r="26" fill="#2FE0A8" />
    </svg>
  );
}
