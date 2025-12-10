// create-user.dto.ts
export class CreateUserDto {
  full_name: string;
  email: string;
  password: string; // Campo temporal para luego hashearlo
  id_cedula?: string;
  address_home?: string;
  cellphone?: string;
  roleId?: number;
  warehouseId?: number;
}