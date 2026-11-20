import type { Runtime, ServiceHandler } from '@kehto/runtime';

/** Keep the runtime's service snapshot aligned with the adapter before admitting new frames. */
export function trackPajaServices(runtime: Pick<Runtime, 'registerService' | 'unregisterService'>,
  initial: Readonly<Record<string, ServiceHandler>>) {
  const registered = new Map(Object.entries(initial));
  return (services: Readonly<Record<string, ServiceHandler>>) => {
    for (const name of registered.keys()) {
      if (Object.hasOwn(services, name)) continue;
      runtime.unregisterService(name);
      registered.delete(name);
    }
    for (const [name, service] of Object.entries(services)) {
      if (registered.get(name) === service) continue;
      runtime.registerService(name, service);
      registered.set(name, service);
    }
  };
}
