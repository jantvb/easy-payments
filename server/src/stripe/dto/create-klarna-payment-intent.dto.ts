import {
  IsIn,
  IsInt,
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
 * Trusted Klarna-via-Stripe PaymentIntent creation.
 * Amount is resolved server-side from the catalog — never trust a client amount.
 */
export class CreateKlarnaPaymentIntentDto {
  @IsIn(['klarna'])
  provider!: 'klarna';

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

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Optional Stripe Klarna preferred_locale (e.g. es-US).
   * Localization hint only — never affects trusted catalog pricing.
   */
  @IsOptional()
  @IsString()
  @MaxLength(16)
  @Matches(/^[a-z]{2}-[A-Z]{2}$/, {
    message: 'preferredLocale must look like es-US or en-US',
  })
  preferredLocale?: string;

  @IsOptional()
  @IsObject()
  @ValidateIf((_, value) => value !== undefined)
  metadata?: Record<string, string>;
}
