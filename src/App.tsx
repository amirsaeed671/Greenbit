import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router-dom';
import { HabitsSubnav, Layout } from './components/Layout';
import Today from './pages/tasks/Today';
import { useUI } from './store/ui';

const Upcoming = lazy(() => import('./pages/tasks/Upcoming'));
const ProjectView = lazy(() => import('./pages/tasks/ProjectView'));
const Browse = lazy(() => import('./pages/Browse'));
const Garden = lazy(() => import('./pages/Garden'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const HabitDetail = lazy(() => import('./pages/HabitDetail'));
const HabitForm = lazy(() => import('./pages/HabitForm'));
const Progress = lazy(() => import('./pages/Progress'));
const Insights = lazy(() => import('./pages/Insights'));
const Settings = lazy(() => import('./pages/Settings'));

const s = (el: JSX.Element) => <Suspense fallback={null}>{el}</Suspense>;

function HabitsShell() {
  return (
    <>
      <HabitsSubnav />
      <Outlet />
    </>
  );
}

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Today /> },
      { path: '/upcoming', element: s(<Upcoming />) },
      { path: '/inbox', element: s(<ProjectView kind="inbox" />) },
      { path: '/projects/:id', element: s(<ProjectView kind="project" />) },
      { path: '/labels/:id', element: s(<ProjectView kind="label" />) },
      { path: '/browse', element: s(<Browse />) },
      {
        element: <HabitsShell />,
        children: [
          { path: '/habits', element: s(<Garden />) },
          { path: '/habits/calendar', element: s(<CalendarPage />) },
          { path: '/habits/insights', element: s(<Insights />) },
          { path: '/habits/progress', element: s(<Progress />) },
        ],
      },
      { path: '/habits/new', element: s(<HabitForm />) },
      { path: '/habits/:id', element: s(<HabitDetail />) },
      { path: '/habits/:id/edit', element: s(<HabitForm />) },
      { path: '/settings', element: s(<Settings />) },
      // Old addresses from before tasks existed
      { path: '/calendar', element: <Navigate to="/habits/calendar" replace /> },
      { path: '/insights', element: <Navigate to="/habits/insights" replace /> },
      { path: '/progress', element: <Navigate to="/habits/progress" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

const router = createBrowserRouter(routes);

/** Keeps "today" correct when the app resumes or stays open across midnight. */
function useDateRollover() {
  const refresh = useUI((st) => st.refreshToday);
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
      window.clearInterval(id);
    };
  }, [refresh]);
}

export default function App() {
  useDateRollover();
  return <RouterProvider router={router} />;
}
