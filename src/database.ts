/**
 * This module handles the database connection and initialization for the application.
 * It uses sqlite3 as the underlying DB engine.
 */

import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';

let db: Database

export async function initializeDatabase() {
    db = await open({
        filename: './govbot.sqlite',
        driver: sqlite3.Database
    });

    // TODO: create more tables in db.exec()
    await db.exec(`
    CREATE TABLE IF NOT EXISTS sme_category (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    );
    `);
}

export function getDb() {
    if (!db) {
        throw new Error('Database not initialized');
    }
    return db;
}