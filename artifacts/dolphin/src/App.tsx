import { useEffect } from 'react';
import { DolphinApp } from './pages/DolphinApp';

function App() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('ServiceWorker registration failed:', error);
      });
    }
  }, []);

  return (
    <DolphinApp />
  );
}

export default App;
