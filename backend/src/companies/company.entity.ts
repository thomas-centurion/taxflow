import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Country } from '../countries/country.entity';
import { Document } from '../documents/document.entity';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';

@Entity({ name: 'companies' })
@Index('UQ_companies_country_tax_id', ['countryId', 'taxId'], { unique: true })
export class Company {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 200 }) name!: string;
  @Column({ name: 'tax_id', type: 'varchar', length: 100 }) taxId!: string;
  @Column({ name: 'country_id', type: 'uuid' }) countryId!: string;
  @ManyToOne(() => Country, (country) => country.companies, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country_id' }) country!: Country;
  @Column({ type: 'varchar', length: 254, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone!: string | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
  @OneToMany(() => TaxObligation, (obligation) => obligation.company) taxObligations!: TaxObligation[];
  @OneToMany(() => Document, (document) => document.company) documents!: Document[];
}