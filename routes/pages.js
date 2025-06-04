const express = require("express");
const router = express.Router();

// Home Page - Pass logged-in user data
router.get("/", (req, res) => {
  console.log("Session data at home route:", req.session);
  res.render("index", { 
    userName: req.session.userName || null,
    userEmail: req.session.userEmail || null,
    isLoggedIn: req.session.userId ? true : false
  });
});

// Contact Page
router.get("/contact", (req, res) => {
  res.render("contact", {
    isLoggedIn: req.session.userId ? true : false,
    userName: req.session.userName || null,
    userEmail: req.session.userEmail || null,
    userId: req.session.userId || null
  });
});

// About Page
router.get('/about', (req, res) => {
    res.render('about', {
        title: 'About Us - VoyageTMS',
        isLoggedIn: req.session.userId ? true : false,
        userName: req.session.userName || null,
        userEmail: req.session.userEmail || null
    });
});

// Enquiry Page
router.get('/enquiry', (req, res) => {
    res.render('enquiry', {
        isLoggedIn: req.session.userId ? true : false,
        userName: req.session.userName || null,
        userEmail: req.session.userEmail || null,
        success: req.query.success,
        error: req.query.error
    });
});

// Submit Enquiry Route - Works for both logged-in and non-logged-in users
router.post("/submit-enquiry", (req, res) => {
  const { name, email, subject, message, userId } = req.body;
  const connection = req.app.locals.connection;
  
  // Basic validation
  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }
  
  // Insert enquiry - handle both logged-in and guest users
  const query = "INSERT INTO Enquiry (User_id, Name, Email, Subject, Message) VALUES (?, ?, ?, ?, ?)";
  connection.query(query, [userId || null, name, email, subject, message], (err, result) => {
    if (err) {
      console.error("Error submitting enquiry:", err);
      return res.status(500).json({
        success: false,
        message: "Error submitting your enquiry"
      });
    }
    
    return res.json({
      success: true,
      message: "Your enquiry has been submitted successfully. We will get back to you soon."
    });
  });
});

// Send Email Route (if you're using Nodemailer)
router.post("/send", async (req, res) => {
  const { name, email, message } = req.body;
  const nodemailer = require("nodemailer");

  // Nodemailer Transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL, // Your email
      pass: process.env.PASSWORD, // App password
    },
  });

  // Sending Email
  try {
    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.RECEIVER_EMAIL, // Receiver's email
      subject: "New Feedback Received",
      template: "feedback",
      context: { name, email, message },
    });

    res.send("Feedback sent successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error sending feedback.");
  }
});

// Debug schema route (only for development)
router.get("/debug-schema", (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).send('Access denied in production');
  }
  
  const connection = req.app.locals.connection;
  const tables = ['User', 'Packages', 'Booking'];
  const schemas = {};
  
  let completed = 0;
  
  tables.forEach(table => {
    connection.query(`DESCRIBE ${table}`, (err, results) => {
      if (err) {
        schemas[table] = { error: err.message };
      } else {
        schemas[table] = results;
      }
      
      completed++;
      
      if (completed === tables.length) {
        res.json(schemas);
      }
    });
  });
});

module.exports = router; 