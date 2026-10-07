import { BadRequestException, ConflictException } from '@nestjs/common';

interface DriverError { code?: string }
interface QueryFailure { driverError?: DriverError }

export function rethrowDatabaseError(error: unknown, duplicateMessage: string): never {
  const code = (error as QueryFailure | undefined)?.driverError?.code;
  if (code === '23505') throw new ConflictException(duplicateMessage);
  if (code === '23503') throw new ConflictException('This record is referenced by other records and cannot be changed or deleted.');
  if (code === '23502' || code === '23514' || code === '22P02') throw new BadRequestException('The supplied data is invalid.');
  throw error;
}