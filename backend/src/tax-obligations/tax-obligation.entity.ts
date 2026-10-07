import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Company } from '../companies/company.entity';
import { Country } from '../countries/country.entity';
import { Document } from '../documents/document.entity';
import { User } from '../users/user.entity';
import { TaxObligationStatus } from './tax-obligation-status.enum';
import { TaxObligationType } from './tax-obligation-type.enum';

@Entity({ name: 'tax_obligations' })
@Index('UQ_tax_obligations_seed_key', ['companyId', 'name', 'type', 'dueDate'], { unique: true })
@Index('IDX_tax_obligations_status_due_date', ['status', 'dueDate'])
@Index('IDX_tax_obligations_responsible_user_id', ['responsibleUserId'])
export class TaxObligation {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId!: string;
  @ManyToOne(() => Company, (company) => company.taxObligations, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' }) company!: Company;
  @Column({ name: 'country_id', type: 'uuid' }) countryId!: string;
  @ManyToOne(() => Country, (country) => country.taxObligations, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country_id' }) country!: Country;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'enum', enum: TaxObligationType, enumName: 'tax_obligation_type_enum' }) type!: TaxObligationType;
  @Column({ type: 'enum', enum: TaxObligationStatus, enumName: 'tax_obligation_status_enum' }) status!: TaxObligationStatus;
  @Column({ name: 'due_date', type: 'date' }) dueDate!: string;
  @Column({ name: 'responsible_user_id', type: 'uuid', nullable: true }) responsibleUserId!: string | null;
  @ManyToOne(() => User, (user) => user.assignedObligations, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsible_user_id' }) responsibleUser!: User | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @OneToMany(() => Document, (document) => document.taxObligation) documents!: Document[];
}