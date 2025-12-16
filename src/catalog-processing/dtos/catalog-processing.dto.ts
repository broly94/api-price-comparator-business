import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ProcessCatalogImageDto {
  @IsOptional()
  @IsString()
  company?: string;
}

export class ProcessPdfDto {
  company?: string;
  pageRange?: string;
  maxPages?: number;
}

export class ProcessImageAndSearchDto {
  @IsOptional()
  company?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxResults?: number = 5;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  similarityThreshold?: number = 0.7;
}
