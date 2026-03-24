import { type ConfirmationImportData } from '~/types';

const CONFIRMATION_EXPORT_FILE_REGEX = /^confirmation-data-.*\.json$/i;

function uint8ArrayToBase64Url(data: Uint8Array): string {
  const chunkSize = 8192;
  let binaryString = '';

  for (let index = 0; index < data.length; index += chunkSize) {
    const chunk = data.subarray(index, Math.min(index + chunkSize, data.length));

    for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
      binaryString += String.fromCharCode(chunk[chunkIndex]);
    }
  }

  return btoa(binaryString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export interface ConfirmationImportPackage {
  confirmationData: ConfirmationImportData;
  confirmationJsonContent: string;
  verificationPublicKeyPem?: string;
  confirmationFileName: string;
  isEncrypted?: boolean;
  encryptionManifest?: unknown;
  encryptedDataBase64?: string;
}

function getLeafFileName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

function selectPreferredPemPath(pemPaths: string[]): string | undefined {
  if (pemPaths.length === 0) {
    return undefined;
  }

  const sortedPaths = [...pemPaths].sort((left, right) => left.localeCompare(right));
  const preferred = sortedPaths.find((path) =>
    /^striae-public-signing-key.*\.pem$/i.test(getLeafFileName(path))
  );

  return preferred ?? sortedPaths[0];
}

async function extractConfirmationPackageFromZip(file: File): Promise<ConfirmationImportPackage> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(file);
  const fileEntries = Object.keys(zip.files).filter((path) => !zip.files[path].dir);

  // Check for encryption manifest first
  const hasEncryptionManifest = fileEntries.some((path) =>
    getLeafFileName(path).toLowerCase() === 'encryption_manifest.json'
  );

  let confirmationData: ConfirmationImportData;
  let confirmationJsonContent: string;
  let confirmationFileName: string;
  let isEncrypted = false;
  let encryptionManifest: unknown;
  let encryptedDataBase64: string | undefined;

  if (hasEncryptionManifest) {
    // Handle encrypted confirmation export
    isEncrypted = true;

    // Read encryption manifest
    const manifestPath = fileEntries.find((path) =>
      getLeafFileName(path).toLowerCase() === 'encryption_manifest.json'
    );
    if (manifestPath) {
      const manifestContent = await zip.file(manifestPath)?.async('text');
      if (manifestContent) {
        encryptionManifest = JSON.parse(manifestContent);
      }
    }

    // Find and read encrypted confirmation data file
    const confirmationPaths = fileEntries.filter((path) =>
      CONFIRMATION_EXPORT_FILE_REGEX.test(getLeafFileName(path))
    );

    if (confirmationPaths.length !== 1) {
      throw new Error('Encrypted confirmation ZIP must contain exactly one confirmation-data file.');
    }

    const confirmationPath = confirmationPaths[0];
    const encryptedContent = await zip.file(confirmationPath)?.async('uint8array');
    if (!encryptedContent) {
      throw new Error('Failed to read encrypted confirmation data from ZIP package.');
    }

    encryptedDataBase64 = uint8ArrayToBase64Url(encryptedContent);
    confirmationFileName = getLeafFileName(confirmationPath);

    // For encrypted data, return placeholder confirmationData for now
    // The actual decryption will happen in confirmation-import.ts
    confirmationData = {
      metadata: {},
      confirmations: {}
    } as ConfirmationImportData;
    confirmationJsonContent = encryptedDataBase64;
  } else {
    // Handle unencrypted confirmation export (original behavior)
    const confirmationPaths = fileEntries.filter((path) =>
      CONFIRMATION_EXPORT_FILE_REGEX.test(getLeafFileName(path))
    );

    if (confirmationPaths.length !== 1) {
      throw new Error('Confirmation ZIP must contain exactly one confirmation-data JSON file.');
    }

    const confirmationPath = confirmationPaths[0];
    const confirmationJsonContentTemp = await zip.file(confirmationPath)?.async('text');
    if (!confirmationJsonContentTemp) {
      throw new Error('Failed to read confirmation JSON from ZIP package.');
    }

    confirmationData = JSON.parse(confirmationJsonContentTemp) as ConfirmationImportData;
    confirmationJsonContent = confirmationJsonContentTemp;
    confirmationFileName = getLeafFileName(confirmationPath);
  }

  const pemPaths = fileEntries.filter((path) => getLeafFileName(path).toLowerCase().endsWith('.pem'));
  const preferredPemPath = selectPreferredPemPath(pemPaths);

  let verificationPublicKeyPem: string | undefined;
  if (preferredPemPath) {
    verificationPublicKeyPem = await zip.file(preferredPemPath)?.async('text');
  }

  return {
    confirmationData,
    confirmationJsonContent,
    verificationPublicKeyPem,
    confirmationFileName,
    isEncrypted,
    encryptionManifest,
    encryptedDataBase64
  };
}

export async function extractConfirmationImportPackage(file: File): Promise<ConfirmationImportPackage> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.json')) {
    const confirmationJsonContent = await file.text();
    const confirmationData = JSON.parse(confirmationJsonContent) as ConfirmationImportData;

    return {
      confirmationData,
      confirmationJsonContent,
      confirmationFileName: file.name
    };
  }

  if (lowerName.endsWith('.zip')) {
    return extractConfirmationPackageFromZip(file);
  }

  throw new Error('Unsupported confirmation import file type. Use a confirmation JSON or confirmation ZIP file.');
}
