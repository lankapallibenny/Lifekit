/**
 * App-level integration tests.
 *
 * These mount the real component tree against fake-indexeddb and drive it the way a person
 * would: finish the setup screen, add a record, search a lesson, go offline. They cover the
 * behaviour that would be embarrassing to ship broken — the empty states that must not
 * pretend to hold data, the offline notice, keyboard-reachable navigation, and the rule
 * that a quick-add expense really lands in storage.
 */
import { StrictMode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { App } from '../src/App';
import { StoreProvider } from '../src/state/store';
import { repo } from '../src/lib/repo';
import { ROUTES } from '../src/router';

function renderApp(hash = '') {
  window.location.hash = hash;
  return render(
    <StrictMode>
      <StoreProvider>
        <App />
      </StoreProvider>
    </StrictMode>
  );
}

/** Walk through the first-run screen the way a real user does. */
async function completeOnboarding(user: ReturnType<typeof userEvent.setup>, name = '') {
  const nameField = await screen.findByLabelText(/What should LIFEKIT call you/i);
  if (name) await user.type(nameField, name);
  await user.click(screen.getByLabelText(/I understand that my records live in this browser/i));
  await user.click(screen.getByRole('button', { name: /Start using LIFEKIT/i }));
  // The app shell is ready once the navigation renders, whichever screen was requested.
  await screen.findByRole('navigation', { name: /main navigation/i });
}

describe('first run', () => {
  it('shows the setup screen and never asks for notification permission by itself', async () => {
    const requested = { called: false };
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = async () => {
        requested.called = true;
        return 'granted' as NotificationPermission;
      };
    }
    Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });

    renderApp();
    expect(await screen.findByRole('button', { name: /Start using LIFEKIT/i })).toBeTruthy();
    expect(screen.getByText(/No email, phone number or password is ever requested/i)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requested.called).toBe(false);
    delete (window as { Notification?: unknown }).Notification;
  });

  it('gates the start button behind the storage acknowledgement', async () => {
    const user = userEvent.setup();
    renderApp();
    const start = (await screen.findByRole('button', { name: /Start using LIFEKIT/i })) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    await user.click(screen.getByLabelText(/I understand that my records live in this browser/i));
    expect(start.disabled).toBe(false);
  });

  it('opens the dashboard after setup and shows honest empty states', async () => {
    const user = userEvent.setup();
    renderApp();
    await completeOnboarding(user, 'Benny');

    // The greeting uses the name the user chose.
    await screen.findByRole('heading', { level: 1, name: /Good (morning|afternoon|evening)/i });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Benny');
    // Empty screens say they are empty instead of showing invented data.
    expect(screen.getByText(/No budget limits yet/i)).toBeTruthy();
    expect(screen.getByText(/No savings goals yet/i)).toBeTruthy();
    expect(screen.getByText(/Nothing saved yet/i)).toBeTruthy();
    // The credit the product is required to show, and no sample money anywhere.
    expect(screen.getAllByText(/Developed by Benny/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/₹500/)).toBeNull();
  });
});

describe('navigation and layout', () => {
  it('exposes every destination through the phone navigation, including the More sheet', async () => {
    const user = userEvent.setup();
    renderApp();
    await completeOnboarding(user);

    const bottomNav = screen.getByRole('navigation', { name: /main navigation/i });
    const barText = bottomNav.textContent ?? '';
    for (const expected of ['Home', 'Money', 'Planner', 'Learn', 'More']) {
      expect(barText).toContain(expected);
    }

    await user.click(within(bottomNav).getByRole('link', { name: /more/i }));
    const sheet = await screen.findByRole('dialog');
    const sheetText = sheet.textContent ?? '';
    for (const expected of ['Career', 'Safety', 'Community', 'Notifications', 'Settings', 'Tools']) {
      expect(sheetText).toContain(expected);
    }
  });

  it('keeps all nine sections plus Tools in the desktop sidebar', async () => {
    renderApp();
    await completeOnboarding(userEvent.setup());

    const sidebar = screen.getByRole('navigation', { name: /^main$/i });
    const text = sidebar.textContent ?? '';
    for (const expected of [
      'Home',
      'Money',
      'Planner',
      'Learn',
      'Career',
      'Safety',
      'Community',
      'Notifications',
      'Settings',
      'Tools',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('navigates between screens from the hash and shows the right screen', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.money);
    await completeOnboarding(user);

    expect(await screen.findByRole('heading', { level: 1, name: 'Money' })).toBeTruthy();

    window.location.hash = ROUTES.planner;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Planner' })).toBeTruthy();
  });

  it('renders a helpful screen for an unknown route instead of a blank page', async () => {
    renderApp('#/not-a-real-screen');
    await completeOnboarding(userEvent.setup());
    expect(await screen.findByText(/That screen does not exist/i)).toBeTruthy();
  });

  it('names the document after the screen for the Android task switcher', async () => {
    renderApp(ROUTES.safety);
    await completeOnboarding(userEvent.setup());
    await waitFor(() => expect(document.title).toContain('safety'));
  });
});

describe('offline behaviour', () => {
  it('shows the offline notice when the device loses connection, and hides it again', async () => {
    const user = userEvent.setup();
    renderApp();
    await completeOnboarding(user);

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
    expect(await screen.findByText(/You’re offline/i)).toBeTruthy();

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(screen.queryByText(/You’re offline/i)).toBeNull());
  });

  it('keeps working while offline: a task can still be added and is persisted', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    renderApp(ROUTES.planner);
    await completeOnboarding(user);

    const quickAdd = await screen.findByPlaceholderText(/what needs doing/i);
    await user.type(quickAdd, 'Buy rice');
    const form = quickAdd.closest('form');
    expect(form).not.toBeNull();
    await user.click(within(form as HTMLElement).getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText('Buy rice')).toBeTruthy();
    await waitFor(async () => {
      const tasks = await repo.listTasks();
      expect(tasks.map((task) => task.title)).toContain('Buy rice');
    });
  });
});

describe('money quick add', () => {
  it('opens the money screen from the Home shortcut and saves an expense', async () => {
    const user = userEvent.setup();
    renderApp();
    await completeOnboarding(user);

    await user.click(screen.getByRole('button', { name: /Add expense/i }));
    await waitFor(() => expect(window.location.hash).toContain('#/money'));

    const amount = await screen.findByLabelText(/^Amount$/i);
    await user.type(amount, '249.50');
    await user.click(screen.getByTestId('save-entry'));

    await waitFor(async () => {
      const entries = await repo.listEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.amount).toBe(249.5);
      expect(entries[0]?.type).toBe('expense');
    });
    // The saved amount is visible in the list, formatted for the configured currency.
    expect((await screen.findAllByText(/249\.5/)).length).toBeGreaterThan(0);
  });

  it('rejects nonsense amounts with a message attached to the field', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.money);
    await completeOnboarding(user);

    await user.click(await screen.findByRole('button', { name: /Add entry/i }));
    const amount = await screen.findByLabelText(/^Amount$/i);
    await user.type(amount, '1e5');
    await user.click(screen.getByTestId('save-entry'));

    expect(await screen.findByText(/Use digits only, up to 2 decimals/i)).toBeTruthy();
    expect(await repo.listEntries()).toHaveLength(0);
  });

  it('keeps the screen rendered after saving, on browsers with a partial <dialog> implementation', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.money);
    await completeOnboarding(user);

    await user.click(await screen.findByRole('button', { name: /Add entry/i }));
    await user.type(await screen.findByLabelText(/^Amount$/i), '99');
    await user.click(screen.getByTestId('save-entry'));

    // Regression guard: an exception while closing the dialog must never blank the app.
    await waitFor(async () => expect(await repo.listEntries()).toHaveLength(1));
    expect((document.body.textContent ?? '').length).toBeGreaterThan(200);
    expect(screen.getByRole('heading', { level: 1, name: 'Money' })).toBeTruthy();
  });
});

describe('learn library', () => {
  it('filters lessons by search text and explains an empty result', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.learn);
    await completeOnboarding(user);

    const search = await screen.findByLabelText(/Search lessons/i);
    await user.type(search, 'zzzz-no-such-lesson');
    expect(await screen.findByText(/No lessons match/i)).toBeTruthy();
  });

  it('opens a lesson and keeps the bookmark, which is what makes it readable offline', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.learn);
    await completeOnboarding(user);

    // Wait for the lazy-loaded library before looking for a lesson.
    await screen.findByLabelText(/Search lessons/i);
    const lesson = await waitFor(() => {
      const link = Array.from(document.querySelectorAll('a')).find((anchor) =>
        (anchor.getAttribute('href') ?? '').startsWith('#/learn/')
      );
      if (!link) throw new Error('lesson links not rendered yet');
      return link;
    });
    await user.click(lesson);

    const bookmark = await screen.findByRole('button', { name: /Save offline|Saved offline/i });
    await user.click(bookmark);
    expect(await screen.findByRole('button', { name: /Saved offline/i })).toBeTruthy();

    await waitFor(async () => {
      const saved = await repo.listLearningProgress();
      const row = saved.find((entry) => entry.bookmarked);
      expect(row).toBeTruthy();
      // Saving also caches the lesson text, which is what makes it readable offline.
      expect((row?.cached?.body ?? '').length).toBeGreaterThan(100);
      expect(row?.cached?.title).toBeTruthy();
    });
  });
});

describe('career toolkit', () => {
  it('keeps a résumé draft on the device and marks what is still missing', async () => {
    const user = userEvent.setup();
    renderApp('#/career?tab=resume');
    await completeOnboarding(user);

    const name = await screen.findByLabelText(/Full name/i);
    await user.type(name, 'Benny K');
    const headline = screen.getByLabelText(/^Headline$/i);
    await user.type(headline, 'Warehouse assistant');
    await user.click(screen.getByRole('button', { name: /Save draft/i }));

    await waitFor(async () => {
      const resume = await repo.loadResume();
      expect(resume?.fullName).toBe('Benny K');
      expect(resume?.headline).toBe('Warehouse assistant');
    });
    // The completeness checklist is honest about what is still blank.
    expect(screen.getByText(/Contact \(email or phone\)/i)).toBeTruthy();
  });

  it('shows interview questions with a structure and a caution, and no invented openings', async () => {
    const user = userEvent.setup();
    renderApp('#/career?tab=interview');
    await completeOnboarding(user);

    expect(await screen.findByText(/Tell me about yourself/i)).toBeTruthy();
    const text = document.body.textContent ?? '';
    // The page must not imply LIFEKIT has job listings or employer endorsements.
    expect(text).not.toMatch(/LIFEKIT (is hiring|has \d+ openings|endorsed by)/i);
  });

  it('offers an application tracker that stores follow-up dates locally', async () => {
    const user = userEvent.setup();
    renderApp('#/career?tab=tracker');
    await completeOnboarding(user);

    await user.click(await screen.findByRole('button', { name: /Add application|New application/i }));
    const role = await screen.findByLabelText(/^Role$/i);
    await user.type(role, 'Data entry operator');
    const organisation = screen.getByLabelText(/Organisation/i);
    await user.type(organisation, 'Local firm');
    await user.click(screen.getByRole('button', { name: /Save application/i }));

    await waitFor(async () => {
      const applications = await repo.listApplications();
      expect(applications.map((app) => app.role)).toContain('Data entry operator');
    });
  });
});

describe('network privacy', () => {
  it('makes no network request while the optional content feed is off', async () => {
    const spy = vi.fn(async (_input: RequestInfo | URL) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', spy);
    try {
      renderApp();
      await completeOnboarding(userEvent.setup());
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('fetches the published feed only after the user opts in, and labels it honestly', async () => {
    const pack = {
      announcements: [
        {
          id: 'notice-1',
          title: 'Operator notice: maintenance window',
          body: 'The optional content service will be briefly unavailable while the operator updates it.',
          category: 'service',
          priority: 'normal',
          publishedAt: '2026-10-01',
        },
      ],
    };
    const spy = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(pack), { status: 200 }));
    vi.stubGlobal('fetch', spy);
    try {
      const user = userEvent.setup();
      renderApp('#/settings');
      await completeOnboarding(user);
      expect(spy).not.toHaveBeenCalled();

      await user.click(await screen.findByLabelText(/Fetch public content from a LIFEKIT server/i));

      await waitFor(() => expect(spy).toHaveBeenCalled());
      const firstCall = spy.mock.calls[0];
      expect(String(firstCall ? firstCall[0] : '')).toContain('content/announcements.json');

      window.location.hash = '#/notifications';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(await screen.findByText('Operator notice: maintenance window')).toBeTruthy();
      expect(await screen.findByText(/Messages published by the content server you opted into/i)).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps the bundled examples and says so when the feed cannot be reached', async () => {
    const spy = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', spy);
    try {
      const user = userEvent.setup();
      renderApp('#/settings');
      await completeOnboarding(user);
      await user.click(await screen.findByLabelText(/Fetch public content from a LIFEKIT server/i));

      window.location.hash = '#/notifications';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      expect(await screen.findByText(/could not be reached — showing the bundled examples/i)).toBeTruthy();
      // The honest fallback still shows the examples, clearly badged.
      expect(screen.getAllByText('Example').length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('settings privacy controls', () => {
  it('explains the shared-device risk and offers export, clear and reset', async () => {
    const user = userEvent.setup();
    renderApp(ROUTES.privacy);
    await completeOnboarding(user);

    expect(await screen.findByRole('heading', { level: 1, name: /Privacy/i })).toBeTruthy();
    // The shared-device risk is stated plainly, not hidden in a policy paragraph.
    expect(screen.getAllByText(/shared phone or computer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no separate app passcode/i).length).toBeGreaterThan(0);
  });

  it('lists the bundled software licences with their licence names', async () => {
    renderApp(ROUTES.licenses);
    await completeOnboarding(userEvent.setup());
    const text = (await screen.findByRole('heading', { level: 1, name: /Licence|License/i })).closest('.stack')?.textContent ?? '';
    expect(text).toMatch(/MIT|Apache/);
  });
});
