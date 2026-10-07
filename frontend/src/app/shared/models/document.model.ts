export interface TaxDocument {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  taxObligationId: string;
  uploadedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}
