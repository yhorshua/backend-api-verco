import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';

// Mock para ProductRepository
const mockProductRepository = {
  create: jest.fn().mockResolvedValue(new Product()),
  save: jest.fn().mockResolvedValue(new Product()),
  findOne: jest.fn().mockResolvedValue(new Product()),
  find: jest.fn().mockResolvedValue([new Product()]),
  update: jest.fn().mockResolvedValue(new Product()),
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
          useValue: mockProductRepository,  // Mock ProductRepository
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
      article_series: 'Series1',
      type_origin: 'Imported',
      manufacturing_cost: 50,
      unit_price: 100,
      stock_minimum: 10,
    };

    const result = await controller.create(createProductDto);
    expect(result).toBeDefined();
    expect(mockProductRepository.create).toHaveBeenCalledWith(createProductDto);
  });
});
