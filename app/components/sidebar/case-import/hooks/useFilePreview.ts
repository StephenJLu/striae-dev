import { useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { previewCaseImport, extractConfirmationImportPackage } from '~/components/actions/case-review';
import { type CaseImportPreview } from '~/types';
import { type ConfirmationPreview } from '../components/ConfirmationPreviewSection';

interface UseFilePreviewReturn {
  casePreview: CaseImportPreview | null;
  confirmationPreview: ConfirmationPreview | null;
  loadCasePreview: (file: File) => Promise<void>;
  loadConfirmationPreview: (file: File) => Promise<void>;
  clearPreviews: () => void;
}

/**
 * Custom hook for handling file preview loading
 */
export const useFilePreview = (
  user: User | null,
  setError: (error: string) => void,
  setIsLoadingPreview: (loading: boolean) => void,
  clearImportData: () => void
): UseFilePreviewReturn => {
  const [casePreview, setCasePreview] = useState<CaseImportPreview | null>(null);
  const [confirmationPreview, setConfirmationPreview] = useState<ConfirmationPreview | null>(null);

  const loadCasePreview = useCallback(async (file: File) => {
    if (!user) {
      setError('User authentication required');
      return;
    }

    setIsLoadingPreview(true);
    try {
      const preview = await previewCaseImport(file, user);
      setCasePreview(preview);
    } catch (error) {
      console.error('Error loading case preview:', error);
      setError(`Failed to read case information: ${error instanceof Error ? error.message : 'Unknown error'}`);
      clearImportData();
    } finally {
      setIsLoadingPreview(false);
    }
  }, [user, setError, setIsLoadingPreview, clearImportData]);

  const loadConfirmationPreview = useCallback(async (file: File) => {
    if (!user) {
      setError('User authentication required');
      return;
    }

    setIsLoadingPreview(true);
    try {
      await extractConfirmationImportPackage(file);

      const preview: ConfirmationPreview = {};
      
      setConfirmationPreview(preview);
    } catch (error) {
      console.error('Error loading confirmation preview:', error);
      setError(
        `Failed to read confirmation data: ${error instanceof Error ? error.message : 'Invalid confirmation package format'}`
      );
      clearImportData();
    } finally {
      setIsLoadingPreview(false);
    }
  }, [user, setError, setIsLoadingPreview, clearImportData]);

  const clearPreviews = useCallback(() => {
    setCasePreview(null);
    setConfirmationPreview(null);
  }, []);

  return {
    casePreview,
    confirmationPreview,
    loadCasePreview,
    loadConfirmationPreview,
    clearPreviews
  };
};