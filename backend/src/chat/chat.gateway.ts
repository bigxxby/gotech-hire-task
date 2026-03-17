import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';

const ROOM_PREFIX = 'room_';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnModuleInit, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
  ) {}

  onModuleInit() {
    this.server.use((socket, next) => {
      const token = socket.handshake.auth?.token as string;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = this.authService.verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      socket.data.user = decoded;
      next();
    });
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`${ROOM_PREFIX}${data.roomId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: { roomId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;
    if (!user) return;

    const message = await this.chatService.saveMessage(
      data.roomId,
      user.userId,
      data.content,
      user.username,
    );

    this.server.to(`${ROOM_PREFIX}${data.roomId}`).emit('newMessage', {
      id: message.id,
      roomId: message.roomId,
      userId: message.userId,
      content: message.content,
      senderName: message.senderName,
      username: user.username,
      createdAt: message.createdAt,
    });
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: number },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`${ROOM_PREFIX}${data.roomId}`);
  }
}
