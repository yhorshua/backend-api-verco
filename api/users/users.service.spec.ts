import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Mock de UsersService
const mockUsersService = {
  findAll: jest.fn().mockResolvedValue([]), // Mock para 'findAll'
  findOne: jest.fn().mockResolvedValue(null), // Mock para 'findOne'
  create: jest.fn().mockResolvedValue({}), // Mock para 'create'
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService, // Usamos el mock del UsersService
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a user', async () => {
    const createUserDto = { 
      email: 'user@example.com', 
      full_name: 'John Doe', 
      password: 'password123',
    };
    const result = await controller.create(createUserDto);
    expect(result).toBeDefined();
    expect(mockUsersService.create).toHaveBeenCalledWith(createUserDto);
  });
});
