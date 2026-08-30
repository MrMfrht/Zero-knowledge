import { IsIn, IsString, Matches } from 'class-validator';

export class CreateNotificationDto {
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'workerKey must be 0x + 64 hex characters' })
  workerKey!: string;

  @IsIn(['payment-due', 'unconfirmed-period', 'timesheet-submitted', 'offer-pending'])
  type!: 'payment-due' | 'unconfirmed-period' | 'timesheet-submitted' | 'offer-pending';

  @IsString()
  message!: string;
}
