export class ZaloSenderDto {
  id?: string;
}

export class ZaloMessageDto {
  text?: string;
  msg_id?: string;
}

export class ZaloWebhookDto {
  event_name?: string;
  app_id?: string;
  sender?: ZaloSenderDto;
  recipient?: { id?: string };
  message?: ZaloMessageDto;
  timestamp?: string;
}
