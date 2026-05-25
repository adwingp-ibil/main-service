import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

interface OrderRecord {
  customerId: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  totalAmount: number;
  rejectionReason: string;
  items: any[];
  createdAt: string;
  updatedAt?: string;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  private orderMap = new Map<string, OrderRecord>();

  constructor(
    @Inject('ORDERS_KAFKA') private readonly kafka: ClientKafka,
  ) { }

  async onModuleInit() {
    await this.kafka.connect();
  }

  create(createOrderDto: CreateOrderDto) {
    const orderId = `ORD${String(this.orderMap.size + 1).padStart(3, '0')}`;

    let totalAmount = 0;
    const itemsCalculation = createOrderDto.items.map((item, index) => {
      totalAmount += item.quantity * item.price;
      return {
        index,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.quantity * item.price,
      };
    });

    const orderData: OrderRecord = {
      customerId: createOrderDto.customerId,
      status: 'PENDING',
      totalAmount,
      rejectionReason: 'None',
      items: createOrderDto.items,
      createdAt: new Date().toISOString(),
    };

    this.orderMap.set(orderId, orderData);

    this.kafka.emit('order.created', {
      orderId,
      customerId: createOrderDto.customerId,
      items: createOrderDto.items,
    });
    this.logger.log(`Published order.created for ${orderId}`);

    return {
      success: true,
      data: { orderId, ...orderData, itemsCalculation },
    };
  }

  handleInventoryReserved(event: { orderId: string; reservedAt: string }) {
    const order = this.orderMap.get(event.orderId);
    if (!order) {
      this.logger.warn(`inventory.reserved for unknown order ${event.orderId}`);
      return;
    }
    order.status = 'CONFIRMED';
    order.updatedAt = event.reservedAt;
    this.logger.log(`Order ${event.orderId} CONFIRMED`);
  }

  handleInventoryRejected(event: { orderId: string; reason: string; shortages?: unknown }) {
    const order = this.orderMap.get(event.orderId);
    if (!order) {
      this.logger.warn(`inventory.rejected for unknown order ${event.orderId}`);
      return;
    }
    order.status = 'REJECTED';
    order.rejectionReason = event.reason;
    order.updatedAt = new Date().toISOString();
    this.logger.log(`Order ${event.orderId} REJECTED: ${event.reason}`);
  }

  findAll() {
    return Array.from(this.orderMap.entries()).map(([orderId, order]) => ({ orderId, ...order }));
  }

  findOne(id: number) {
    const orderId = `ORD${String(id).padStart(3, '0')}`;
    const order = this.orderMap.get(orderId);
    if (!order) {
      return { success: false, message: `Order ${orderId} not found` };
    }
    return { success: true, data: { orderId, ...order } };
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  async healthCheck() {
    try {
      const producer = await this.kafka.connect();
      const isConnected = !!producer;

      return {
        status: isConnected ? 'ok' : 'error',
        kafka: isConnected ? 'connected' : 'disconnected',
      };
    } catch (error) {
      return {
        status: 'error',
        kafka: 'disconnected',
        message: 'Error checking Kafka connection',
      };
    }
  }
}
