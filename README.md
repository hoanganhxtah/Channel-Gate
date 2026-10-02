# Channel Gate

NestJS service nhận webhook từ các messaging channel, gọi trực tiếp Agent
Service và gửi câu trả lời của agent về đúng channel.

```text
Social webhook -> Channel Gate -> POST Agent Service /agent -> Social reply
```

## Structure

```text
src/
├── dtos/            # Webhook contracts, chia theo từng channel
├── providers/       # Facebook, Instagram, Zalo và các channel tiếp theo
├── services/        # Nghiệp vụ dùng chung giữa nhiều provider
├── infrastructure/  # Config, logging và telemetry
├── app.module.ts
└── main.ts
```

Mỗi provider giữ `controller`, `service` và `module` riêng. DTO webhook được gom
theo channel trong `dtos/`. `AgentClientService` là HTTP client dùng chung để gọi
Agent Service. Token refresh chưa nằm trong scope demo.

## Endpoints

```text
GET  /facebook/webhook
POST /facebook/webhook
GET  /instagram/webhook
POST /instagram/webhook
POST /zalo/webhook
```

## Run

```bash
npm install
npm run start:dev
```

Sao chép `.env.example` thành `.env` và điền credentials của các channel cần chạy.

Khi chạy toàn bộ service trực tiếp trên máy local:

```env
AGENT_SERVICE_URL=http://localhost:8001
AGENT_SERVICE_TIMEOUT_MS=60000
```

`thread_id` được tạo ổn định theo `channel:channel_id:user_id`; `session_id` là
UUID mới cho mỗi lần Channel Gate gọi Agent Service.
