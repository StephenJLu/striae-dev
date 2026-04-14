import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import type { User } from 'firebase/auth';
import { ColorSelector } from '~/components/colors/colors';
import { AddlNotesModal } from './addl-notes-modal';
import { ItemDetailsModal } from './item-details/item-details-modal';
import { buildItemDetailsSummary } from './item-details/item-details-shared';
import { getNotes, saveNotes } from '~/components/actions/notes-manage';
import { type AnnotationData, type BulletAnnotationData, type CartridgeCaseAnnotationData, type ShotshellAnnotationData, type ItemType } from '~/types/annotations';
import { resolveEarliestAnnotationTimestamp } from '~/utils/ui';
import { auditService } from '~/services/audit';
import styles from './notes.module.css';

interface NotesEditorFormProps {
  currentCase: string;
  user: User;
  imageId: string;
  onAnnotationRefresh?: () => void;
  originalFileName?: string;
  isUploading?: boolean;
  showNotification?: (message: string, type: 'success' | 'error' | 'warning') => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onRegisterSaveHandler?: (saveHandler: (() => Promise<boolean>) | null) => void;
}

type SupportLevel = 'ID' | 'Exclusion' | 'Inconclusive';
type IndexType = 'number' | 'color';

interface NotesFormSnapshot {
  leftCase: string;
  rightCase: string;
  leftItem: string;
  rightItem: string;
  caseFontColor: string;
  itemType: ItemType | '';
  customClass: string;
  classNote: string;
  hasSubclass: boolean;
  bulletData: BulletAnnotationData | undefined;
  cartridgeCaseData: CartridgeCaseAnnotationData | undefined;
  shotshellData: ShotshellAnnotationData | undefined;
  indexType: IndexType;
  indexNumber: string;
  indexColor: string;
  supportLevel: SupportLevel | '';
  includeConfirmation: boolean;
  additionalNotes: string;
}

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasMeaningfulValue);
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasMeaningfulValue);
  }

  return true;
};

const normalizeNestedAnnotationData = <T extends object>(data: T | undefined): T | undefined => {
  if (data === undefined || data === null) {
    return undefined;
  }

  return hasMeaningfulValue(data) ? data : undefined;
};

const normalizeNotesSnapshot = (snapshot: NotesFormSnapshot): NotesFormSnapshot => ({
  ...snapshot,
  bulletData: normalizeNestedAnnotationData(snapshot.bulletData),
  cartridgeCaseData: normalizeNestedAnnotationData(snapshot.cartridgeCaseData),
  shotshellData: normalizeNestedAnnotationData(snapshot.shotshellData),
});

const serializeNotesSnapshot = (snapshot: NotesFormSnapshot): string => JSON.stringify(normalizeNotesSnapshot(snapshot));
const DIRTY_CHECK_DEBOUNCE_MS = 180;
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const NotesEditorForm = ({ currentCase, user, imageId, onAnnotationRefresh, originalFileName, isUploading = false, showNotification: externalShowNotification, onDirtyChange, onRegisterSaveHandler }: NotesEditorFormProps) => {
  // Loading/Saving Notes States
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [isConfirmedImage, setIsConfirmedImage] = useState(false);
  // Case numbers state
  const [leftCase, setLeftCase] = useState('');
  const [rightCase, setRightCase] = useState('');
  const [leftItem, setLeftItem] = useState('');
  const [rightItem, setRightItem] = useState('');
  const [useCurrentCaseLeft, setUseCurrentCaseLeft] = useState(false);
  const [useCurrentCaseRight, setUseCurrentCaseRight] = useState(false);
  const [caseFontColor, setCaseFontColor] = useState('');

  // Class characteristics state
  const [itemType, setItemType] = useState<ItemType | ''>('');
  const [customClass, setCustomClass] = useState('');
  const [classNote, setClassNote] = useState('');
  const [hasSubclass, setHasSubclass] = useState(false);
  const [bulletData, setBulletData] = useState<BulletAnnotationData | undefined>(undefined);
  const [cartridgeCaseData, setCartridgeCaseData] = useState<CartridgeCaseAnnotationData | undefined>(undefined);
  const [shotshellData, setShotshellData] = useState<ShotshellAnnotationData | undefined>(undefined);
  const [isClassDetailsOpen, setIsClassDetailsOpen] = useState(false);

  // Index state
  const [indexType, setIndexType] = useState<IndexType>('color');
  const [indexNumber, setIndexNumber] = useState('');
  const [indexColor, setIndexColor] = useState('');

  // Support level and confirmation
  const [supportLevel, setSupportLevel] = useState<SupportLevel | ''>('');
  const [includeConfirmation, setIncludeConfirmation] = useState(false);

  // Additional Notes Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isCaseInfoOpen, setIsCaseInfoOpen] = useState(true);
  const [isClassOpen, setIsClassOpen] = useState(true);
  const [isIndexOpen, setIsIndexOpen] = useState(true);
  const [isSupportOpen, setIsSupportOpen] = useState(true);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [hasLoadedSnapshot, setHasLoadedSnapshot] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const areInputsDisabled = isUploading || isConfirmedImage;

  const notificationHandler = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (externalShowNotification) {
      externalShowNotification(message, type);
    }
  }, [externalShowNotification]);

  useEffect(() => {
    if (!hasLoadedSnapshot) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextSnapshot = serializeNotesSnapshot({
        leftCase,
        rightCase,
        leftItem,
        rightItem,
        caseFontColor,
        itemType,
        customClass,
        classNote,
        hasSubclass,
        bulletData,
        cartridgeCaseData,
        shotshellData,
        indexType,
        indexNumber,
        indexColor,
        supportLevel,
        includeConfirmation,
        additionalNotes,
      });

      setIsDirty(nextSnapshot !== savedSnapshot);
    }, DIRTY_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    additionalNotes,
    bulletData,
    cartridgeCaseData,
    caseFontColor,
    classNote,
    itemType,
    customClass,
    hasLoadedSnapshot,
    hasSubclass,
    includeConfirmation,
    indexColor,
    indexNumber,
    indexType,
    leftCase,
    leftItem,
    rightCase,
    rightItem,
    savedSnapshot,
    shotshellData,
    supportLevel,
  ]);

  useEffect(() => {
    const loadExistingNotes = async () => {
      if (!imageId || !currentCase) return;
      
      setIsLoading(true);
      setLoadError(undefined);
      setIsConfirmedImage(false);
      setHasLoadedSnapshot(false);
      setIsDirty(false);
      onDirtyChange?.(false);
      
      try {
        const existingNotes = await getNotes(user, currentCase, imageId);
        
        if (existingNotes) {
          const hasExistingConfirmation = !!existingNotes.confirmationData;
          setIsConfirmedImage(hasExistingConfirmation);

          // Update all form fields with existing data
          setLeftCase(existingNotes.leftCase);
          setRightCase(existingNotes.rightCase);
          setLeftItem(existingNotes.leftItem);
          setRightItem(existingNotes.rightItem);
          setCaseFontColor(existingNotes.caseFontColor || '');
          setItemType(existingNotes.itemType || '');
          setCustomClass(existingNotes.customClass || '');
          setClassNote(existingNotes.classNote || '');
          setHasSubclass(existingNotes.hasSubclass ?? false);
          setBulletData(existingNotes.bulletData);
          setCartridgeCaseData(existingNotes.cartridgeCaseData);
          setShotshellData(existingNotes.shotshellData);
          setIndexType(existingNotes.indexType || 'color');
          setIndexNumber(existingNotes.indexNumber || '');
          setIndexColor(existingNotes.indexColor || '');
          setSupportLevel(existingNotes.supportLevel || '');
          setIncludeConfirmation(existingNotes.includeConfirmation);
          setAdditionalNotes(existingNotes.additionalNotes || '');

          setSavedSnapshot(serializeNotesSnapshot({
            leftCase: existingNotes.leftCase || '',
            rightCase: existingNotes.rightCase || '',
            leftItem: existingNotes.leftItem || '',
            rightItem: existingNotes.rightItem || '',
            caseFontColor: existingNotes.caseFontColor || '',
            itemType: existingNotes.itemType || '',
            customClass: existingNotes.customClass || '',
            classNote: existingNotes.classNote || '',
            hasSubclass: existingNotes.hasSubclass ?? false,
            bulletData: existingNotes.bulletData,
            cartridgeCaseData: existingNotes.cartridgeCaseData,
            shotshellData: existingNotes.shotshellData,
            indexType: existingNotes.indexType || 'color',
            indexNumber: existingNotes.indexNumber || '',
            indexColor: existingNotes.indexColor || '',
            supportLevel: existingNotes.supportLevel || '',
            includeConfirmation: existingNotes.includeConfirmation,
            additionalNotes: existingNotes.additionalNotes || ''
          }));
        } else {
          setIsConfirmedImage(false);

          setSavedSnapshot(serializeNotesSnapshot({
            leftCase: '',
            rightCase: '',
            leftItem: '',
            rightItem: '',
            caseFontColor: '',
            itemType: '',
            customClass: '',
            classNote: '',
            hasSubclass: false,
            bulletData: undefined,
            cartridgeCaseData: undefined,
            shotshellData: undefined,
            indexType: 'color',
            indexNumber: '',
            indexColor: '',
            supportLevel: '',
            includeConfirmation: false,
            additionalNotes: ''
          }));
        }
      } catch (error) {
        setLoadError('Failed to load existing notes');
        console.error('Error loading notes:', error);
      } finally {
        setIsLoading(false);
        setHasLoadedSnapshot(true);
      }
    };

    loadExistingNotes();
  }, [imageId, currentCase, onDirtyChange, user]);

  useIsomorphicLayoutEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

 useEffect(() => {
    if (useCurrentCaseLeft) {
      setLeftCase(currentCase);
    }
    if (useCurrentCaseRight) {
      setRightCase(currentCase);
    }
  }, [useCurrentCaseLeft, useCurrentCaseRight, currentCase]);

  const handleSave = useCallback(async (): Promise<boolean> => {

    if (!imageId) {
      console.error('No image selected');
      return false;
    }

    let existingData: AnnotationData | null = null;
    
    try {
      // First, get existing annotation data to preserve box annotations
      existingData = await getNotes(user, currentCase, imageId);

      if (existingData?.confirmationData) {
        setIsConfirmedImage(true);
        notificationHandler('This image is confirmed. Notes cannot be modified.', 'error');
        return false;
      }

      const normalizedBulletData = normalizeNestedAnnotationData(bulletData);
      const normalizedCartridgeCaseData = normalizeNestedAnnotationData(cartridgeCaseData);
      const normalizedShotshellData = normalizeNestedAnnotationData(shotshellData);
      
      // Create updated annotation data, preserving box annotations and earliest timestamp
      const now = new Date().toISOString();
      const annotationData: AnnotationData = {
        // Case Information
        leftCase: leftCase || '',
        rightCase: rightCase || '',
        leftItem: leftItem || '',
        rightItem: rightItem || '',
        caseFontColor: caseFontColor || undefined,
        
        // Class Characteristics
        itemType: itemType as ItemType || undefined,
        customClass: customClass,
        classNote: classNote || undefined,
        hasSubclass: hasSubclass,
        bulletData: normalizedBulletData,
        cartridgeCaseData: normalizedCartridgeCaseData,
        shotshellData: normalizedShotshellData,
        
        // Index Information
        indexType: indexType,
        indexNumber: indexNumber,
        indexColor: indexColor || undefined,

        // Support Level & Confirmation
        supportLevel: supportLevel as SupportLevel || undefined,
        includeConfirmation: includeConfirmation,
        
        // Additional Notes
        additionalNotes: additionalNotes || undefined, // Keep as optional
        
        // Preserve existing box annotations
        boxAnnotations: existingData?.boxAnnotations || [],
        
        // Metadata
        updatedAt: now,
        // Set earliest annotation timestamp on first save (don't overwrite if already exists)
        earliestAnnotationTimestamp: resolveEarliestAnnotationTimestamp(
          undefined,
          existingData?.earliestAnnotationTimestamp,
          now
        )
      };

      await saveNotes(user, currentCase, imageId, annotationData);
      
      // Comprehensive audit logging for annotation save
      await auditService.logAnnotationEdit(
        user,
        `${currentCase}-${imageId}`,
        existingData,
        annotationData,
        currentCase,
        'notes-editor-form',
        imageId,
        originalFileName
      );
      
      notificationHandler('Notes saved successfully.', 'success');

      setSavedSnapshot(serializeNotesSnapshot({
        leftCase,
        rightCase,
        leftItem,
        rightItem,
        caseFontColor,
        itemType,
        customClass,
        classNote,
        hasSubclass,
        bulletData,
        cartridgeCaseData,
        shotshellData,
        indexType,
        indexNumber,
        indexColor,
        supportLevel,
        includeConfirmation,
        additionalNotes,
      }));
      setIsDirty(false);
      onDirtyChange?.(false);
      
      // Refresh annotation data after saving notes
      if (onAnnotationRefresh) {
        onAnnotationRefresh();
      }

      return true;
    } catch (error) {
      console.error('Failed to save notes:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.toLowerCase().includes('confirmed image')) {
        setIsConfirmedImage(true);
        notificationHandler('This image is confirmed. Notes cannot be modified.', 'error');
      } else {
        notificationHandler('Failed to save notes. Please try again.', 'error');
      }
      
      // Audit logging for failed annotation save
      try {
        await auditService.logAnnotationEdit(
          user,
          `${currentCase}-${imageId}`,
          existingData,
          null, // Failed save, no new value
          currentCase,
          'notes-editor-form',
          imageId,
          originalFileName
        );
      } catch (auditError) {
        console.error('Failed to log annotation edit audit:', auditError);
      }

      return false;
    }
  }, [
    additionalNotes,
    bulletData,
    cartridgeCaseData,
    caseFontColor,
    classNote,
    itemType,
    currentCase,
    customClass,
    hasSubclass,
    imageId,
    includeConfirmation,
    indexColor,
    indexNumber,
    indexType,
    leftCase,
    leftItem,
    notificationHandler,
    onAnnotationRefresh,
    onDirtyChange,
    originalFileName,
    rightCase,
    rightItem,
    shotshellData,
    supportLevel,
    user,
  ]);

  useEffect(() => {
    onRegisterSaveHandler?.(handleSave);

    return () => {
      onRegisterSaveHandler?.(null);
    };
  }, [handleSave, onRegisterSaveHandler]);

  return (
    <div className={`${styles.notesEditorForm} ${styles.editorLayout}`}>
      {isLoading ? (
        <div className={styles.loading}>Loading notes...</div>
      ) : loadError ? (
        <div className={styles.error}>{loadError}</div>
      ) : (
        <>
      {isConfirmedImage && (
        <div className={styles.immutableNotice}>
          This image is confirmed. Notes are read-only.
        </div>
      )}

      <div className={styles.section}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setIsCaseInfoOpen((prev) => !prev)}
          aria-expanded={isCaseInfoOpen}
        >
          <span className={styles.sectionTitle}>Case Information</span>
          <span className={styles.sectionToggleIcon}>{isCaseInfoOpen ? '−' : '+'}</span>
        </button>
        {isCaseInfoOpen && (
          <>
        <hr />
        <div className={styles.caseNumbers}>
          {/* Left side inputs */}
          <div className={styles.inputGroup}>
            <div className={styles.caseInput}>
              <label htmlFor="leftCase">Left Side Case #</label>
              <input
                id="leftCase"
                type="text"
                value={leftCase}
                onChange={(e) => setLeftCase(e.target.value)}
                disabled={useCurrentCaseLeft || areInputsDisabled}                
              />
            </div>
            <label className={`${styles.checkboxLabel} mb-4`}>
              <input
                type="checkbox"
                checked={useCurrentCaseLeft}
                onChange={(e) => setUseCurrentCaseLeft(e.target.checked)}
                className={styles.checkbox}
                disabled={areInputsDisabled}
              />
              <span>Use current case number</span>
            </label>            
            <div className={styles.caseInput}>
              <label htmlFor="leftItem">Left Side Item #</label>
              <input
                id="leftItem"
                type="text"
                value={leftItem}
                onChange={(e) => setLeftItem(e.target.value)}
                disabled={areInputsDisabled}
              />
            </div>
          </div>
          {/* Right side inputs */}
          <div className={styles.inputGroup}>
            <div className={styles.caseInput}>
              <label htmlFor="rightCase">Right Side Case #</label>
              <input
                id="rightCase"
                type="text"
                value={rightCase}
                onChange={(e) => setRightCase(e.target.value)}
                disabled={useCurrentCaseRight || areInputsDisabled}                
              />
            </div>
            <label className={`${styles.checkboxLabel} mb-4`}>
              <input
                type="checkbox"
                checked={useCurrentCaseRight}
                onChange={(e) => setUseCurrentCaseRight(e.target.checked)}
                className={styles.checkbox}
                disabled={areInputsDisabled}
              />
              <span>Use current case number</span>
            </label>
            <div className={styles.caseInput}>
              <label htmlFor="rightItem">Right Side Item #</label>
              <input
                id="rightItem"
                type="text"
                value={rightItem}
                onChange={(e) => setRightItem(e.target.value)}
                disabled={areInputsDisabled}
              />
            </div>            
          </div>
        </div>
        <hr />
        <div className={styles.fontColorRow}>
          <label htmlFor="colorSelect">Font</label>
          <ColorSelector
            selectedColor={caseFontColor}
            onColorSelect={setCaseFontColor}
          />
        </div>
          </>
        )}
      </div>

      <div className={styles.compactSectionGrid}>
      <div className={`${styles.section} ${styles.compactFullSection}`}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setIsClassOpen((prev) => !prev)}
          aria-expanded={isClassOpen}
        >
          <span className={styles.sectionTitle}>Class Characteristics & GRC</span>
          <span className={styles.sectionToggleIcon}>{isClassOpen ? '−' : '+'}</span>
        </button>
        {isClassOpen && (
          <>
            <div className={styles.classCharacteristicsColumns}>
              <div className={styles.classCharacteristicsMain}>
                <div className={styles.classCharacteristics}>
                  <select
                    id="itemType"
                    aria-label="Item Type"
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItemType)}
                    className={styles.select}
                    disabled={areInputsDisabled}
                  >
                    <option value="">Select item type...</option>
                    <option value="Bullet">Bullet</option>
                    <option value="Cartridge Case">Cartridge Case</option>
                    <option value="Shotshell">Shotshell</option>
                    <option value="Other">Other</option>
                  </select>

                  {itemType === 'Other' && (
                    <input
                      type="text"
                      value={customClass}
                      onChange={(e) => setCustomClass(e.target.value)}
                      placeholder="Specify object type"
                      disabled={areInputsDisabled}
                    />
                  )}

                  <textarea
                    value={classNote}
                    onChange={(e) => setClassNote(e.target.value)}
                    placeholder="Enter item details..."
                    className={styles.textarea}
                    disabled={areInputsDisabled}
                  />
                </div>
                <label className={`${styles.checkboxLabel} mb-4`}>
                  <input
                    type="checkbox"
                    checked={hasSubclass}
                    onChange={(e) => setHasSubclass(e.target.checked)}
                    className={styles.checkbox}
                    disabled={areInputsDisabled}
                  />
                  <span>Potential subclass?</span>
                </label>
            </div>

              <div className={styles.itemDetailsPanel}>
                <button
                  type="button"
                  onClick={() => setIsClassDetailsOpen(true)}
                  className={styles.itemDetailsButton}
                  disabled={areInputsDisabled}
                >
                  Class Characteristics & GRC
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={`${styles.section} ${styles.compactHalfSection}`}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setIsIndexOpen((prev) => !prev)}
          aria-expanded={isIndexOpen}
        >
          <span className={styles.sectionTitle}>Index Type</span>
          <span className={styles.sectionToggleIcon}>{isIndexOpen ? '−' : '+'}</span>
        </button>
        {isIndexOpen && (
          <div className={styles.indexing}>
          <div className={styles.radioGroup}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={indexType === 'color'}
                onChange={() => setIndexType('color')}
                disabled={areInputsDisabled}
              />
              <span>Color</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                checked={indexType === 'number'}
                onChange={() => setIndexType('number')}
                disabled={areInputsDisabled}
              />
              <span>Number/Letter</span>
            </label>
          </div>

          {indexType === 'number' ? (
            <input
              type="text"
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              placeholder="Enter index number"
              disabled={areInputsDisabled}
            />
          ) : indexType === 'color' ? (            
            <ColorSelector
              selectedColor={indexColor}
              onColorSelect={setIndexColor}
            />            
          ) : null}
        </div>
        )}
      </div>

      <div className={`${styles.section} ${styles.compactHalfSection}`}>
        <button
          type="button"
          className={styles.sectionToggle}
          onClick={() => setIsSupportOpen((prev) => !prev)}
          aria-expanded={isSupportOpen}
        >
          <span className={styles.sectionTitle}>Support Level</span>
          <span className={styles.sectionToggleIcon}>{isSupportOpen ? '−' : '+'}</span>
        </button>
        {isSupportOpen && (
          <>
            <div className={styles.support}>
              <select
                id="supportLevel"
                aria-label="Support Level"
                value={supportLevel}
                onChange={(e) => {
                  const newSupportLevel = e.target.value as SupportLevel;
                  setSupportLevel(newSupportLevel);
                  
                  // Automatically check confirmation field when ID is selected
                  if (newSupportLevel === 'ID') {
                    setIncludeConfirmation(true);
                  }
                }}
                className={styles.select}
                disabled={areInputsDisabled}
              >
                <option value="">Select support level...</option>
                <option value="ID">Identification</option>
                <option value="Exclusion">Exclusion</option>
                <option value="Inconclusive">Inconclusive</option>
              </select>
              <label className={`${styles.checkboxLabel} mb-4`}>
                <input
                  type="checkbox"
                  checked={includeConfirmation}
                  onChange={(e) => setIncludeConfirmation(e.target.checked)}
                  className={styles.checkbox}
                  disabled={areInputsDisabled}
                />
                <span>Include confirmation field</span>
              </label>
            </div>
          </>
        )}
      </div>            
      </div>

        <div className={styles.additionalNotesRow}>
          <button 
            onClick={() => setIsModalOpen(true)}
            className={styles.notesButton}
            disabled={areInputsDisabled}
            title={isConfirmedImage ? "Cannot edit notes for confirmed images" : isUploading ? "Cannot add notes while uploading" : undefined}
          >
            Additional Notes
          </button>
        </div>

        <div className={`${styles.notesActionBar} ${styles.notesActionBarSticky}`}>
          <button 
              onClick={handleSave}
              className={styles.saveButton}
              disabled={areInputsDisabled}
              title={isConfirmedImage ? "Cannot save notes for confirmed images" : isUploading ? "Cannot save notes while uploading" : undefined}
            >
              Save Notes
            </button>
        </div>
      <AddlNotesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        notes={additionalNotes}
        onSave={setAdditionalNotes}
        showNotification={notificationHandler}
      />
      <ItemDetailsModal
        isOpen={isClassDetailsOpen}
        onClose={() => setIsClassDetailsOpen(false)}
        itemType={itemType}
        bulletData={bulletData}
        cartridgeCaseData={cartridgeCaseData}
        shotshellData={shotshellData}
        onSave={(b, c, s) => {
          if (b !== undefined) setBulletData(b);
          if (c !== undefined) setCartridgeCaseData(c);
          if (s !== undefined) setShotshellData(s);
          const summary = buildItemDetailsSummary(b, c, s, itemType);
          if (summary) {
            setAdditionalNotes((prev) => prev ? `${prev}\n${summary}` : summary);
          }
        }}
        showNotification={notificationHandler}
        isReadOnly={areInputsDisabled}
      />
      </>
        )}
    </div>
  );
};