import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from '../database/entities/product.entity';
import { Stock } from '../database/entities/stock.entity';

const mockProductsService = {
  findAll: jest.fn().mockResolvedValue([new Product()]),
  findOne: jest.fn().mockResolvedValue(new Product()),
  create: jest.fn().mockResolvedValue(new Product()),
  update: jest.fn().mockResolvedValue(new Product()),
  disable: jest.fn().mockResolvedValue(new Product()),
};

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
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
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
});
