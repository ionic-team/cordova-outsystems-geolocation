import { exposeSynapse } from '@capacitor/synapse';

// true -> to make sure Synapse uses this cordova plugin for capacitor builds.
exposeSynapse(true);

export * from './web';
export * from './definitions';