import styles from '../user-audit.module.css';

interface AuditViewerHeaderProps {
  title: string;
  onClose: () => void;
}

export const AuditViewerHeader = ({
  title,
  onClose,
}: AuditViewerHeaderProps) => {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.headerActions}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
};
