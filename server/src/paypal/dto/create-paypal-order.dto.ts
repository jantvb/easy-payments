import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Browser may send productId + quantity (+ optional currency hint).
 * The trusted charge amount is resolved server-side from the product catalog.
 * Client-supplied amounts are intentionally not accepted.
 */
export class CreatePayPalOrderDto {
  @IsIn(['paypal'])
  provider!: 'paypal';

  @IsString()
  @MaxLength(128)
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  /** Optional hint; must match the catalog currency when provided. */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code (e.g. USD)' })
  currency?: string;
}
