import { expect, test } from 'bun:test';
import { ReturnCode } from '../return-code';

test('classifies values', () => {
  const success = new ReturnCode(0);
  const cancel = new ReturnCode(255);
  const error = new ReturnCode(1);
  expect([success.isValueSuccess(), success.isValueError()]).toEqual([
    true,
    false,
  ]);
  expect([cancel.isValueCancel(), cancel.isValueError()]).toEqual([
    true,
    false,
  ]);
  expect(error.isValueError()).toBe(true);
  expect(String(error)).toBe('1');
});

test('static checks accept a missing return code', () => {
  expect(ReturnCode.isSuccess(new ReturnCode(0))).toBe(true);
  expect(ReturnCode.isSuccess(undefined)).toBe(false);
  expect(ReturnCode.isCancel(new ReturnCode(255))).toBe(true);
  expect(ReturnCode.isCancel(null)).toBe(false);
});
