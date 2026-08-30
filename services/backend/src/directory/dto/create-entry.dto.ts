import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';

export class CreateDirectoryEntryDto {
  /** 32-byte hex worker key, exactly as it appears on-chain. */
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'workerKey must be 0x + 64 hex characters' })
  workerKey!: string;

  @IsString()
  @MaxLength(120)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(60)
  department!: string;

  @IsString()
  @MaxLength(60)
  jobTitle!: string;
}
