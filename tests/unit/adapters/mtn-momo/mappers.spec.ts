import { mapMtnBalanceResponse, mapMtnError, mapMtnStatusResponse } from '../../../../src/adapters/mtn-momo/mappers';
import { OpenBankError } from '../../../../src/core/types';

describe('mapMtnStatusResponse', () => {
  it('should map a known status through unchanged', () => {
    // Given
    const response = { status: 'SUCCESSFUL' };

    // When
    const result = mapMtnStatusResponse('ref-1', response);

    // Then
    expect(result).toEqual({ referenceId: 'ref-1', status: 'SUCCESSFUL' });
  });

  it('should map an unrecognized status to FAILED', () => {
    // Given
    const response = { status: 'SOMETHING_UNEXPECTED' };

    // When
    const result = mapMtnStatusResponse('ref-2', response);

    // Then
    expect(result).toEqual({ referenceId: 'ref-2', status: 'FAILED' });
  });
});

describe('mapMtnBalanceResponse', () => {
  it('should convert the balance string to a number', () => {
    // Given
    const response = { availableBalance: '12345.67', currency: 'RWF' };

    // When
    const result = mapMtnBalanceResponse(response);

    // Then
    expect(result).toEqual({ availableBalance: 12345.67, currency: 'RWF' });
  });
});

describe('mapMtnError', () => {
  it('should map a known MTN error reason to the matching SDK error code', () => {
    // Given / When
    const error = mapMtnError('PAYER_NOT_FOUND', 'Payer could not be found');

    // Then
    expect(error).toBeInstanceOf(OpenBankError);
    expect(error.code).toBe('PAYER_NOT_FOUND');
    expect(error.message).toBe('Payer could not be found');
  });

  it('should map an unrecognized reason to UNKNOWN_ERROR', () => {
    // Given / When
    const error = mapMtnError('SOMETHING_NEW', 'Unexpected failure');

    // Then
    expect(error.code).toBe('UNKNOWN_ERROR');
  });
});
