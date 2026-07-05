import { useEffect, useState } from 'react';

export interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for transition before fully unmounting/clearing
      }, 2600);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      return undefined;
    }
  }, [message, onClose]);

  if (!message && !visible) return null;

  return (
    <div
      className={`fixed bottom-[180px] left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="glass-panel px-4 py-2 rounded-full text-sm font-medium text-foreground text-center whitespace-nowrap shadow-xl">
        {message}
      </div>
    </div>
  );
}
