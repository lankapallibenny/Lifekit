/** Hash-based router. No dependency, works offline, survives a static host without rewrites. */

import { useEffect, useState } from 'react';

export interface RouteMatch {
  path: string;
  /** Path segments, e.g. ['learn', 'files-folders']. */
  segments: string[];
  query: URLSearchParams;
  hash: string;
}

export const ROUTES = {
  home: '/',
  money: '/money',
  planner: '/planner',
  learn: '/learn',
  career: '/career',
  safety: '/safety',
  community: '/community',
  notifications: '/notifications',
  notificationSettings: '/notifications/settings',
  settings: '/settings',
  tools: '/tools',
  about: '/about',
  privacy: '/privacy',
  licenses: '/licenses',
  backup: '/settings/backup',
} as const;

export function parseHash(hash: string): RouteMatch {
  const raw = (hash || '').replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const path = pathPart && pathPart.startsWith('/') ? pathPart : pathPart ? `/${pathPart}` : '/';
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : '/';
  return {
    path: clean,
    segments: clean.split('/').filter(Boolean),
    query: new URLSearchParams(queryPart ?? ''),
    hash: raw,
  };
}

export function useRoute(): RouteMatch {
  const [route, setRoute] = useState<RouteMatch>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

export function navigate(path: string, options: { replace?: boolean; query?: Record<string, string> } = {}): void {
  const search = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
  const target = `#${path}${search}`;
  if (options.replace) {
    const url = `${window.location.pathname}${window.location.search}${target}`;
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = target.slice(1);
  // Scroll to top on navigation, but not when the router only changed a query value.
  window.scrollTo({ top: 0, behavior: 'auto' });
}

/** Scrolls to an element by id after navigation (used by in-app links to sections). */
export function scrollToId(id: string): void {
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ block: 'start' });
      if (element instanceof HTMLElement && !element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
      }
      (element as HTMLElement).focus?.({ preventScroll: true });
    }
  });
}
