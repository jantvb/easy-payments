import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  let controller: CatalogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
    }).compile();
    controller = module.get(CatalogController);
  });

  it('returns premium-plan with trusted unit amount 99.99', () => {
    expect(controller.getProduct('premium-plan')).toEqual(
      expect.objectContaining({
        id: 'premium-plan',
        unitAmount: 99.99,
        currency: 'USD',
        name: 'Premium Plan',
      }),
    );
  });

  it('lists catalog products', () => {
    const products = controller.listProducts();
    expect(products.some((p) => p.id === 'premium-plan')).toBe(true);
  });

  it('404s unknown products', () => {
    expect(() => controller.getProduct('nope')).toThrow(NotFoundException);
  });
});
