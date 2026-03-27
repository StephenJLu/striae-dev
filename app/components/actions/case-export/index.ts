// Re-export all case export functionality from the modular structure
// This maintains backward compatibility with existing imports

// Types and constants
export { CSV_HEADERS, formatDateForFilename } from './types-constants';

// Metadata and protection helpers
export {
  getUserExportMetadata,
  addForensicDataWarning,
  generateRandomPassword,
  protectExcelWorksheet
} from './metadata-helpers';

// Data processing functions
export {
  generateMetadataRows,
  processFileDataForTabular,
  generateCSVContent
} from './data-processing';

// Core export functions
export {
  exportAllCases,
  exportCaseData
} from './core-export';

// Download handlers
export {
  downloadCaseAsZip
} from './download-handlers';

// Validation utilities
export {
  validateCaseNumberForExport
} from './validation-utils';