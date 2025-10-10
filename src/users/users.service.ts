import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './create-user.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async findAll(): Promise<User[]> {
        return this.userRepo.find({ relations: ['role'] });
    }

    async findOne(id: number): Promise<User | null> {
        return this.userRepo.findOne({ where: { id }, relations: ['role'] });
    }

    async create(userData: CreateUserDto): Promise<User> {
        const password_hash = await bcrypt.hash(userData.password, 10);

        const user = this.userRepo.create({
            ...userData,
            password_hash,
        });

        // opcional: eliminar el campo password antes de guardar
        delete (user as any).password;

        return await this.userRepo.save(user);
    }

    async update(id: number, userData: any): Promise<User | null> {
        if (userData.password) {
            userData.password_hash = await bcrypt.hash(userData.password, 10);
            delete userData.password;
        }

        await this.userRepo.update(id, userData);
        return this.findOne(id); // devuelve User | null
    }

     async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email }, relations: ['role'] });
  }
}
