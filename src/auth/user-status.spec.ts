import { isUserActive } from './user-status';

describe('isUserActive', () => {
  it.each([true, 1, '1', Buffer.from([1]), { type: 'Buffer', data: [1] }])(
    'acepta el estado activo %p',
    (value) => expect(isUserActive(value)).toBe(true),
  );

  it.each([false, 0, '0', null, undefined, Buffer.from([0]), { type: 'Buffer', data: [0] }])(
    'rechaza el estado inactivo %p',
    (value) => expect(isUserActive(value)).toBe(false),
  );
});
