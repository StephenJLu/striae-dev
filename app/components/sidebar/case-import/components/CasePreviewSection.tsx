import { type CaseImportPreview } from '~/types';
import { ARCHIVED_REGULAR_CASE_BLOCK_MESSAGE, DATA_INTEGRITY_VALIDATION_PASSED, DATA_INTEGRITY_VALIDATION_FAILED } from '~/utils/ui';
import styles from '../case-import.module.css';

interface CasePreviewSectionProps {
  casePreview: CaseImportPreview | null;
  isLoadingPreview: boolean;
  isArchivedRegularCaseImportBlocked?: boolean;
}

export const CasePreviewSection = ({
  casePreview,
  isLoadingPreview,
  isArchivedRegularCaseImportBlocked = false
}: CasePreviewSectionProps) => {
  if (isLoadingPreview) {
    return (
      <div className={styles.previewSection}>
        <div className={styles.previewLoading}>
          Loading case information...
        </div>
      </div>
    );
  }

  if (!casePreview) return null;

  return (
    <>
      <div className={styles.previewSection}>
        <h3 className={styles.previewTitle}>Case Import Preview</h3>
        <p className={styles.previewMessage}>
          Case package detected. Export metadata and file listings are hidden in preview for encrypted imports.
        </p>
        {casePreview.archived && (
          <div className={styles.archivedImportNote}>
            Archived export detected. Original exporter imports are allowed for archived cases.
          </div>
        )}
        {isArchivedRegularCaseImportBlocked && (
          <div className={styles.archivedRegularCaseRiskNote}>
            {ARCHIVED_REGULAR_CASE_BLOCK_MESSAGE}
          </div>
        )}
      </div>

      {casePreview.hashValid !== undefined && (
        <div className={`${styles.validationSection} ${casePreview.hashValid ? styles.validationSectionValid : styles.validationSectionInvalid}`}>
          <h3 className={styles.validationTitle}>Data Integrity Validation</h3>
          <div className={styles.validationItem}>            
            <span className={`${styles.validationValue} ${casePreview.hashValid ? styles.validationSuccess : styles.validationError}`}>
              {casePreview.hashValid ? (
                <>{DATA_INTEGRITY_VALIDATION_PASSED}</>
              ) : (
                <>{DATA_INTEGRITY_VALIDATION_FAILED}</>
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );
};