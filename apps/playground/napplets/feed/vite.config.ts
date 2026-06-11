import { definePlaygroundNappletConfig } from '../shared-vite-config';

export default definePlaygroundNappletConfig('feed', { requires: ['identity', 'relay', 'ifc', 'theme'] });
