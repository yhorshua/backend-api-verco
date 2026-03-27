export class CreateCuotasDto {
    estado_cuenta_id: number;

    cuotas: {
        numero_cuota: number;
        monto: number;
        fecha_vencimiento: string; // YYYY-MM-DD
        numero_operacion?: string;
    }[];
}