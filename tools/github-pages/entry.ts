// This separate static deployment intentionally opts into the existing labeled
// demo client before React initializes. Local/API builds keep their own entry.
import { apiClient } from '../../apps/web/src/lib/api/client';
import './scope.css';

apiClient.setDemoMode(true);
void import('../../apps/web/src/main');
