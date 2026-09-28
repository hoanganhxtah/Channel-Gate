import { Injectable } from '@nestjs/common';

@Injectable()
export class ReplyMessageService {
  create(message: string): string {
    return `Đã nhận được tin nhắn "${message}" và đang xử lý`;
  }
}
