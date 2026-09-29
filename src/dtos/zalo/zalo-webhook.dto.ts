export class ZaloBotUserDto {
  id?: string;
  username?: string;
  display_name?: string;
}

export class ZaloBotChatDto {
  id?: string;
  chat_type?: string;
}

export class ZaloBotMessageDto {
  message_id?: string;
  from?: ZaloBotUserDto;
  chat?: ZaloBotChatDto;
  text?: string;
  date?: number;
}

export class ZaloWebhookDto {
  event_name?: string;
  message?: ZaloBotMessageDto;
}
