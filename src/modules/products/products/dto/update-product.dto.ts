import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/** Same whitelisted fields as create, all optional. Nothing else can be updated. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
