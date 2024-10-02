import { Sequelize } from 'sequelize';
import { config } from 'dotenv';

config(); // load env vars

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DB_STORAGE || './database.sqlite',
  logging: console.log,
});

export default sequelize;
