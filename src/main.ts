import { inject } from '@vercel/analytics';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { environment } from './environments/environment';

inject({
  mode: environment.production ? 'production' : 'development'
});

bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => {
  console.error(err);
});
