import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectCustomerDto {
  @ApiProperty({
    description:
      'Unique identifier for the customer. Used as a prefix in all provisioned topic names: samsara.{customerId}.{entity-slug}.',
    example: 'cust_001',
  })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({
    description:
      'Human-readable name for the customer. Used in service account display names for easier identification in the Confluent Console.',
    example: 'Acme Transit',
  })
  @IsString()
  @IsOptional()
  customerName?: string;
}
