import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findById(id: number): Promise<{ id: number; username: string; role: string } | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;
    return { id: user.id, username: user.username, role: user.role };
  }
}
