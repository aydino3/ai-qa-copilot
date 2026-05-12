import { faker } from '@faker-js/faker';

/**
 * Generic factory base.
 *
 * Subclass per entity and override `defaults()`. Call `.build()` for an
 * in-memory object or `.create()` when the entity needs to exist in the DB
 * (requires an ApiClient injected via the constructor).
 *
 * Example:
 *   class UserFactory extends BaseFactory<User> { ... }
 *   const user = new UserFactory().build({ role: 'admin' });
 */
export abstract class BaseFactory<T extends Record<string, unknown>> {
  protected abstract defaults(): T;

  build(overrides: Partial<T> = {}): T {
    return { ...this.defaults(), ...overrides };
  }

  buildList(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

// Re-export faker so factories don't each import it separately
export { faker };
