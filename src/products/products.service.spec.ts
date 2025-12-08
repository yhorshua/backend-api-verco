import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { Product } from '../database/entities/product.entity';
import { Stock } from '../database/entities/stock.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';


// Creamos los mocks para el repositorio de Product y Stock
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

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product), // Inyectamos el mock para ProductRepository
          useValue: mockProductRepository,
        },
        {
          provide: getRepositoryToken(Stock), // Inyectamos el mock para StockRepository
          useValue: mockStockRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a product', async () => {
    const createProductDto = new CreateProductDto();
    createProductDto.article_code = 'A123';
    createProductDto.article_description = 'Test Product';
    createProductDto.article_series = 'Series1';
    createProductDto.type_origin = 'Imported';
    createProductDto.unit_price = 100;
    createProductDto.stock_minimum = 10;

    const result = await service.create(createProductDto);
    expect(result).toBeInstanceOf(Product);
    expect(mockProductRepository.create).toHaveBeenCalledWith(createProductDto);
  });

  it('should find all products', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1); // Esperamos que haya 1 producto
    expect(mockProductRepository.find).toHaveBeenCalled();
  });

  it('should find one product', async () => {
    const result = await service.findOne(1);
    expect(result).toBeInstanceOf(Product);
    expect(mockProductRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      relations: ['sizes', 'series'],
    });
  });

  it('should update a product', async () => {
    const updateProductDto = new UpdateProductDto();
    updateProductDto.article_description = 'Updated Product';
    updateProductDto.unit_price = 150;

    const result = await service.update(1, updateProductDto);
    expect(result).toBeInstanceOf(Product);
    expect(mockProductRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateProductDto));
  });

  it('should disable a product', async () => {
    const result = await service.disable(1);
    expect(result.status).toBe(false);
    expect(mockProductRepository.save).toHaveBeenCalled();
  });
});
