import { TestBed } from '@angular/core/testing';
import { provideEasyPayments } from 'easy-payments';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideEasyPayments({ enableMockMode: true, providers: {} })],
    }).compileComponents();
  });

  it('should create the demo playground', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the Easy Payments demo', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Checkout playground');
    expect(compiled.textContent).toContain('Demo Mode — No real payment will be processed.');
    expect(compiled.querySelector('easy-payments')).toBeTruthy();
  });
});
