import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoodSelectionComponent } from './food-selection.component';

describe('FoodSelectionComponent', () => {
  let component: FoodSelectionComponent;
  let fixture: ComponentFixture<FoodSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoodSelectionComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FoodSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
