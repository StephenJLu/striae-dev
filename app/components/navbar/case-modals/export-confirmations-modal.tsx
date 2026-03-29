import { useEffect, useRef } from 'react';
import { useOverlayDismiss } from '~/hooks/useOverlayDismiss';
import sharedStyles from './case-modal-shared.module.css';
import styles from './export-confirmations-modal.module.css';

interface ExportConfirmationsModalProps {
  isOpen: boolean;
  caseNumber: string;
  confirmedCount: number;
  unconfirmedCount: number;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ExportConfirmationsModal = ({
  isOpen,
  caseNumber,
  confirmedCount,
  unconfirmedCount,
  isSubmitting = false,
  onClose,
  onConfirm,
}: ExportConfirmationsModalProps) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const {
    requestClose,
    overlayProps,
    getCloseButtonProps,
  } = useOverlayDismiss({
    isOpen,
    onClose,
    canDismiss: !isSubmitting,
  });

  useEffect(() => {
    if (!isOpen) return;

    const focusId = window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmationLabel = confirmedCount === 1 ? '1 confirmation' : `${confirmedCount} confirmations`;

  return (
    <div
      className={sharedStyles.overlay}
      aria-label="Close export confirmations dialog"
      {...overlayProps}
    >
      <div
        className={`${sharedStyles.modal} ${styles.modal}`}
        role="dialog"
        aria-modal="true"
        aria-label="Export Confirmations"
      >
        <button {...getCloseButtonProps({ ariaLabel: 'Close export confirmations dialog' })}>
          ×
        </button>
        <h3 className={sharedStyles.title}>Export Confirmations</h3>
        <p className={sharedStyles.subtitle}>Case: {caseNumber}</p>
        {unconfirmedCount > 0 && (
          <div className={`${sharedStyles.warningPanel} ${styles.warningPanel}`}>
            <p>
              <strong>
                {unconfirmedCount} image{unconfirmedCount !== 1 ? 's' : ''}{' '}
                {unconfirmedCount !== 1 ? 'have' : 'has'} unconfirmed confirmations.
              </strong>
            </p>
            <p>Only confirmed images will be included in this export.</p>
          </div>
        )}
        <p className={styles.description}>
          {confirmedCount === 0
            ? 'No confirmed confirmations found for this case.'
            : `${confirmationLabel} will be exported.`}
        </p>
        <div className={sharedStyles.actions}>
          <button
            type="button"
            className={sharedStyles.cancelButton}
            onClick={requestClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={`${sharedStyles.confirmButton} ${styles.confirmButton}`}
            onClick={onConfirm}
            disabled={isSubmitting || confirmedCount === 0}
          >
            {isSubmitting ? 'Exporting...' : 'Export Confirmations'}
          </button>
        </div>
      </div>
    </div>
  );
};
