import { IsOptional, IsString } from 'class-validator';

export class RejectTimesheetDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
