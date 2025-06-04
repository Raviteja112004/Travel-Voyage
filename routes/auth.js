const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Signup Page
router.get("/signup", (req, res) => {
  res.render("signup");
});

// Signup Route
router.post("/signup", async function (req, res) {
    const { firstName, lastName, email, password, mobileNumber } = req.body;
    const connection = req.app.locals.connection;

    // Basic validation
    if (!firstName || !lastName || !email || !password) {
        return res.redirect("/signup?error=All fields are required");
    }

    // Check if email already exists
    connection.query("SELECT * FROM User WHERE Email = ?", [email], async function (error, results) {
        if (error) {
            console.error("Database error:", error);
            return res.redirect("/signup?error=Something went wrong");
        }

        if (results.length > 0) {
            return res.redirect("/signup?error=Email already exists");
        }

        // Check if mobile number already exists
        if (mobileNumber) {
            connection.query("SELECT * FROM User WHERE MobileNumber = ?", [mobileNumber], async function (mobileError, mobileResults) {
                if (mobileError) {
                    console.error("Database error:", mobileError);
                    return res.redirect("/signup?error=Something went wrong");
                }

                if (mobileResults.length > 0) {
                    return res.redirect("/signup?error=Mobile number already in use");
                }

                // Continue with user creation if mobile number is unique
                processSignup();
            });
        } else {
            // Continue with user creation if no mobile number provided
            processSignup();
        }

        // Function to handle the actual signup process
        async function processSignup() {
            try {
                // Hash the password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert new user into the database
                connection.query("INSERT INTO User (FirstName, LastName, Email, Password, MobileNumber) VALUES (?, ?, ?, ?, ?)", 
                [firstName, lastName, email, hashedPassword, mobileNumber || null], function (insertError, result) {
                    if (insertError) {
                        console.error("Error inserting user:", insertError);
                        
                        // Specific error handling for duplicate mobile number
                        if (insertError.code === 'ER_DUP_ENTRY' && insertError.sqlMessage.includes('MobileNumber')) {
                            return res.redirect("/signup?error=Mobile number already in use");
                        }
                        
                        return res.redirect("/signup?error=Failed to create account");
                    }

                    return res.redirect("/login?success=Account created successfully. Please log in.");
                });
            } catch (hashError) {
                console.error("Password hashing error:", hashError);
                return res.redirect("/signup?error=Failed to create account");
            }
        }
    });
});

// Login Page
router.get("/login", (req, res) => {
  res.render("login");
});

// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const connection = req.app.locals.connection;

  if (!email || !password) {
    return res.redirect("/login?error=Please provide both email and password");
  }

  try {
    const getUserQuery = "SELECT * FROM User WHERE Email = ?";
    connection.query(getUserQuery, [email], async (err, results) => {
      if (err) {
        console.error("Database error when fetching user:", err);
        return res.redirect("/login?error=Database error");
      }

      if (results.length === 0) {
        return res.redirect("/login?error=Invalid email or password");
      }

      const user = results[0];

      // Check if password matches
      let isPasswordValid = false;
      
      // If password is hashed (starts with $2a$ or $2b$), use bcrypt
      if (user.Password && (user.Password.startsWith('$2a$') || user.Password.startsWith('$2b$'))) {
        try {
          isPasswordValid = await bcrypt.compare(password, user.Password);
        } catch (bcryptErr) {
          console.error("Error comparing passwords:", bcryptErr);
          return res.redirect("/login?error=Authentication error");
        }
      } else {
        // For plain text passwords (not recommended but might be in dev environment)
        isPasswordValid = (password === user.Password);
      }

      if (!isPasswordValid) {
        return res.redirect("/login?error=Invalid email or password");
      }

      // Set all necessary session variables
      req.session.userId = user.User_id;
      req.session.userName = user.Name || user.FirstName || email.split('@')[0];
      req.session.userEmail = user.Email;
      req.session.isLoggedIn = true;
      
      // If user is admin, set that flag too
      if (user.IsAdmin) {
        req.session.isAdmin = true;
      }
      
      // Save session before redirecting to ensure persistence
      req.session.save(err => {
        if (err) {
          console.error("Error saving session:", err);
          return res.redirect("/login?error=Session error");
        }
        
        // Redirect to the requested page or home page
        const redirectTo = req.query.redirect || "/";
        return res.redirect(redirectTo);
      });
    });
  } catch (error) {
    console.error("Server error during login:", error);
    return res.redirect("/login?error=Server error");
  }
});

// Logout Route
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

// Change Password Page
router.get("/change-password", function (req, res) {
  if (!req.session.userId) {
    return res.redirect("/login?error=Please log in to change your password");
  }
  res.render("change-password", {
    isLoggedIn: true,
    userName: req.session.userName,
    userEmail: req.session.userEmail
  });
});

// Change Password Route
router.post("/change-password", async function (req, res) {
  if (!req.session.userId) {
    return res.redirect("/login?error=Please log in to change your password");
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;
  const connection = req.app.locals.connection;

  // Basic validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.redirect("/change-password?error=All password fields are required");
  }

  if (newPassword !== confirmPassword) {
    return res.redirect("/change-password?error=New passwords do not match");
  }

  if (newPassword.length < 6) {
    return res.redirect("/change-password?error=Password must be at least 6 characters long");
  }

  try {
    // Get the user from the database
    connection.query(
      "SELECT * FROM User WHERE User_id = ?",
      [req.session.userId],
      async function (error, results) {
        if (error || results.length === 0) {
          return res.redirect("/change-password?error=Authentication failed");
        }

        const user = results[0];
        
        // Check if the current password matches
        let passwordMatch = false;
        
        // If password starts with $2b$, it's a bcrypt hash
        if (user.Password.startsWith('$2b$')) {
          try {
            passwordMatch = await bcrypt.compare(currentPassword, user.Password);
          } catch (err) {
            console.error("Bcrypt compare error:", err);
            return res.redirect("/change-password?error=Password verification failed");
          }
        } else {
          // Plaintext comparison
          passwordMatch = (user.Password === currentPassword);
        }

        if (!passwordMatch) {
          return res.redirect("/change-password?error=Current password is incorrect");
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        connection.query(
          "UPDATE User SET Password = ? WHERE User_id = ?",
          [hashedPassword, req.session.userId],
          function (updateError) {
            if (updateError) {
              console.error("Database error during password update:", updateError);
              return res.redirect("/change-password?error=Failed to update password. Please try again.");
            }
            
            return res.redirect("/profile?success=Your password has been updated successfully!");
          }
        );
      }
    );
  } catch (err) {
    console.error("Password change error:", err);
    return res.redirect("/change-password?error=An unexpected error occurred. Please try again.");
  }
});

module.exports = router; 