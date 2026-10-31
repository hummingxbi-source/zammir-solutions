import { fixedClock } from '../../../shared-kernel/clock';
import { syncOutboxContract } from '../contracts/sync-outbox.contract';
import { inMemorySyncOutbox } from './in-memory-sync-outbox';

syncOutboxContract('memoria', () =>
  inMemorySyncOutbox({ clock: fixedClock(new Date('2026-10-30T12:00:00.000Z')) }),
);
