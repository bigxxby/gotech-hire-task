import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';

const DEFAULT_PAGE_SIZE = 50;

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('rooms')
  async getRooms() {
    return this.chatService.getRooms();
  }

  @Post('rooms')
  async createRoom(@Body() dto: CreateRoomDto) {
    return this.chatService.createRoom(dto.name, dto.description);
  }

  @Get('rooms/:roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const pageSize = limit ? parseInt(limit, 10) : DEFAULT_PAGE_SIZE;
    const beforeId = before ? parseInt(before, 10) : undefined;
    return this.chatService.getMessages(parseInt(roomId, 10), pageSize, beforeId);
  }
}
