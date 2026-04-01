import { useState, useSyncExternalStore, useCallback } from 'react';
import styles from './mobile-warning.module.css';

const DISMISSED_KEY = 'striae-mobile-warning-dismissed';

const subscribeDismissed = () => () => {};
const getSnapshot = () => sessionStorage.getItem(DISMISSED_KEY) === '1';
const getServerSnapshot = () => true;

export function MobileWarning() {
  const persisted = useSyncExternalStore(subscribeDismissed, getSnapshot, getServerSnapshot);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const dismissed = persisted || sessionDismissed;

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setSessionDismissed(true);
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <h2 className={styles.title}>Desktop Experience Only</h2>
        <p className={styles.message}>
          Striae is designed for desktop browsers and is not optimized for
          mobile devices or tablets. For the best experience, please use a
          desktop computer.
        </p>
        <button
          type="button"
          className={styles.dismissButton}
          onClick={handleDismiss}
        >
          Continue Anyway
        </button>
      </div>
    </div>
  );
}
