/**
 * Routing tests.
 *
 * The app is a single HTML file served from a static host, so every screen has to be
 * addressable from the hash alone: `index.html#/money?quick=expense` must open the money
 * screen with the quick-add form already in expense mode. These tests cover the parsing
 * rules that the manifest shortcuts, in-app links and reminders all depend on.
 */
import { describe, expect, it } from 'vitest';
import { ROUTES, navigate, parseHash } from '../src/router';

describe('parseHash', () => {
  it('treats an empty hash as Home', () => {
    const route = parseHash('');
    expect(route.path).toBe('/');
    expect(route.segments).toEqual([]);
  });

  it('reads a plain screen path', () => {
    expect(parseHash('#/money').path).toBe('/money');
    expect(parseHash('#/planner').path).toBe('/planner');
    expect(parseHash('#/notifications/settings').path).toBe('/notifications/settings');
  });

  it('reads query values used by quick actions', () => {
    const route = parseHash('#/money?quick=expense');
    expect(route.path).toBe('/money');
    expect(route.query.get('quick')).toBe('expense');

    const tools = parseHash('#/tools?tab=converter');
    expect(tools.query.get('tab')).toBe('converter');
  });

  it('keeps deep lesson links working offline', () => {
    const route = parseHash('#/learn/budgeting-basics');
    expect(route.path).toBe('/learn/budgeting-basics');
    expect(route.segments).toEqual(['learn', 'budgeting-basics']);
  });

  it('is forgiving about a missing leading slash and trailing slashes', () => {
    expect(parseHash('#money').path).toBe('/money');
    expect(parseHash('#/money/').path).toBe('/money');
    expect(parseHash('#/money///').path).toBe('/money');
  });

  it('tolerates a hash that is just "#"', () => {
    expect(parseHash('#').path).toBe('/');
  });

  it('matches every route the manifest and navigation reference', () => {
    for (const path of Object.values(ROUTES)) {
      expect(parseHash(`#${path}`).path).toBe(path);
    }
  });

  it('leaves an unknown screen for the not-found view to handle', () => {
    const route = parseHash('#/definitely-not-a-screen');
    expect(route.path).toBe('/definitely-not-a-screen');
    expect(Object.values(ROUTES)).not.toContain(route.path);
  });
});

describe('navigate', () => {
  it('writes the hash so a reload lands on the same screen', () => {
    navigate(ROUTES.planner);
    expect(window.location.hash).toBe('#/planner');
    expect(parseHash(window.location.hash).path).toBe('/planner');
  });

  it('appends query values', () => {
    navigate(ROUTES.money, { query: { quick: 'income' } });
    const route = parseHash(window.location.hash);
    expect(route.path).toBe('/money');
    expect(route.query.get('quick')).toBe('income');
  });

  it('replaces history when asked, so Back does not bounce between tabs', () => {
    navigate(ROUTES.home);
    navigate(ROUTES.settings, { replace: true });
    expect(parseHash(window.location.hash).path).toBe('/settings');
  });
});
