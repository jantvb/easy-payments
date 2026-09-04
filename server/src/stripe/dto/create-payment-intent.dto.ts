import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Matches the Angular easy-payments CreatePaymentRequest contract.
 *
 * IMPORTANT (production):
 * Do not trust `amount` from the browser as the final charge.
 * A real merchant backend should look up productId and compute price server-side.
 * This local demo accepts amount so Stripe TEST MODE can be exercised end to end.
 */
export class CreatePaymentIntentDto {
  @IsIn(['stripe'])
  provider!: 'stripe';

  @IsString()
  @MaxLength(128)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code (e.g. USD)' })
  currency!: string;

  /**
   * Unit amount in major currency units (e.g. 99.99 for $99.99).
   * Converted to Stripe minor units (cents) on the server.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(999999)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  @ValidateIf((_, value) => value !== undefined)
  metadata?: Record<string, string>;
}
