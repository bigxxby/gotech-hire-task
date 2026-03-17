import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

interface TokenPayload {
  userId: number;
  username: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', 'change-me-in-production');
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  private async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async register(username: string, password: string): Promise<{ token: string; userId: number }> {
    const existing = await this.userRepository.findOne({ where: { username } });
    if (existing) {
      throw new ConflictException('Username already taken');
    }

    const hashed = await this.hashPassword(password);
    const user = this.userRepository.create({ username, password: hashed });
    const saved = await this.userRepository.save(user);

    const token = jwt.sign(
      { userId: saved.id, username } as TokenPayload,
      this.jwtSecret,
      { expiresIn: '24h' },
    );
    return { token, userId: saved.id };
  }

  async login(username: string, password: string): Promise<{ token: string; userId: number } | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();

    if (!user) {
      return null;
    }

    const isValid = await this.comparePassword(password, user.password);
    if (!isValid) {
      return null;
    }

    const token = jwt.sign(
      { userId: user.id, username } as TokenPayload,
      this.jwtSecret,
      { expiresIn: '24h' },
    );
    return { token, userId: user.id };
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      return null;
    }
  }
}
