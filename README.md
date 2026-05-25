# Interview — Order ↔ Inventory via Kafka

Two NestJS microservices communicating through Apache Kafka, orchestrated with Docker Compose.

```
                    ┌──────────────────┐                     ┌──────────────────┐
   POST /orders ──▶ │  order-service   │ ── order.created ──▶│ inventory-service│
                    │   (port 3001)    │                     │   (port 3000)    │
                    │                  │◀── inventory.* ─────│                  │
                    └──────────────────┘   reserved/rejected └──────────────────┘
                                  │                                   │
                                  └──────────────▶ Kafka ◀────────────┘
                                              (localhost:9092)
```

## Services

| Service             | Port | Role                                                                  |
| ------------------- | ---- | --------------------------------------------------------------------- |
| `order-service`     | 3001 | HTTP API for orders. Publishes `order.created`; consumes inventory replies. |
| `inventory-service` | 3000 | Holds stock. Consumes `order.created`; publishes `inventory.reserved` / `inventory.rejected`. |
| `kafka`             | 9092 | Broker (host listener `localhost:9092`, internal listener `kafka:29092`). |
| `zookeeper`         | 2181 | Coordination for Kafka.                                               |
| `kafka-init`        | —    | One-shot job that pre-creates the three topics on startup.            |

## Kafka topics

- `order.created` — emitted by `order-service` on every `POST /orders`.
- `inventory.reserved` — emitted by `inventory-service` when stock is available and decremented.
- `inventory.rejected` — emitted by `inventory-service` when any item is short.

Consumer groups: `order-consumer` (order-service), `inventory-consumer` (inventory-service).

## Run everything in Docker

```bash
docker compose up --build
```

This starts Zookeeper, Kafka, creates topics, then boots both services. Source folders are bind-mounted, so `start:dev` reloads on host edits.

## Run services on the host (Kafka in Docker)

```bash
docker compose up -d zookeeper kafka kafka-init

npm --prefix order-service install
npm --prefix inventory-service install

npm --prefix order-service run start:dev
npm --prefix inventory-service run start:dev
```

Services read `KAFKA_BROKER` (default `localhost:9092`).

## Trying the flow

`inventory-service` is seeded with: `SKU-1: 10`, `SKU-2: 5`, `SKU-3: 0`.

Happy path — order is confirmed:

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"C1","items":[{"productId":"SKU-1","quantity":2,"price":10}]}'

# Initially: status = PENDING
# After inventory consumes the event: status = CONFIRMED
curl http://localhost:3001/orders
```

Rejection path — `SKU-3` is out of stock:

```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{"customerId":"C2","items":[{"productId":"SKU-3","quantity":1,"price":5}]}'

# Status becomes REJECTED with reason "INSUFFICIENT_STOCK".
```

Check stock at any time:

```bash
curl http://localhost:3000/inventory
```

## Layout

```
interview/
├── docker-compose.yml          # zookeeper, kafka, kafka-init, both services
├── order-service/
│   ├── DockerFile
│   └── src/
│       ├── main.ts             # HTTP + Kafka microservice (group order-consumer)
│       └── orders/
│           ├── orders.module.ts        # registers ClientKafka producer
│           ├── orders.controller.ts    # POST /orders + @EventPattern handlers
│           └── orders.service.ts       # emits order.created, updates status on replies
└── inventory-service/
    ├── DockerFile
    └── src/
        ├── main.ts             # HTTP + Kafka microservice (group inventory-consumer)
        └── inventory/
            ├── inventory.module.ts     # registers ClientKafka producer
            ├── inventory.controller.ts # @EventPattern('order.created')
            └── inventory.service.ts    # in-memory stock, emits reserved/rejected
```

## Notes & limitations

- Orders and stock live in **in-memory `Map`s** — restart wipes state. Swap for a database in a real system.
- `@EventPattern` is fire-and-forget; the order is created `PENDING` and reconciled asynchronously when the reply event arrives.
- `KAFKA_AUTO_CREATE_TOPICS_ENABLE` is on as a safety net, but `kafka-init` pre-creates the topics so the services don't race the broker on first boot.
- Override the broker by setting `KAFKA_BROKER` (e.g. `KAFKA_BROKER=kafka.prod:9092`).
