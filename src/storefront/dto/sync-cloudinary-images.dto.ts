import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : (value as unknown);
}

export class SyncCloudinaryImagesDto {
  @IsOptional()
  @IsBoolean()
  dry_run = true;

  @IsOptional()
  @IsBoolean()
  replace_existing = false;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9/_-]+$/, {
    message:
      'prefix solo puede contener letras, números, guiones, guion bajo y /',
  })
  prefix?: string;
}

export class SyncCloudinaryFolderDto {
  @IsOptional()
  @IsBoolean()
  dry_run = true;

  @IsOptional()
  @IsBoolean()
  replace_existing = false;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  @Matches(/^[a-zA-Z0-9/_-]+$/, {
    message:
      'asset_folder solo puede contener letras, números, guiones, guion bajo y /',
  })
  asset_folder?: string;
}
