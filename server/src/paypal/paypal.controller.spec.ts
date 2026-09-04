import { Test, TestingModule } from '@nestjs/testing';
import { CapturePayPalOrderDto } from './dto/capture-paypal-order.dto';
import { CreatePayPalOrderDto } from './dto/create-paypal-order.dto';
import { PayPalController } from './paypal.controller';
import { PayPalService } from './paypal.service';

describe('PayPalController', () => {
  it('delegates create and capture', async () => {
    const paypalService = {
      createOrder: jest.fn().mockResolvedValue({ provider: 'paypal', orderId: 'O-1' }),
      captureOrder: jest.fn().mockResolvedValue({
        provider: 'paypal',
        orderId: 'O-1',
        captureId: 'C-1',
        status: 'COMPLETED',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PayPalController],
      providers: [{ provide: PayPalService, useValue: paypalService }],
    }).compile();

    const controller = module.get(PayPalController);

    const createDto: CreatePayPalOrderDto = {
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
    };
    await expect(controller.createOrder(createDto)).resolves.toEqual({
      provider: 'paypal',
      orderId: 'O-1',
    });
    expect(paypalService.createOrder).toHaveBeenCalledWith(createDto);

    const captureDto: CapturePayPalOrderDto = { orderId: 'O-1' };
    await expect(controller.captureOrder(captureDto)).resolves.toEqual(
      expect.objectContaining({ captureId: 'C-1' }),
    );
    expect(paypalService.captureOrder).toHaveBeenCalledWith('O-1');
  });
});
