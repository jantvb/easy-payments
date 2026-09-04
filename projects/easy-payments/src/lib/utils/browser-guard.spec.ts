import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserGuard } from './browser-guard';

describe('BrowserGuard', () => {
  it('exposes browser APIs in the browser', () => {
    TestBed.configureTestingModule({});
    const guard = TestBed.inject(BrowserGuard);

    expect(guard.isBrowser).toBeTrue();
    expect(guard.getWindow()).toBe(window);
    expect(guard.getDocument()).toBe(document);
    expect(guard.matchMedia('(prefers-color-scheme: dark)')).toBeTruthy();
  });

  it('returns nulls when running outside the browser', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });
    const guard = TestBed.inject(BrowserGuard);

    expect(guard.isBrowser).toBeFalse();
    expect(guard.getWindow()).toBeNull();
    expect(guard.getDocument()).toBeNull();
    expect(guard.getNavigator()).toBeNull();
    expect(guard.matchMedia('(prefers-color-scheme: dark)')).toBeNull();
    expect(guard.getLocalStorage()).toBeNull();
  });
});
