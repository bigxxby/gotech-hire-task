import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Room } from '../entities/room.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Room)
    private roomRepository: Repository<Room>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async getRooms(): Promise<Room[]> {
    return this.roomRepository.find();
  }

  async createRoom(name: string, description?: string): Promise<Room> {
    const existing = await this.roomRepository.findOne({ where: { name } });
    if (existing) {
      return existing;
    }
    const room = this.roomRepository.create({ name, description });
    return this.roomRepository.save(room);
  }

  async getMessages(
    roomId: number,
    limit: number,
    beforeId?: number,
  ): Promise<{ id: number; roomId: number; userId: number; content: string; senderName: string; username: string; createdAt: Date }[]> {
    const whereConditions: Record<string, unknown> = { roomId };
    if (beforeId) {
      whereConditions.id = LessThan(beforeId);
    }

    const messages = await this.messageRepository.find({
      where: whereConditions,
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: limit,
    });

    return messages.map((msg) => ({
      id: msg.id,
      roomId: msg.roomId,
      userId: msg.userId,
      content: msg.content,
      senderName: msg.senderName,
      username: msg.user?.username ?? 'unknown',
      createdAt: msg.createdAt,
    }));
  }

  async saveMessage(
    roomId: number,
    userId: number,
    content: string,
    senderName: string,
  ): Promise<Message> {
    const message = this.messageRepository.create({
      roomId,
      userId,
      content,
      senderName,
    });
    return this.messageRepository.save(message);
  }
}
