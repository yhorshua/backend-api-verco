import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña no es válida' })
  @MaxLength(200)
  password!: string;
}
