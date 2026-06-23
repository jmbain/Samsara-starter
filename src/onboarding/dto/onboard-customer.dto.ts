import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class OnboardCustomerDto {
  @ApiProperty({ description: 'Busie customer ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Samsara API token from the customer\'s Samsara Dashboard' })
  @IsString()
  @IsNotEmpty()
  apiToken: string;
}
