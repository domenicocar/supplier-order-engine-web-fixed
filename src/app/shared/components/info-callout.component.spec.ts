import { TestBed } from '@angular/core/testing';

import { InfoCalloutComponent } from './info-callout.component';

describe('InfoCalloutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoCalloutComponent]
    }).compileComponents();
  });

  it('renders title and message', () => {
    const fixture = TestBed.createComponent(InfoCalloutComponent);
    fixture.componentRef.setInput('title', 'Come funziona');
    fixture.componentRef.setInput('message', 'Informazioni utili.');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Come funziona');
    expect(fixture.nativeElement.textContent).toContain('Informazioni utili.');
  });

  it('emits dismissed from the close button', () => {
    const fixture = TestBed.createComponent(InfoCalloutComponent);
    fixture.componentRef.setInput('title', 'Come funziona');
    fixture.componentRef.setInput('message', 'Informazioni utili.');
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();

    expect(dismissed).toHaveBeenCalledTimes(1);
  });
});
