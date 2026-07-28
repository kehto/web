import { definePlaygroundNappletConfig } from '../shared-vite-config';

export default definePlaygroundNappletConfig('profile-viewer', { requires: ['inc', 'relay', 'resource', 'theme'], archetypes: [{ slug: 'profile', convention: 'napplet:profile/open' }] });
