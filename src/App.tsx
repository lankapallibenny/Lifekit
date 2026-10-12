/**
 * Application shell.
 *
 * Responsibilities kept here on purpose:
 *  - routing (hash based, so a static host with no rewrite rules works),
 *  - code splitting, so a budget Android phone downloads only the screen it opened,
 *  - the first-run onboarding gate,
 *  - the "update ready" banner, which never reloads the app behind the user's back.
 *
 * Screens are lazy loaded with named imports; Home and Onboarding stay eager because they
 * are what almost every session starts with.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Button, EmptyState, LoadingBlock, Notice, Toasts } from './components/ui';
import { ROUTES, navigate, useRoute } from './router';
import { useStore } from './state/store';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { APP_NAME } from './lib/defaults';

const loadMoney = () => import('./pages/Money').then((m) => ({ default: m.Money }));
const loadPlanner = () => import('./pages/Planner').then((m) => ({ default: m.Planner }));
const loadLearn = () => import('./pages/Learn').then((m) => ({ default: m.Learn }));
const loadCareer = () => import('./pages/Career').then((m) => ({ default: m.Career }));
const loadSafety = () => import('./pages/Safety').then((m) => ({ default: m.Safety }));
const loadCommunity = () => import('./pages/Community').then((m) => ({ default: m.Community }));
const loadTools = () => import('./pages/Tools').then((m) => ({ default: m.Tools }));
const loadNotifications = () => import('./pages/Notifications').then((m) => ({ default: m.Notifications }));
const loadNotificationSettings = () =>
  import('./pages/Notifications').then((m) => ({ default: m.NotificationSettings }));
const loadSettings = () => import('./pages/Settings').then((m) => ({ default: m.SettingsPage }));
const loadBackup = () => import('./pages/Settings').then((m) => ({ default: m.BackupPage }));
const loadAbout = () => import('./pages/Settings').then((m) => ({ default: m.AboutPage }));
const loadPrivacy = () => import('./pages/Settings').then((m) => ({ default: m.PrivacyPage }));
const loadLicenses = () => import('./pages/Settings').then((m) => ({ default: m.LicensesPage }));

const Money = lazy(loadMoney);
const Planner = lazy(loadPlanner);
const Learn = lazy(loadLearn);
const Career = lazy(loadCareer);
const Safety = lazy(loadSafety);
const Community = lazy(loadCommunity);
const Tools = lazy(loadTools);
const Notifications = lazy(loadNotifications);
const NotificationSettings = lazy(loadNotificationSettings);
const SettingsPage = lazy(loadSettings);
const BackupPage = lazy(loadBackup);
const AboutPage = lazy(loadAbout);
const PrivacyPage = lazy(loadPrivacy);
const LicensesPage = lazy(loadLicenses);

/** Shown when the service worker has a new version waiting. The user decides when to reload. */
function UpdateBanner(): JSX.Element | null {
  const [available, setAvailable] = useState<boolean>(Boolean(window.__lifekitUpdateAvailable));

  useEffect(() => {
    const onUpdate = () => setAvailable(true);
    window.addEventListener('lifekit:update-available', onUpdate);
    return () => window.removeEventListener('lifekit:update-available', onUpdate);
  }, []);

  if (!available) return null;
  return (
    <Notice tone="info" title="An update is ready.">
      <span className="small">
        LIFEKIT has downloaded a newer version. Nothing is lost if you keep working — reload when you are ready.
      </span>
      <div className="row" style={{ marginTop: 8 }}>
        <Button
          variant="secondary"
          onClick={() => {
            if (window.__lifekitApplyUpdate) window.__lifekitApplyUpdate();
            else window.location.reload();
          }}
        >
          Reload now
        </Button>
        <Button variant="ghost" onClick={() => setAvailable(false)}>
          Later
        </Button>
      </div>
    </Notice>
  );
}

function NotFound({ path }: { path: string }): JSX.Element {
  return (
    <EmptyState
      icon="info"
      title="That screen does not exist"
      action={
        <Button variant="primary" onClick={() => navigate(ROUTES.home)}>
          Back to Home
        </Button>
      }
    >
      <p>
        Nothing is stored at <code>{path}</code>. The address may be mistyped, or the screen may have moved in a
        newer version.
      </p>
    </EmptyState>
  );
}

function Screen({ path, segments, query }: { path: string; segments: string[]; query: URLSearchParams }): JSX.Element {
  // Deep links such as #/learn/emergency-fund are one screen with a parameter, so they are
  // matched before the flat route table.
  if (segments[0] === 'learn' && segments.length === 2 && segments[1]) {
    return <Learn lessonId={segments[1]} />;
  }

  switch (path) {
    case ROUTES.home:
      return <Home />;
    case ROUTES.money:
      return <Money initialQuickAdd={query.get('quick')} />;
    case ROUTES.planner:
      return <Planner />;
    case ROUTES.learn:
      return <Learn lessonId={segments[1]} />;
    case ROUTES.career:
      return <Career />;
    case ROUTES.safety:
      return <Safety />;
    case ROUTES.community:
      return <Community />;
    case ROUTES.tools:
      return <Tools />;
    case ROUTES.notifications:
      return <Notifications />;
    case ROUTES.notificationSettings:
      return <NotificationSettings />;
    case ROUTES.settings:
      return <SettingsPage />;
    case ROUTES.backup:
      return <BackupPage />;
    case ROUTES.about:
      return <AboutPage />;
    case ROUTES.privacy:
      return <PrivacyPage />;
    case ROUTES.licenses:
      return <LicensesPage />;
    default:
      return <NotFound path={path} />;
  }
}

export function App(): JSX.Element {
  const route = useRoute();
  const { ready, loadError, reload, settings, updateSettings, toasts, dismissToast } = useStore();

  // Keep the document title in step with the screen, which is what the Android task
  // switcher and browser tab show.
  useEffect(() => {
    const name = route.segments[0] ? route.segments[0].replace(/-/g, ' ') : 'Home';
    document.title = route.path === ROUTES.home ? `${APP_NAME} — Everyday Tools. A Better Life.` : `${name} · ${APP_NAME}`;
  }, [route.path, route.segments]);

  if (!ready) {
    return (
      <div className="boot-screen">
        <LoadingBlock label="Opening your local data…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <main className="boot-screen">
        <Notice tone="danger" title="LIFEKIT could not read its local storage.">
          <p className="small">
            Your records may still be in this device's storage, but the app could not open its database. This usually
            happens when storage is blocked (private browsing, cleared site data, or a locked-down browser). Reloading
            sometimes helps; you can also continue in temporary mode and export a backup from Settings.
          </p>
          <p className="tiny muted">{loadError}</p>
          <div className="row" style={{ marginTop: 8 }}>
            <Button variant="primary" onClick={() => reload()}>
              Try again
            </Button>
          </div>
        </Notice>
      </main>
    );
  }

  if (!settings.onboarded) {
    return (
      <>
        <Onboarding
          onDone={async (displayName) => {
            await updateSettings({ displayName, onboarded: true });
          }}
        />
        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <Layout>
      <UpdateBanner />
      <Suspense fallback={<LoadingBlock label="Loading screen…" />}>
        <Screen path={route.path} segments={route.segments} query={route.query} />
      </Suspense>
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </Layout>
  );
}

export default App;
