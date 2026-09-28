export class InstagramMessageDto {
  mid?: string;
  text?: string;
  is_echo?: boolean;
}

export class InstagramMessagingEventDto {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: InstagramMessageDto;
  postback?: Record<string, unknown>;
  read?: { watermark?: number };
  delivery?: Record<string, unknown>;
}

export class InstagramEntryDto {
  time?: number;
  id?: string;
  messaging?: InstagramMessagingEventDto[];
  standby?: InstagramMessagingEventDto[];
}

export class InstagramWebhookDto {
  object?: string;
  entry?: InstagramEntryDto[];
}
