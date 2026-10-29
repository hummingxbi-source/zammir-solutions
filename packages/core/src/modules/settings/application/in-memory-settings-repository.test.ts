import { settingsRepositoryContract } from '../contracts/settings-repository.contract';
import { inMemorySettingsRepository } from './in-memory-settings-repository';

settingsRepositoryContract('en memoria', inMemorySettingsRepository);
