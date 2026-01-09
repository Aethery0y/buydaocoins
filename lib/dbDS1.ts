import mysql from 'mysql2/promise';

const poolDS1 = mysql.createPool({
  host: process.env.DB_HOST_DS1,
  user: process.env.DB_USER_DS1,
  password: process.env.DB_PASSWORD_DS1,
  database: process.env.DB_NAME_DS1,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default poolDS1;
