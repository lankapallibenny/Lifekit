/**
 * LIFEKIT layout: persistent sidebar on tablets/desktop, compact bottom navigation on
 * phones, sticky app bar with the offline indicator, and the developer credit footer.
 *
 * Navigation has exactly one definition (`NAV_ITEMS`), so a route cannot exist in the
 * sidebar but be missing on mobile. Phones show the five most-used destinations plus a
 * "More" sheet containing the remaining four, and the sheet marks itself as active when
 * the current route lives inside it.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Icon, BrandMark, type IconName } from './Icons';
import { Badge, Dialog, IconButton } from './ui';
import { ROUTES, navigate, useRoute } from '../router';
import { useStore } from '../state/store';
import { APP_NAME, APP_TAGLINE, DEVELOPER_CREDIT } from '../lib/defaults';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  /** True when this item is one of the five shown in the phone bottom bar. */
  primary: boolean;
  /** Additional path prefixes that should highlight this item. */
  match?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { path: ROUTES.home, label: 'Home', icon: 'home', primary: true },
  { path: ROUTES.money, label: 'Money', icon: 'wallet', primary: true },
  { path: ROUTES.planner, label: 'Planner', icon: 'check-square', primary: true },
  { path: ROUTES.learn, label: 'Learn', icon: 'book', primary: true, match: ['/learn'] },
  { path: ROUTES.career, label: 'Career', icon: 'briefcase', primary: false },
  { path: ROUTES.safety, label: 'Safety', icon: 'shield', primary: false },
  { path: ROUTES.community, label: 'Community', icon: 'users', primary: false },
  { path: ROUTES.notifications, label: 'Notifications', icon: 'bell', primary: false, match: ['/notifications'] },
  { path: ROUTES.settings, label: 'Settings', icon: 'settings', primary: false, match: ['/settings', '/about', '/privacy', '/licenses'] },
];

export const TOOLS_ITEM: NavItem = { path: ROUTES.tools, label: 'Tools', icon: 'calculator', primary: false };

function isActive(item: NavItem, path: string): boolean {
  const candidates = [item.path, ...(item.match ?? [])];
  return candidates.some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
}

function unreadAnnouncements(count: number): ReactNode {
  if (count <= 0) return null;
  return (
    <span className="nav-badge" aria-hidden="true">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }): JSX.Element {
  const route = useRoute();
  const { online, storage, settings, announcements, data, pendingReminders } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const readIds = new Set(data.announcementsRead.map((a) => a.id));
  const unread = announcements.filter((a) => !readIds.has(a.id)).length;
  const overdue = pendingReminders.filter((r) => r.kind === 'due').length;

  // Close the "More" sheet whenever the route changes, so navigation always feels finished.
  useEffect(() => {
    setMoreOpen(false);
  }, [route.path]);

  const moreIsActive = [...NAV_ITEMS.filter((i) => !i.primary), TOOLS_ITEM].some((item) => isActive(item, route.path));
  const primaryItems = NAV_ITEMS.filter((item) => item.primary);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="app-body">
        <nav className="sidebar" aria-label="Main">
          <a className="brand" href={`#${ROUTES.home}`} aria-label={`${APP_NAME} home`}>
            <BrandMark size={40} />
            <span className="brand-text">
              <span className="brand-name">{APP_NAME}</span>
              <span className="brand-tagline">{APP_TAGLINE}</span>
            </span>
          </a>
          <ul className="nav-list">
            {[...NAV_ITEMS, TOOLS_ITEM].map((item) => (
              <li key={item.path}>
                <a
                  className="nav-link"
                  href={`#${item.path}`}
                  aria-current={isActive(item, route.path) ? 'page' : undefined}
                >
                  <Icon name={item.icon} size={20} />
                  {item.label}
                  {item.path === ROUTES.notifications ? unreadAnnouncements(unread) : null}
                </a>
              </li>
            ))}
          </ul>
          <div className="sidebar-footer">
            <p style={{ margin: 0, color: '#8aa0b8' }} className="tiny">
              No accounts. No AI. No bank connections. Your records stay on this device.
            </p>
          </div>
        </nav>

        <div className="main-area">
          <header className="app-bar no-print">
            <a className="row" href={`#${ROUTES.home}`} style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}>
              <BrandMark size={30} className="brand-mark" />
              <span className="app-bar-title">{APP_NAME}</span>
            </a>
            <div className="app-bar-spacer">
              <span className="online-pill" data-online={online} role="status">
                <span className="status-dot" aria-hidden="true" />
                {online ? 'Online' : 'Offline'}
              </span>
              <IconButton
                icon="settings"
                label="Settings"
                className="no-print"
                onClick={() => navigate(ROUTES.settings)}
              />
            </div>
          </header>

          <main className="content" id="main-content" tabIndex={-1}>
            {!storage.persistent ? (
              <div className="notice notice-warning" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
                <Icon name="warning" size={20} />
                <div>
                  <strong>Storage is not available on this device.</strong> LIFEKIT is running in memory-only mode, so
                  anything you enter disappears when this tab closes. Do not enter real records here — try a normal (non
                  private) browsing window, or a different browser.
                </div>
              </div>
            ) : null}
            {overdue > 0 ? (
              <div className="notice notice-warning" style={{ marginBottom: 'var(--space-4)' }}>
                <Icon name="warning" size={20} />
                <div>
                  <strong>
                    {overdue} task{overdue === 1 ? '' : 's'} past the due date.
                  </strong>{' '}
                  <a href={`#${ROUTES.planner}`}>Open the planner</a> to reschedule or complete them.
                </div>
              </div>
            ) : null}
            {children}
          </main>

          <footer className="app-footer no-print">
            <p style={{ margin: '0 0 4px' }}>
              {APP_NAME} · {APP_TAGLINE} · v{/* built version */}1.0.0
            </p>
            <p style={{ margin: 0 }}>
              Works offline. No tracking. No AI.{' '}
              <a href={`#${ROUTES.privacy}`}>Privacy</a> · <a href={`#${ROUTES.licenses}`}>Licenses</a> ·{' '}
              <a href={`#${ROUTES.about}`}>About</a>
            </p>
            <p className="footer-credit" style={{ marginTop: 8 }}>
              {DEVELOPER_CREDIT}
            </p>
            {settings.displayName ? (
              <p className="tiny" style={{ marginTop: 4 }}>
                Signed in as nothing — LIFEKIT has no accounts. Local profile label: {settings.displayName}
              </p>
            ) : null}
          </footer>
        </div>
      </div>

      <nav className="bottom-nav no-print" aria-label="Main navigation">
        {primaryItems.map((item) => (
          <a key={item.path} href={`#${item.path}`} aria-current={isActive(item, route.path) ? 'page' : undefined}>
            <Icon name={item.icon} size={24} />
            {item.label}
          </a>
        ))}
        <a href="#more" aria-expanded={moreOpen} data-active={moreIsActive} onClick={(event) => { event.preventDefault(); setMoreOpen(true); }}>
          <Icon name="list" size={24} />
          More
          {unread > 0 ? <span className="visually-hidden">{unread} unread announcements</span> : null}
        </a>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="All LIFEKIT sections or tools" variant="sheet">
        <div className="grid grid-2">
          {[...NAV_ITEMS, TOOLS_ITEM].map((item) => (
            <a
              key={item.path}
              className="card row"
              href={`#${item.path}`}
              style={{ textDecoration: 'none', color: 'inherit', gap: 10, padding: 12 }}
              aria-current={isActive(item, route.path) ? 'page' : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <Icon name={item.icon} size={22} />
              <span className="grow" style={{ fontWeight: 600 }}>
                {item.label}
              </span>
              {item.path === ROUTES.notifications && unread > 0 ? (
                <Badge tone="accent">{unread} new</Badge>
              ) : null}
            </a>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 12 }}>
          Tip: on a phone, all nine sections plus Tools are reachable from this sheet. On a larger screen they are in the
          sidebar.
        </p>
      </Dialog>
    </div>
  );
}
