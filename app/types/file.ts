// File-related types and interfaces

export interface FileData {
  id: string;
  originalFilename: string;
  uploadedAt: string;
}

export interface FileUploadResponse {
  success: boolean;
  result: {
    id: string;
    filename: string;
    uploaded: string;
    variants: string[];
  };
  errors: Array<{
    code: number;
    message: string;
  }>;
  messages: string[];
}

export interface ImageUploadResponse {
  success: boolean;
  result: FileUploadResponse['result'];
  errors: FileUploadResponse['errors'];
  messages: FileUploadResponse['messages'];
}

export interface SignedImageUrlResponse {
  success: boolean;
  result: {
    fileId: string;
    url: string;
    expiresAt: string;
    expiresInSeconds: number;
  };
}

export interface ImageAccessResult {
  url: string;
  revoke: () => void;
  blob?: Blob;
  urlType: 'signed' | 'blob';
  expiresAt?: string;
}