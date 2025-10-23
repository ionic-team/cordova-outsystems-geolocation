import { exposeSynapse } from '@capacitor/synapse';

// false -> breaking change
exposeSynapse(false);

export * from './web';
export * from './definitions';