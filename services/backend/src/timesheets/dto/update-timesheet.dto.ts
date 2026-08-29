import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTimesheetDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  hours?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
