import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { CountryResponseDto } from '../../countries/dto/country-response.dto';
import { Company } from '../company.entity';

export class CompanyResponseDto implements Pick<Company, 'id' | 'name' | 'taxId' | 'countryId' | 'email' | 'phone' | 'isActive' | 'createdAt' | 'updatedAt'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'ACME Argentina S.A.' }) name!: string;
  @ApiProperty({ example: '30-71234567-9', description: 'Tax identifier, unique per country.' }) taxId!: string;
  @ApiProperty({ format: 'uuid' }) countryId!: string;
  @ApiProperty({ type: CountryResponseDto }) country!: CountryResponseDto;
  @ApiProperty({ type: String, nullable: true, example: 'tax@acme.example' }) email!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '+54 11 5555-0000' }) phone!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PaginatedCompaniesDto extends PaginatedResponseDto(CompanyResponseDto) {}
