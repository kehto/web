import { definePlaygroundNappletConfig } from '../shared-vite-config';

export default definePlaygroundNappletConfig('chat', { requires: ['ifc', 'storage', 'relay'] });
