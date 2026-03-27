import { useState, useEffect, useContext } from 'react';
import styles from './case-export.module.css';
import { AuthContext } from '~/contexts/auth.context';
import { useOverlayDismiss } from '~/hooks/useOverlayDismiss';
import { getCaseConfirmations, exportConfirmationData } from '../../actions/confirm-export';

interface CaseExportProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (caseNumber: string, onProgress?: (progress: number, label: string) => void) => Promise<void>;
  currentCaseNumber?: string;
  isReadOnly?: boolean;
}

export const CaseExport = ({ 
  isOpen, 
  onClose, 
  onExport, 
  currentCaseNumber = '',
  isReadOnly = false
}: CaseExportProps) => {
  const { user } = useContext(AuthContext);
  const [caseNumber, setCaseNumber] = useState(currentCaseNumber);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingConfirmations, setIsExportingConfirmations] = useState(false);
  const [error, setError] = useState<string>('');
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; caseName: string } | null>(null);
  const [hasConfirmationData, setHasConfirmationData] = useState(false);
  const {
    requestClose,
    overlayProps,
    getCloseButtonProps
  } = useOverlayDismiss({
    isOpen,
    onClose,
  });

  // Update caseNumber when currentCaseNumber prop changes
  useEffect(() => {
    setCaseNumber(currentCaseNumber);
  }, [currentCaseNumber]);

  // Check for confirmation data when case changes (for read-only cases)
  useEffect(() => {
    const checkConfirmationData = async () => {
      if (isReadOnly && user && caseNumber.trim()) {
        try {
          const confirmations = await getCaseConfirmations(user, caseNumber.trim());
          const hasData = !!confirmations && Object.keys(confirmations).length > 0;
          setHasConfirmationData(hasData);
        } catch (error) {
          console.error('Failed to check confirmation data:', error);
          setHasConfirmationData(false);
        }
      } else {
        setHasConfirmationData(false);
      }
    };

    checkConfirmationData();
  }, [isReadOnly, user, caseNumber]);

  // Additional useEffect to check when modal opens
  useEffect(() => {
    if (isOpen && isReadOnly && user && caseNumber.trim()) {
      const checkOnOpen = async () => {
        try {
          const confirmations = await getCaseConfirmations(user, caseNumber.trim());
          const hasData = !!confirmations && Object.keys(confirmations).length > 0;
          setHasConfirmationData(hasData);
        } catch (error) {
          console.error('Modal open confirmation check failed:', error);
          setHasConfirmationData(false);
        }
      };
      checkOnOpen();
    }
  }, [isOpen, isReadOnly, user, caseNumber]);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!caseNumber.trim()) {
      setError('Please enter a case number');
      return;
    }
    
    setIsExporting(true);
    setError('');
    setExportProgress(null);
    
    try {
      await onExport(caseNumber.trim(), (progress, label) => {
        setExportProgress({ current: progress, total: 100, caseName: label });
      });
      requestClose();
    } catch (error) {
      console.error('Export failed:', error);
      setError(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportConfirmations = async () => {
    if (!caseNumber.trim() || !user) {
      setError('Unable to export confirmation data');
      return;
    }
    
    setIsExportingConfirmations(true);
    setError('');
    
    try {
      await exportConfirmationData(user, caseNumber.trim());
      requestClose();
    } catch (error) {
      console.error('Confirmation export failed:', error);
      setError(error instanceof Error ? error.message : 'Confirmation export failed. Please try again.');
    } finally {
      setIsExportingConfirmations(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      aria-label="Close case export dialog"
      {...overlayProps}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Export Case Package</h2>
          <button className={styles.closeButton} {...getCloseButtonProps({ ariaLabel: 'Close case export dialog' })}>
            ×
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.fieldGroup}>
            {/* 1. Case number input */}
            <div className={styles.inputGroup}>
              <input
                id="caseNumber"
                type="text"
                className={styles.input}
                value={caseNumber}
                onChange={(e) => {
                  setCaseNumber(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter case number"
                disabled={isExporting || isReadOnly}
              />
            </div>
            {!isReadOnly && (
              <div className={styles.imageOption}>
                <div className={styles.checkboxLabel}>
                  <div className={styles.checkboxText}>
                    <span>Encrypted package export</span>
                    <span className={styles.checkboxTooltip}>
                      Case exports always include all images and are downloaded as encrypted ZIP archives.
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div className={styles.inputGroup}>
              <button
                className={isReadOnly ? styles.confirmationExportButton : styles.exportButton}
                onClick={isReadOnly ? handleExportConfirmations : handleExport}
                disabled={!caseNumber.trim() || isExporting || isExportingConfirmations || (isReadOnly && !hasConfirmationData)}
              >
                {isExporting || isExportingConfirmations ? 'Exporting...' : 
                 isReadOnly ? 'Export Confirmation Data' : 'Export Encrypted Case Package'}
              </button>
            </div>

            {exportProgress && exportProgress.total > 0 && (
              <div className={styles.progressSection}>
                <div className={styles.progressText}>
                  {`${exportProgress.caseName} (${exportProgress.current}%)`}
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {isExporting && !exportProgress && (
              <div className={styles.progressSection}>
                <div className={styles.progressText}>
                  Preparing export...
                </div>
              </div>
            )}
            
            {error && (
              <div className={styles.error}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};