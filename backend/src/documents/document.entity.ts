import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../companies/company.entity';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'documents' })
@Index('UQ_documents_file_path', ['filePath'], { unique: true })
@Index('IDX_documents_company_id', ['companyId'])
@Index('IDX_documents_tax_obligation_id', ['taxObligationId'])
export class Document {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @ManyToOne(() => Company, (company) => company.documents, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' }) company!: Company;
  @Column({ name: 'tax_obligation_id', type: 'uuid' }) taxObligationId!: string;
  @ManyToOne(() => TaxObligation, (obligation) => obligation.documents, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tax_obligation_id' }) taxObligation!: TaxObligation;
  @Column({ name: 'file_name', type: 'varchar', length: 255 }) fileName!: string;
  @Column({ name: 'file_path', type: 'varchar', length: 1024 }) filePath!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 127 }) mimeType!: string;
  @Column({ name: 'file_size', type: 'integer' }) fileSize!: number;
  @Column({ name: 'uploaded_by_id', type: 'uuid' }) uploadedById!: string;
  @ManyToOne(() => User, (user) => user.uploadedDocuments, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' }) uploadedBy!: User;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}