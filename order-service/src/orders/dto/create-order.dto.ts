import { IsString, IsInt, Min, IsNotEmpty, IsUUID, IsOptional, IsJSON } from 'class-validator';

export class CreateOrderDto {
    @IsString()
    @IsNotEmpty()
    customerId!: string;

    @IsJSON()
    @IsNotEmpty()
    items!: Array<any>;
}
