export class FacebookMessageDto {
  mid?: string;
  text?: string;
  is_echo?: boolean;
}

export class FacebookMessagingEventDto {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: FacebookMessageDto;
}

export class FacebookEntryDto {
  time?: number;
  id?: string;
  messaging?: FacebookMessagingEventDto[];
}

export class FacebookWebhookDto {
  object?: string;
  entry?: FacebookEntryDto[];
}
