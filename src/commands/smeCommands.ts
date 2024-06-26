import { Database } from 'sqlite';
import { getDb } from '../database';

export async function viewSMEs() {
    const db: Database = getDb();
    // TODO: reuturn db.all(`...`)
    return {}

}