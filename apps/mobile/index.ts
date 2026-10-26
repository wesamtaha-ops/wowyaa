import { registerRootComponent } from 'expo';
import { installNetworkGuard } from './src/network-guard';
import App from './src/App';

// Installed before any app code runs so nothing can slip a request out first.
installNetworkGuard({ enforce: !__DEV__ });
registerRootComponent(App);
