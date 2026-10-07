export type NotificationType = 'DEADLINE' | 'SYSTEM' | 'DOCUMENT' | 'AUTOMATION';

export interface TaxNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  taxObligation: { id: string; name: string } | null;
}

export interface NotificationPage {
  data: TaxNotification[];
  meta: { page: number; limit: number; total: number; pageCount: number };
}
