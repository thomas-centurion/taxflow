import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { Country } from '../country.entity';

export class CountryResponseDto implements Pick<Country, 'id' | 'name' | 'code' | 'createdAt'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Argentina' }) name!: string;
  @ApiProperty({ example: 'AR', description: 'ISO 3166-1 alpha-2 code.' }) code!: string;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedCountriesDto extends PaginatedResponseDto(CountryResponseDto) {}
