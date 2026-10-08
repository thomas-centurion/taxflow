import { ApiProperty } from '@nestjs/swagger';
import { CompanyResponseDto } from '../../companies/dto/company-response.dto';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { CountryResponseDto } from '../../countries/dto/country-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { TaxObligation } from '../tax-obligation.entity';
import { TaxObligationStatus } from '../tax-obligation-status.enum';
import { TaxObligationType } from '../tax-obligation-type.enum';

export class TaxObligationResponseDto implements Pick<TaxObligation, 'id' | 'companyId' | 'countryId' | 'name' | 'description' | 'type' | 'status' | 'dueDate' | 'responsibleUserId' | 'createdAt' | 'updatedAt'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ type: CompanyResponseDto }) company!: CompanyResponseDto;
  @ApiProperty({ format: 'uuid' }) countryId!: string;
  @ApiProperty({ type: CountryResponseDto }) country!: CountryResponseDto;
  @ApiProperty({ example: 'IVA mensual — octubre' }) name!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: TaxObligationType, enumName: 'TaxObligationType' }) type!: TaxObligationType;
  @ApiProperty({ enum: TaxObligationStatus, enumName: 'TaxObligationStatus' }) status!: TaxObligationStatus;
  @ApiProperty({ format: 'date', example: '2026-10-20' }) dueDate!: string;
  @ApiProperty({ type: String, format: 'uuid', nullable: true }) responsibleUserId!: string | null;
  @ApiProperty({ type: UserResponseDto, nullable: true }) responsibleUser!: UserResponseDto | null;
  @ApiProperty({ description: 'Derived: OVERDUE, or PENDING/IN_PROGRESS with a past due date (backend timezone).' }) isOverdue!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PaginatedTaxObligationsDto extends PaginatedResponseDto(TaxObligationResponseDto) {}
