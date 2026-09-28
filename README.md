# Channel Gate

NestJS demo nhận webhook từ các messaging channel và phản hồi:

```text
Đã nhận được tin nhắn "{message}" và đang xử lý
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

Mỗi provider giữ `controller`, `service` và `module` riêng. DTO webhook được gom theo channel trong `dtos/`. Token refresh chưa nằm trong scope demo.

## Endpoints

```text
GET  /facebook/webhook
POST /facebook/webhook
GET  /instagram/webhook
POST /instagram/webhook
GET  /zalo/webhook
POST /zalo/webhook
```

## Run

```bash
npm install
npm run start:dev
```

Sao chép `.env.example` thành `.env` và điền credentials của các channel cần chạy.
