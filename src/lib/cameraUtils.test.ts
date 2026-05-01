import { describe, it, expect } from 'vitest';
import { getCameraConstraints } from './cameraUtils';

describe('getCameraConstraints', () => {
  it('should return environment constraints by default', () => {
    const constraints = getCameraConstraints('environment');
    expect(constraints.video).toMatchObject({
      facingMode: 'environment'
    });
  });

  it('should return user constraints when requested', () => {
    const constraints = getCameraConstraints('user');
    expect(constraints.video).toMatchObject({
      facingMode: 'user'
    });
  });
});
