import { definePlaygroundNappletConfig } from '../shared-vite-config';

export default definePlaygroundNappletConfig('chat', { requires: ['inc', 'storage', 'relay', 'theme'] });
