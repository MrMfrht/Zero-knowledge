import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateTimesheetDto {
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'workerKey must be 0x + 64 hex characters' })
  workerKey!: string;

  @Matches(/^\d{4}-\d{2}$/, { message: 'period must be YYYY-MM' })
  period!: string;

  @IsNumber()
  @Min(1)
  hours!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
