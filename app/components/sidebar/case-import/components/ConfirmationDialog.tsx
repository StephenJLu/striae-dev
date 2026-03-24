import { type CaseImportPreview } from '~/types';
import { ARCHIVED_REGULAR_CASE_BLOCK_MESSAGE, DATA_INTEGRITY_VALIDATION_PASSED, DATA_INTEGRITY_VALIDATION_FAILED } from '~/utils/ui';
import styles from '../case-import.module.css';

interface ConfirmationDialogProps {
  showConfirmation: boolean;
  casePreview: CaseImportPreview | null;
  isArchivedRegularCaseImportBlocked?: boolean;
  archivedRegularCaseBlockMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog = ({ 
  showConfirmation, 
  casePreview, 
  isArchivedRegularCaseImportBlocked = false,
  archivedRegularCaseBlockMessage = ARCHIVED_REGULAR_CASE_BLOCK_MESSAGE,
  onConfirm, 
  onCancel 
}: ConfirmationDialogProps) => {
  if (!showConfirmation || !casePreview) return null;

  return (
    <div className={styles.confirmationOverlay}>
      <div className={styles.confirmationModal}>
        <div className={styles.confirmationContent}>
          <h3 className={styles.confirmationTitle}>Confirm Case Import</h3>
          <p className={styles.confirmationText}>
            Are you sure you want to import this case for review?
          </p>
          <p className={styles.confirmationText}>
            Export metadata and file listings are hidden for encrypted imports. Integrity validation will still be enforced.
          </p>
          
          <div className={styles.confirmationDetails}>
            {casePreview.archived && (
              <div className={styles.archivedImportNote}>
                Archived export detected. Original exporter imports are allowed for archived cases.
              </div>
            )}
            {isArchivedRegularCaseImportBlocked && (
              <div className={styles.archivedRegularCaseRiskNote}>
                {archivedRegularCaseBlockMessage}
              </div>
            )}
            {casePreview.hashValid !== undefined && (
              <div className={`${styles.confirmationItem} ${casePreview.hashValid ? styles.confirmationItemValid : styles.confirmationItemInvalid}`}>
                <strong>Data Integrity:</strong> 
                <span className={casePreview.hashValid ? styles.confirmationSuccess : styles.confirmationError}>
                  {casePreview.hashValid ? DATA_INTEGRITY_VALIDATION_PASSED : DATA_INTEGRITY_VALIDATION_FAILED}
                </span>
              </div>
            )}
          </div>

          <div className={styles.confirmationButtons}>
            <button
              className={styles.confirmButton}
              onClick={onConfirm}
              disabled={isArchivedRegularCaseImportBlocked}
            >
              Confirm Import
            </button>
            <button
              className={styles.cancelButton}
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};