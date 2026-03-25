import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

import { Client } from '../database/entities/client.entity';
import { User } from '../database/entities/user.entity';
import { DocumentType } from '../database/entities/document-types.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, User, DocumentType]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
