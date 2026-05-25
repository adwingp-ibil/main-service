import { IsString, IsInt, Min, IsNotEmpty, IsUUID, IsOptional, IsJSON, isNumber, isString, isNotEmpty, IsNumber } from 'class-validator';

export class CreateInventoryDto {
    @IsString()
    @IsNotEmpty()
    productname!: string;

    @IsNumber()
    @IsNotEmpty()
    quantity!: Number;

    @IsString()
    @IsNotEmpty()
    status!: string;
}
