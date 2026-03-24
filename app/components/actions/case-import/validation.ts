import type { User } from 'firebase/auth';
import { checkUserExistsApi } from '~/utils/api';
import { type CaseExportData, type ConfirmationImportData } from '~/types';
import { type ManifestSignatureVerificationResult, verifyConfirmationSignature } from '~/utils/forensics';
import { checkExistingCase } from '../case-manage';
export { removeForensicWarning, validateConfirmationHash } from '~/utils/forensics';

/**
 * Validate that a user exists in the database by UID and is not the current user
 */
export async function validateExporterUid(exporterUid: string, currentUser: User): Promise<{ exists: boolean; isSelf: boolean }> {
  try {
    const exists = await checkUserExistsApi(currentUser, exporterUid);
    const isSelf = exporterUid === currentUser.uid;
    
    return { exists, isSelf };
  } catch (error) {
    console.error('Error validating exporter UID:', error);
    return { exists: false, isSelf: false };
  }
}

export function isArchivedExportData(parsedData: unknown): boolean {
  if (!parsedData || typeof parsedData !== 'object') {
    return false;
  }

  const root = parsedData as Record<string, unknown>;

  if (root.archived === true) {
    return true;
  }

  if (typeof root.archivedAt === 'string' && root.archivedAt.trim().length > 0) {
    return true;
  }

  const metadata = root.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const metadataRecord = metadata as Record<string, unknown>;

  if (metadataRecord.archived === true) {
    return true;
  }

  if (typeof metadataRecord.archivedAt === 'string' && metadataRecord.archivedAt.trim().length > 0) {
    return true;
  }

  return false;
}

export async function validateCaseExporterUidForImport(
  caseData: CaseExportData,
  currentUser: User,
  parsedData: unknown = caseData
): Promise<{
  exists: boolean;
  isSelf: boolean;
  isArchivedExport: boolean;
  allowArchivedSelfImport: boolean;
}> {
  const exportedByUid = caseData.metadata.exportedByUid?.trim();

  if (!exportedByUid) {
    throw new Error('Case export missing exporter UID information. This case cannot be imported.');
  }

  const validation = await validateExporterUid(exportedByUid, currentUser);

  if (!validation.exists) {
    throw new Error('The original exporter is not a valid Striae user. This case cannot be imported.');
  }

  const isArchivedExport = isArchivedExportData(parsedData);
  let allowArchivedSelfImport = false;

  if (isArchivedExport) {
    const existingRegularCase = await checkExistingCase(currentUser, caseData.metadata.caseNumber);
    allowArchivedSelfImport = existingRegularCase === null;
  }

  if (validation.isSelf && !allowArchivedSelfImport) {
    throw new Error(
      'You cannot import a case that you originally exported unless it is an archived case that has already been deleted from your regular case list.'
    );
  }

  return {
    ...validation,
    isArchivedExport,
    allowArchivedSelfImport
  };
}

/**
 * Check if file is a confirmation data import
 */
export function isConfirmationDataFile(filename: string): boolean {
  return filename.startsWith('confirmation-data') && filename.endsWith('.json');
}

/**
 * Validate imported case data integrity (optional verification)
 */
export function validateCaseIntegrity(
  caseData: CaseExportData,
  imageFiles: { [filename: string]: Blob }
): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check if all referenced images exist
  for (const fileEntry of caseData.files) {
    const filename = fileEntry.fileData.originalFilename;
    if (!imageFiles[filename]) {
      issues.push(`Missing image file: ${filename}`);
    }
  }
  
  // Check if there are extra images not referenced in case data
  const referencedFiles = new Set(caseData.files.map(f => f.fileData.originalFilename));
  for (const filename of Object.keys(imageFiles)) {
    if (!referencedFiles.has(filename)) {
      issues.push(`Unreferenced image file: ${filename}`);
    }
  }
  
  // Validate metadata completeness
  if (!caseData.metadata.caseNumber) {
    issues.push('Missing case number in metadata');
  }
  
  if (!caseData.metadata.exportDate) {
    issues.push('Missing export date in metadata');
  }
  
  // Validate annotation data
  for (const fileEntry of caseData.files) {
    if (fileEntry.hasAnnotations && !fileEntry.annotations) {
      issues.push(`File ${fileEntry.fileData.originalFilename} marked as having annotations but no annotation data found`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * Validate confirmation data file signature.
 */
export async function validateConfirmationSignatureFile(
  confirmationData: Partial<ConfirmationImportData>,
  verificationPublicKeyPem?: string
): Promise<ManifestSignatureVerificationResult> {
  return verifyConfirmationSignature(confirmationData, verificationPublicKeyPem);
}
