import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { Stock } from '../database/entities/stock.entity';

// Mocks para ProductRepository y StockRepository
const mockProductRepository = {
  create: jest.fn().mockResolvedValue(new Product()),
  save: jest.fn().mockResolvedValue(new Product()),
  findOne: jest.fn().mockResolvedValue(new Product()),
  find: jest.fn().mockResolvedValue([new Product()]),
  update: jest.fn().mockResolvedValue(new Product()),
};

const mockStockRepository = {
  create: jest.fn().mockResolvedValue(new Stock()),
  save: jest.fn().mockResolvedValue(new Stock()),
  findOne: jest.fn().mockResolvedValue(new Stock()),
  find: jest.fn().mockResolvedValue([new Stock()]),
};

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Stock),
          useValue: mockStockRepository,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

it('should create a product', async () => {
  const createProductDto = {
    article_code: 'A123',
    article_description: 'Test Product',
    article_series: 'Series1',          // Agregado el campo `article_series`
    type_origin: 'Imported',           // Agregado el campo `type_origin`
    manufacturing_cost: 50,            // Agregado el campo `manufacturing_cost`
    unit_price: 100,                   // Agregado el campo `unit_price`
    stock_minimum: 10,                 // Agregado el campo `stock_minimum`
  };

  const result = await controller.create(createProductDto);

  // Comprobamos que el producto ha sido creado
  expect(result).toBeDefined();
  
  // Verificamos que el método create de ProductRepository haya sido llamado correctamente
  expect(mockProductRepository.create).toHaveBeenCalledWith(createProductDto);
});

});
