import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppStoreProvider } from './AppStore';
import { MicProvider } from '@/features/audio-engine/MicProvider';
import { AppLayout } from '@/layouts/AppLayout';
import { LoadingScreen } from '@/components/LoadingScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import HomePage from '@/pages/HomePage';

const PracticeHubPage = lazy(() => import('@/pages/PracticeHubPage'));
const PracticePage = lazy(() => import('@/pages/PracticePage'));
const ResultsPage = lazy(() => import('@/pages/ResultsPage'));
const ArenaHubPage = lazy(() => import('@/pages/ArenaHubPage'));
const ArenaPage = lazy(() => import('@/features/ar-arena/ArenaPage'));
const ChallengePage = lazy(() => import('@/pages/ChallengePage'));
const DailyPage = lazy(() => import('@/pages/DailyPage'));
const MasterPage = lazy(() => import('@/pages/MasterPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const TeacherPage = lazy(() => import('@/features/teacher-dashboard/TeacherPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export function App() {
  return (
    <ErrorBoundary>
      <AppStoreProvider>
        <MicProvider>
          <BrowserRouter>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route element={<AppLayout />}>
                  <Route index element={<HomePage />} />
                  <Route path="latihan" element={<PracticeHubPage />} />
                  <Route path="latihan/:id" element={<PracticePage />} />
                  <Route path="keputusan" element={<ResultsPage />} />
                  <Route path="ar" element={<ArenaHubPage />} />
                  <Route path="cabaran" element={<ChallengePage />} />
                  <Route path="harian" element={<DailyPage />} />
                  <Route path="master" element={<MasterPage />} />
                  <Route path="profil" element={<ProfilePage />} />
                  <Route path="tetapan" element={<SettingsPage />} />
                  <Route path="bantuan" element={<HelpPage />} />
                  <Route path="guru" element={<TeacherPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
                <Route path="ar/:id" element={<ArenaPage />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </MicProvider>
      </AppStoreProvider>
    </ErrorBoundary>
  );
}
