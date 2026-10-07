import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Company } from '../companies/company.entity';
import { TaxObligation } from '../tax-obligations/tax-obligation.entity';

@Entity({ name: 'countries' })
@Index('UQ_countries_code', ['code'], { unique: true })
export class Country {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 2 }) code!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @OneToMany(() => Company, (company) => company.country) companies!: Company[];
  @OneToMany(() => TaxObligation, (obligation) => obligation.country) taxObligations!: TaxObligation[];
}