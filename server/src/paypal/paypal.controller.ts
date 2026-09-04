import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CapturePayPalOrderDto } from './dto/capture-paypal-order.dto';
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto';
import { PayPalService } from './paypal.service';

/**
 * Provider-aware PayPal endpoints.
 *
 * Architecture decision (scales to future providers):
 * - Stripe PaymentIntent create stays at POST /api/payments/create
 * - PayPal uses POST /api/payments/paypal/create and .../capture
 * - Each provider keeps a clear create (+ capture when required) surface
 * - Shared trusted catalog lives in catalog/product-catalog.ts
 */
@Controller('api/payments/paypal')
export class PayPalController {
  constructor(private readonly paypalService: PayPalService) {}

  @Post('create')
  @HttpCode(201)
  createOrder(@Body() body: CreatePayPalOrderDto) {
    return this.paypalService.createOrder(body);
  }

  @Post('capture')
  @HttpCode(200)
  captureOrder(@Body() body: CapturePayPalOrderDto) {
    return this.paypalService.captureOrder(body.orderId);
  }
}
