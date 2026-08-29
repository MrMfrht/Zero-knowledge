import { IsString, Matches } from 'class-validator';

export class RecordOnChainDto {
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{64}$/, { message: 'onchainTxHash must be 0x + 64 hex characters' })
  onchainTxHash!: string;
}
