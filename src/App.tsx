import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './store/AppStore';
import { MainLayout } from './layouts/MainLayout';
import { PageLoader } from './components/ui';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const NewExperiment = lazy(() => import('./pages/NewExperiment').then((m) => ({ default: m.NewExperiment })));
const Experiments = lazy(() => import('./pages/Experiments').then((m) => ({ default: m.Experiments })));
const ExperimentDetail = lazy(() =>
  import('./pages/ExperimentDetail').then((m) => ({ default: m.ExperimentDetail })),
);
const Datasets = lazy(() => import('./pages/Datasets').then((m) => ({ default: m.Datasets })));
const Benchmarks = lazy(() => import('./pages/Benchmarks').then((m) => ({ default: m.Benchmarks })));
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

export default function App() {
  return (
    <AppStoreProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader label="Loading…" />}>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/experiments/new" element={<NewExperiment />} />
              <Route path="/experiments" element={<Experiments />} />
              <Route path="/experiments/:id" element={<ExperimentDetail />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/benchmarks" element={<Benchmarks />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppStoreProvider>
  );
}