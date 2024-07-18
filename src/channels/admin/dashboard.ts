// src/channels/admin/dashboard.ts

import { BaseDashboard } from '../../core/BaseDashboard';
import { HomeScreen } from './screens/HomeScreen';
import { SMEManagementScreen } from './screens/SMEManagementScreen';
import { Dashboard, ScreenConstructor } from '../../core/BaseClasses';

export class AdminDashboard extends BaseDashboard implements Dashboard {
  static readonly DASHBOARD_ID = 'admin';
  protected readonly initialScreenClass = HomeScreen;

  constructor(homeScreenType: ScreenConstructor) {
    super(homeScreenType);
    this.registerScreen(new SMEManagementScreen(this, this.DEFAULT_VIEW_PERMISSION));
  }

}