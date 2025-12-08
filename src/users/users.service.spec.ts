import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Repository } from 'typeorm';

// Crear un mock de UserRepository
const mockUserRepository = {
  create: jest.fn().mockResolvedValue(new User()),
  save: jest.fn().mockResolvedValue(new User()),
  findOne: jest.fn().mockResolvedValue(new User()),
  find: jest.fn().mockResolvedValue([new User()]),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User), // Inyectamos el mock para UserRepository
          useValue: mockUserRepository, // Usamos el valor simulado del repositorio
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user', async () => {
    const createUserDto = { email: 'user@example.com', full_name: 'John Doe', password: 'password123' };
    const result = await service.create(createUserDto);
    expect(result).toBeInstanceOf(User);
    expect(mockUserRepository.create).toHaveBeenCalledWith(createUserDto);
  });

  it('should find all users', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1); // Esperamos que haya 1 usuario
    expect(mockUserRepository.find).toHaveBeenCalled();
  });

  it('should find one user by email', async () => {
    const result = await service.findByEmail('user@example.com');
    expect(result).toBeInstanceOf(User);
    expect(mockUserRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
      relations: ['role'],
    });
  });

  it('should update a user', async () => {
    const updateUserDto = { full_name: 'John Doe Updated' };
    const result = await service.update(1, updateUserDto);
    expect(result).toBeInstanceOf(User);
    expect(mockUserRepository.save).toHaveBeenCalledWith(expect.objectContaining(updateUserDto));
  });
});
