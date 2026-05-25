# Order Service

A NestJS microservice that accepts customer orders, publishes `order.created` events to Kafka, and reconciles order status from inventory events (`inventory.reserved`, `inventory.rejected`).

Built with [NestJS 11](https://nestjs.com/), [@nestjs/microservices](https://docs.nestjs.com/microservices/kafka), and [kafkajs](https://kafka.js.org/).

## Architecture

```
 HTTP client ──▶ OrdersController ──▶ OrdersService ──▶ Kafka (ORDERS_KAFKA)
                                           ▲                     │
                                           │                     ▼
                                  inventory.reserved /     order.created
                                  inventory.rejected
                                  (consumed by Inventory Service)
```

- Orders are kept in-memory in `OrdersService.orderMap` (no persistence yet).
- The Kafka client is registered in `OrdersModule` under the token `ORDERS_KAFKA` with `producerOnlyMode: true` — this service emits events and listens via `@EventPattern` handlers, but does not maintain a separate consumer group via the client.

## Project setup

```bash
npm install
```

## Configuration

| Variable        | Default            | Description              |
| --------------- | ------------------ | ------------------------ |
| `KAFKA_BROKER`  | `localhost:9092`   | Kafka broker address     |

## Running the service

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

Kafka must be reachable at `KAFKA_BROKER` before startup — `OrdersService.onModuleInit` calls `kafka.connect()`.

## HTTP API

| Method | Path             | Description                                            |
| ------ | ---------------- | ------------------------------------------------------ |
| POST   | `/orders`        | Create an order. Body: `{ customerId, items[] }`       |
| GET    | `/orders`        | List all orders                                        |
| GET    | `/orders/:id`    | Fetch a single order by numeric id (e.g. `1` → `ORD001`) |
| GET    | `/orders/health` | Kafka connectivity health check                        |
| PATCH  | `/orders/:id`    | Update an order (stub)                                 |
| DELETE | `/orders/:id`    | Remove an order (stub)                                 |

### Example: create an order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
        "customerId": "cust-42",
        "items": [
          { "productId": "p-1", "quantity": 2, "price": 19.99 }
        ]
      }'
```

### Health check

`GET /orders/health` calls `kafka.connect()` (idempotent) and returns:

```json
{ "status": "ok", "kafka": "connected" }
```

or, on failure:

```json
{ "status": "error", "kafka": "disconnected", "message": "Error checking Kafka connection" }
```

Because the client runs in `producerOnlyMode`, the check only verifies the producer is reachable.

## Kafka topics

| Topic                | Direction | Payload                                                  |
| -------------------- | --------- | -------------------------------------------------------- |
| `order.created`      | produced  | `{ orderId, customerId, items[] }`                       |
| `inventory.reserved` | consumed  | `{ orderId, reservedAt }` → marks order `CONFIRMED`      |
| `inventory.rejected` | consumed  | `{ orderId, reason, shortages? }` → marks order `REJECTED` |

## Tests

```bash
npm run test       # unit
npm run test:e2e   # end-to-end
npm run test:cov   # coverage
```
