import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Matches the Angular easy-payments CreatePaymentRequest contract for Stripe.
 *
 * Trusted pricing: the demo server resolves unit amount from productId via the
 * server-side catalog. A client-supplied `amount` is accepted for backwards
 * compatibility with older demos but is IGNORED when the product is in the catalog.
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
   * Optional legacy unit amount from the browser.
   * Ignored when productId exists in the trusted catalog.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(999999)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  @ValidateIf((_, value) => value !== undefined)
  metadata?: Record<string, string>;
}
