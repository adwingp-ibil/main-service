import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @EventPattern('inventory.reserved')
  onInventoryReserved(@Payload() event: any) {
    this.ordersService.handleInventoryReserved(event);
  }

  @EventPattern('inventory.rejected')
  onInventoryRejected(@Payload() event: any) {
    this.ordersService.handleInventoryRejected(event);
  }

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('health')
  healthCheck() {
    return this.ordersService.healthCheck();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(+id, updateOrderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ordersService.remove(+id);
  }
}
