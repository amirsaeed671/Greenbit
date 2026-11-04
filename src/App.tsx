import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './components/Layout';
import Garden from './pages/Garden';
import { useUI } from './store/ui';

const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const HabitDetail = lazy(() => import('./pages/HabitDetail'));
const HabitForm = lazy(() => import('./pages/HabitForm'));
const Progress = lazy(() => import('./pages/Progress'));
const Insights = lazy(() => import('./pages/Insights'));
const Settings = lazy(() => import('./pages/Settings'));

const s = (el: JSX.Element) => <Suspense fallback={null}>{el}</Suspense>;

export const routes = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Garden /> },
      { path: '/calendar', element: s(<CalendarPage />) },
      { path: '/insights', element: s(<Insights />) },
      { path: '/progress', element: s(<Progress />) },
      { path: '/settings', element: s(<Settings />) },
      { path: '/habits/new', element: s(<HabitForm />) },
      { path: '/habits/:id', element: s(<HabitDetail />) },
      { path: '/habits/:id/edit', element: s(<HabitForm />) },
      { path: '*', element: <Garden /> },
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
