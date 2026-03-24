import styles from '../case-import.module.css';

export type ConfirmationPreview = Record<string, never>;

interface ConfirmationPreviewSectionProps {
  confirmationPreview: ConfirmationPreview | null;
  isLoadingPreview: boolean;
}

export const ConfirmationPreviewSection = ({ confirmationPreview, isLoadingPreview }: ConfirmationPreviewSectionProps) => {
  if (isLoadingPreview) {
    return (
      <div className={styles.previewSection}>
        <div className={styles.previewLoading}>
          Loading confirmation information...
        </div>
      </div>
    );
  }

  if (!confirmationPreview) return null;

  return (
    <div className={styles.previewSection}>
      <h3 className={styles.previewTitle}>Confirmation Import Preview</h3>
      <p className={styles.previewMessage}>
        Confirmation package detected. Export metadata and confirmation listings are hidden in preview for encrypted imports.
      </p>
    </div>
  );
};