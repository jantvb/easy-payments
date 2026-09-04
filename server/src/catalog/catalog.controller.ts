import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { getCatalogProduct, listCatalogProducts } from './product-catalog';

/**
 * Exposes the trusted demo catalog so Real / Test Providers UI can display
 * the same price the charge endpoints will use.
 */
@Controller('api/catalog')
export class CatalogController {
  @Get('products')
  listProducts() {
    return listCatalogProducts();
  }

  @Get('products/:productId')
  getProduct(@Param('productId') productId: string) {
    const product = getCatalogProduct(productId);
    if (!product) {
      throw new NotFoundException(`Unknown productId "${productId}".`);
    }
    return product;
  }
}
