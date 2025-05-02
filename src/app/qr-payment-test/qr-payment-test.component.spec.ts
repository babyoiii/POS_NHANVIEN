import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QrPaymentTestComponent } from './qr-payment-test.component';

describe('QrPaymentTestComponent', () => {
  let component: QrPaymentTestComponent;
  let fixture: ComponentFixture<QrPaymentTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QrPaymentTestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QrPaymentTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
