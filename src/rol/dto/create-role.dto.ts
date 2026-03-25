import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name_role: string;
}
