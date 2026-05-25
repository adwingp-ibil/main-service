import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  items: OrderItem[];
}

@Injectable()
export class InventoryService implements OnModuleInit {
  private readonly logger = new Logger(InventoryService.name);

  // Seeded stock — in a real service this would be a database.
  private stock = new Map<string, number>([
    ['SKU-1', 10],
    ['SKU-2', 5],
    ['SKU-3', 0],
  ]);

  constructor(
    @Inject('INVENTORY_KAFKA') private readonly kafka: ClientKafka,
  ) {}

  async onModuleInit() {
    await this.kafka.connect();
  }

  handleOrderCreated(event: OrderCreatedEvent) {
    this.logger.log(`Received order.created for ${event.orderId}`);

    const shortages: { productId: string; requested: number; available: number }[] = [];
    for (const item of event.items) {
      const available = this.stock.get(item.productId) ?? 0;
      if (available < item.quantity) {
        shortages.push({ productId: item.productId, requested: item.quantity, available });
      }
    }

    if (shortages.length > 0) {
      const payload = {
        orderId: event.orderId,
        reason: 'INSUFFICIENT_STOCK',
        shortages,
      };
      this.logger.warn(`Rejecting order ${event.orderId}: ${JSON.stringify(shortages)}`);
      this.kafka.emit('inventory.rejected', payload);
      return;
    }

    for (const item of event.items) {
      this.stock.set(item.productId, (this.stock.get(item.productId) ?? 0) - item.quantity);
    }

    const payload = {
      orderId: event.orderId,
      reservedAt: new Date().toISOString(),
      items: event.items,
    };
    this.logger.log(`Reserved stock for order ${event.orderId}`);
    this.kafka.emit('inventory.reserved', payload);
  }

  create(createInventoryDto: CreateInventoryDto) {
    return 'This action adds a new inventory';
  }

  findAll() {
    return Array.from(this.stock.entries()).map(([productId, quantity]) => ({ productId, quantity }));
  }

  findOne(id: number) {
    return `This action returns a #${id} inventory`;
  }

  update(id: number, updateInventoryDto: UpdateInventoryDto) {
    return `This action updates a #${id} inventory`;
  }

  remove(id: number) {
    return `This action removes a #${id} inventory`;
  }
}
