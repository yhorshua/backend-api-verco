import { plainToInstance } from 'class-transformer';
import {
  SyncCloudinaryFolderDto,
  SyncCloudinaryImagesDto,
} from './dto/sync-cloudinary-images.dto';
import {
  imageOrderFromPublicId,
  productCodeFromPublicId,
} from './cloudinary-sync.service';

describe('CloudinarySyncService helpers', () => {
  it('ordena las imágenes usando el sufijo numérico', () => {
    expect(imageOrderFromPublicId('15525bd_1')).toBe(1);
    expect(imageOrderFromPublicId('catalogo/15525bd-12')).toBe(12);
  });

  it('envía al final una imagen sin sufijo numérico', () => {
    expect(imageOrderFromPublicId('15525bd_frontal')).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('mantiene la simulación activa cuando el body llega vacío', () => {
    const dto = plainToInstance(SyncCloudinaryImagesDto, {});
    expect(dto.dry_run).toBe(true);
    expect(dto.replace_existing).toBe(false);
  });

  it('obtiene el código del producto desde el nombre del recurso', () => {
    expect(productCodeFromPublicId('15525zj_1')).toBe('15525ZJ');
    expect(productCodeFromPublicId('verco/15525bd-12')).toBe('15525BD');
  });

  it('rechaza nombres que no tienen el orden numérico', () => {
    expect(productCodeFromPublicId('15525zj_frontal')).toBeNull();
    expect(productCodeFromPublicId('foto_1_extra')).toBeNull();
  });

  it('usa vista previa por defecto para la carpeta completa', () => {
    const dto = plainToInstance(SyncCloudinaryFolderDto, {});
    expect(dto.dry_run).toBe(true);
    expect(dto.replace_existing).toBe(false);
  });
});
