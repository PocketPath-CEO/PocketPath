import { useState, useEffect } from 'react';
import { AppProvider } from './AppContext';
import { Layout, type PageId } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Transactions } from './pages/Transactions';
import { Budget } from './pages/Budget';
import { Savings } from './pages/Savings';
import { Advisor } from './pages/Advisor';
import { Settings } from './pages/Settings';
import { Onboarding, hasOnboarded } from './components/Onboarding';
import { Guide } from './components/Guide';
import { AuthPage } from './pages/AuthPage';
import { useAuth } from './components/AuthContext';

function Shell() {
  const { user, loading, configured } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!hasOnboarded()) {
      setShowOnboarding(true);
    }
  }, []);

  function handleOnboardingDone() {
    setShowOnboarding(false);
  }

  function handleOnboardingTakeTour() {
    setShowOnboarding(false);
    setPage('dashboard');
    setShowGuide(true);
  }

  function handleGuideStart() {
    setPage('dashboard');
    setShowGuide(true);
  }

  function handleGuideClose() {
    setShowGuide(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <div className="h-8 w-8 rounded-xl bg-mint-500 flex items-center justify-center font-extrabold text-navy-900 text-lg animate-pulse">
          P
        </div>
      </div>
    );
  }

  if (configured && !user) {
    return <AuthPage />;
  }

  return (
    <AppProvider>
      <Layout page={page} setPage={setPage}>
        {page === 'dashboard' && <Dashboard setPage={setPage} />}
        {page === 'transactions' && <Transactions />}
        {page === 'budget' && <Budget />}
        {page === 'savings' && <Savings />}
        {page === 'advisor' && <Advisor />}
        {page === 'settings' && <Settings onGuideStart={handleGuideStart} />}

        {showOnboarding && (
          <Onboarding onComplete={handleOnboardingDone} onTakeTour={handleOnboardingTakeTour} />
        )}

        {showGuide && <Guide setPage={setPage} onClose={handleGuideClose} />}
      </Layout>
    </AppProvider>
  );
}

export default function App() {
  return <Shell />;
}
