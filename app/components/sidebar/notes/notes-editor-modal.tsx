import type { User } from 'firebase/auth';
import { useOverlayDismiss } from '~/hooks/useOverlayDismiss';
import { NotesEditorForm } from './notes-editor-form';
import styles from './notes.module.css';

interface NotesEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCase: string;
  user: User;
  imageId: string;
  originalFileName?: string;
  onAnnotationRefresh?: () => void;
  isUploading?: boolean;
  showNotification?: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const NotesEditorModal = ({
  isOpen,
  onClose,
  currentCase,
  user,
  imageId,
  originalFileName,
  onAnnotationRefresh,
  isUploading = false,
  showNotification,
}: NotesEditorModalProps) => {
  const {
    overlayProps,
    getCloseButtonProps,
  } = useOverlayDismiss({
    isOpen,
    onClose,
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} aria-label="Close image notes dialog" {...overlayProps}>
      <div className={styles.editorModal} role="dialog" aria-modal="true" aria-label="Image Notes">
        <div className={styles.editorModalHeader}>
          <h2 className={styles.editorModalTitle}>Image Notes</h2>
          <button className={styles.editorModalCloseButton} {...getCloseButtonProps({ ariaLabel: 'Close image notes dialog' })}>
            ×
          </button>
        </div>
        <div className={styles.editorModalContent}>
          <NotesEditorForm
            currentCase={currentCase}
            user={user}
            imageId={imageId}
            onAnnotationRefresh={onAnnotationRefresh}
            originalFileName={originalFileName}
            isUploading={isUploading}
            showNotification={showNotification}
          />
        </div>
      </div>
    </div>
  );
};
