const mysql = require("mysql2");
require("dotenv").config();
const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS ,
  database: process.env.DB_NAME || "travel_agency",
  connectionLimit: 10, 
});

// Check database connection
db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL Database ✅");
    connection.release();
  }
});

module.exports = db;
