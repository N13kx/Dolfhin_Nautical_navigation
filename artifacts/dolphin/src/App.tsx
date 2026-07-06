import { useEffect } from 'react';
import { DolphinApp } from './pages/DolphinApp';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  useEffect(() => {
    // Install global listeners for errors that escape the React component tree
    // (e.g. MapLibre event handlers, web worker message errors, unhandled rejections).
    // Must be called once on mount, before the map initialises.
    ErrorBoundary.install();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[Dolphin] ServiceWorker registration failed:', err);
      });
    }
  }, []);

  return (
    <ErrorBoundary>
      <DolphinApp />
    </ErrorBoundary>
  );
}

export default App;
