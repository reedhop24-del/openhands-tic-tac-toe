import { randomUUID } from 'node:crypto';
import { enqueueToken } from '../db/database.js';

export const createToken = async () => enqueueToken(randomUUID());
