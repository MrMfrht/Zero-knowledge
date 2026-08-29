import { Module } from '@nestjs/common';
import { DirectoryModule } from './directory/directory.module.js';
import { TimesheetsModule } from './timesheets/timesheets.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ReportingModule } from './reporting/reporting.module.js';

@Module({
  imports: [DirectoryModule, TimesheetsModule, NotificationsModule, ReportingModule],
})
export class AppModule {}
