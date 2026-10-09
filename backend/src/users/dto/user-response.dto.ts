import { ApiProperty } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../../common/swagger/paginated-response.dto';
import { User } from '../user.entity';
import { UserRole } from '../user-role.enum';
import { UserOption } from '../users.service';

export class UserResponseDto implements Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'> {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Taylor' }) firstName!: string;
  @ApiProperty({ example: 'Manager' }) lastName!: string;
  @ApiProperty({ example: 'manager@taxflow.local' }) email!: string;
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' }) role!: UserRole;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class UserOptionDto implements UserOption {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() email!: string;
}

export class PaginatedUsersDto extends PaginatedResponseDto(UserResponseDto) {}
