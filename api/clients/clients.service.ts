import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../database/entities/client.entity';
import { CreateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto, sellerId: number): Promise<Client> {
    const client = this.clientRepository.create({
      ...dto,
      seller_id: sellerId,
    });
    return await this.clientRepository.save(client);
  }
}
