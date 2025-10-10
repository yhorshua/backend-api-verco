// create-user.dto.ts
export class CreateUserDto {
  full_name: string;
  email: string;
  password: string; // Campo temporal
  id_cedula?: string;
  address_home?: string;
  roleId?: number;
}
