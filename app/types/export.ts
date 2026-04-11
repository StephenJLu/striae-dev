// Export-related types and interfaces

export interface ExportOptions {
  includeMetadata?: boolean;
  includeUserInfo?: boolean;
  protectForensicData?: boolean;
  designatedReviewerEmail?: string;
  includeBundledAuditTrail?: boolean;
  useArchiveFileName?: boolean;
}