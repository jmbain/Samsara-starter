import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateLiveShareDto {
  @ApiProperty({ description: 'Busie customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Samsara asset ID (vehicle)' })
  @IsString()
  @IsNotEmpty()
  samsaraAssetId: string;

  @ApiProperty({ description: 'Busie vehicle ID' })
  @IsString()
  @IsNotEmpty()
  busieVehicleId: string;

  @ApiPropertyOptional({
    description: 'Link expiry as an RFC 3339 string (e.g. "2026-06-17T18:00:00Z"). ' +
      'Do NOT use millisecond timestamps — Samsara API requires ISO 8601 / RFC 3339.',
    example: '2026-06-17T18:00:00Z',
  })
  @IsString()
  @IsOptional()
  expiresAtTime?: string;
}
