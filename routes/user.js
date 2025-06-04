const express = require("express");
const router = express.Router();

// Dashboard/Profile Route
router.get("/profile", (req, res) => {
  console.log("Profile route - session:", req.session);
  
  if (!req.session.userId) {
    console.log("No userId in session, redirecting to login");
    return res.redirect("/login?error=Please login to view your profile");
  }
  
  const userId = req.session.userId;
  const userEmail = req.session.userEmail;
  const activeTab = req.query.tab || 'bookings'; // Default to bookings tab
  const connection = req.app.locals.connection;
  
  console.log("Loading profile for user ID:", userId, "Email:", userEmail);
  
  // Get user details
  connection.query("SELECT * FROM User WHERE User_id = ?", [userId], (err, userResults) => {
    if (err) {
      console.error("Error fetching user details:", err);
      return res.redirect("/?error=Error fetching user details");
    }
    
    if (userResults.length === 0) {
      console.error("User not found with ID:", userId);
      return res.redirect("/?error=User not found");
    }
    
    const user = userResults[0];
    console.log("User found:", user);
    
    // Set the Name property if it doesn't exist
    if (!user.Name && (user.FirstName || user.LastName)) {
      user.Name = `${user.FirstName || ''} ${user.LastName || ''}`.trim();
    }
    
    // Get bookings with package details and hotel info
    connection.query(
      `SELECT b.*, p.PackageName, p.PackageLocation, h.HotelName 
       FROM Booking b
       JOIN Packages p ON b.PackageID = p.PackageId
       LEFT JOIN Hotel h ON b.HotelID = h.Hotel_id
       WHERE b.UserEmail = ?
       ORDER BY b.FromDate ASC`,
      [userEmail],
      (err, bookings) => {
        if (err) {
          console.error("Error fetching bookings:", err);
          bookings = [];
        }
        
        console.log("Found bookings:", bookings.length);
        
        // Check if enquiry table exists
        connection.query("SHOW TABLES LIKE 'Enquiry'", (tableErr, tableResults) => {
          let enquiries = [];
          
          if (tableErr || tableResults.length === 0) {
            console.log("Enquiry table not found, proceeding without enquiries");
            renderProfile();
          } else {
            // Get enquiries if the table exists
            connection.query("SELECT * FROM Enquiry WHERE User_id = ? ORDER BY EnquiryID DESC", [userId], (err, enquiryResults) => {
              if (!err && enquiryResults) {
                enquiries = enquiryResults;
              } else {
                console.error("Error fetching enquiries:", err);
              }
              renderProfile();
            });
          }
          
          function renderProfile() {
            // Render the profile page with the user data
            res.render("profile", {
              user: user,
              bookings: bookings,
              enquiries: enquiries,
              confirmedBookings: bookings.filter(b => b.Status === 'Confirmed').length,
              pendingBookings: bookings.filter(b => b.Status === 'Pending').length,
              isLoggedIn: true,
              userName: req.session.userName,
              userEmail: req.session.userEmail,
              activeTab: activeTab
            });
          }
        });
      }
    );
  });
});

// Update Profile Route
router.post("/update-profile", (req, res) => {
  // Check if user is logged in
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  
  const { name, phone, currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.session.userId;
  const connection = req.app.locals.connection;
  
  // Update basic information
  const updateQuery = "UPDATE User SET Name = ?, MobileNumber = ? WHERE User_id = ?";
  connection.query(updateQuery, [name, phone, userId], (err, result) => {
    if (err) {
      console.error("Error updating profile:", err);
      return res.redirect("/user/profile?error=Error updating profile");
    }
    
    // If user wants to change password
    if (currentPassword && newPassword && confirmPassword) {
      // Check if new passwords match
      if (newPassword !== confirmPassword) {
        return res.redirect("/user/profile?error=New passwords do not match");
      }
      
      // Verify current password
      connection.query("SELECT Password FROM User WHERE User_id = ?", [userId], (err, results) => {
        if (err || results.length === 0) {
          console.error("Error fetching user password:", err);
          return res.redirect("/user/profile?error=Error verifying password");
        }
        
        const storedHash = results[0].Password;
        
        // Compare current password with stored hash
        bcrypt.compare(currentPassword, storedHash, (err, isMatch) => {
          if (err || !isMatch) {
            return res.redirect("/user/profile?error=Current password is incorrect");
          }
          
          // Hash new password
          bcrypt.hash(newPassword, 10, (err, hash) => {
            if (err) {
              console.error("Error hashing new password:", err);
              return res.redirect("/user/profile?error=Error updating password");
            }
            
            // Update password in database
            connection.query("UPDATE User SET Password = ? WHERE User_id = ?", [hash, userId], (err, result) => {
              if (err) {
                console.error("Error updating password:", err);
                return res.redirect("/user/profile?error=Error updating password");
              }
              
              // Update session username if name was changed
              req.session.userName = name;
              res.redirect("/user/profile?success=Profile updated successfully");
            });
          });
        });
      });
    } else {
      // Just update the name in the session
      req.session.userName = name;
      res.redirect("/user/profile?success=Profile updated successfully");
    }
  });
});

// Dashboard
router.get("/dashboard", function (req, res) {
  // Check if user is logged in
  if (!req.session.userId) {
    return res.redirect("/login?error=Please log in to access your dashboard");
  }

  const connection = req.app.locals.connection;
  // Get user info from database
  connection.query(
    "SELECT * FROM User WHERE User_id = ?",
    [req.session.userId],
    function (error, results) {
      if (error) {
        console.error("Error fetching user data:", error);
        return res.redirect("/?error=Something went wrong. Please try again.");
      }

      if (results.length === 0) {
        req.session.destroy();
        return res.redirect("/login?error=User not found. Please log in again.");
      }

      const user = results[0];
      
      // Also fetch any bookings the user has
      connection.query(
        "SELECT b.*, p.PackageName FROM Booking b JOIN Packages p ON b.PackageID = p.PackageId WHERE b.UserEmail = ?",
        [req.session.userEmail],
        function (bookingError, bookings) {
          if (bookingError) {
            console.error("Error fetching bookings:", bookingError);
            bookings = [];
          }

          res.render("dashboard", {
            user: user,
            bookings: bookings,
            isLoggedIn: true,
            userName: user.Name,
            userEmail: req.session.userEmail
          });
        }
      );
    }
  );
});

// Invoice Route
router.get("/invoice/:id", (req, res) => {
  // Check if user is logged in
  if (!req.session.userId) {
    return res.redirect("/login?error=Please login to view invoices");
  }
  
  const bookingId = req.params.id;
  const userEmail = req.session.userEmail;
  const connection = req.app.locals.connection;
  
  // Get booking details
  connection.query(
    "SELECT b.*, p.* FROM Booking b JOIN Packages p ON b.PackageID = p.PackageId WHERE b.BookingID = ? AND b.UserEmail = ?",
    [bookingId, userEmail],
    (err, results) => {
      if (err || results.length === 0) {
        console.error("Error fetching booking details:", err);
        return res.redirect("/profile?error=Invoice not found");
      }
      
      const booking = results[0];
      const package = {
        PackageId: booking.PackageId,
        PackageName: booking.PackageName,
        PackageLocation: booking.PackageLocation,
        PackageDetails: booking.PackageDetails,
        PackagePrice: booking.PackagePrice,
        PackageImage: booking.PackageImage,
        Duration: booking.Duration,
        Accommodation: booking.Accommodation,
        Features: booking.Features,
        Categories: booking.Categories
      };
      
      // Get user details
      connection.query("SELECT * FROM User WHERE Email = ?", [userEmail], (err, userResults) => {
        if (err || userResults.length === 0) {
          console.error("Error fetching user details:", err);
          return res.redirect("/profile?error=User not found");
        }
        
        const user = userResults[0];
        
        // Calculate amounts
        const baseAmount = booking.PackagePrice * booking.NumberOfPeople;
        const gstAmount = baseAmount * 0.18; // 18% GST
        const totalAmount = baseAmount + gstAmount;
        
        res.render("invoice", {
          booking: booking,
          package: package,
          user: user,
          baseAmount: baseAmount,
          gstAmount: gstAmount,
          totalAmount: totalAmount,
          today: new Date(),
          accommodation: true, // Always show accommodation as it's included
          isLoggedIn: true,
          userName: req.session.userName,
          userEmail: req.session.userEmail
        });
      });
    }
  );
});

// Booking Details Route
router.get("/booking-details/:id", (req, res) => {
  // Check if user is logged in
  if (!req.session.userId) {
    return res.redirect("/login?error=Please login to view booking details");
  }
  
  const bookingId = req.params.id;
  const userEmail = req.session.userEmail;
  const connection = req.app.locals.connection;
  
  // Get booking details with package info
  connection.query(
    "SELECT b.*, p.* FROM Booking b JOIN Packages p ON b.PackageID = p.PackageId WHERE b.BookingID = ? AND b.UserEmail = ?",
    [bookingId, userEmail],
    (err, results) => {
      if (err || results.length === 0) {
        console.error("Error fetching booking details:", err);
        return res.redirect("/profile?error=Booking not found");
      }
      
      const booking = results[0];
      const package = {
        PackageId: booking.PackageId,
        PackageName: booking.PackageName,
        PackageLocation: booking.PackageLocation,
        PackageDetails: booking.PackageDetails,
        PackagePrice: booking.PackagePrice,
        PackageImage: booking.PackageImage,
        Duration: booking.Duration,
        Accommodation: booking.Accommodation,
        Features: booking.Features,
        Categories: booking.Categories
      };
      
      // Find nearby hotels based on package location
      const location = booking.PackageLocation.split(/[-,]/)[0].trim();
      
      connection.query(
        "SELECT * FROM Hotel WHERE HotelLocation LIKE ? ORDER BY Ratings DESC LIMIT 3",
        [`%${location}%`],
        (err, hotelResults) => {
          if (err) {
            console.error("Error fetching nearby hotels:", err);
            hotelResults = [];
          }
          
          const hotels = hotelResults.map(hotel => {
            return {
              ...hotel,
              AmenitiesArray: hotel.Amenities ? hotel.Amenities.split(',') : []
            };
          });
          
          res.render("booking-details", {
            booking: booking,
            package: package,
            hotels: hotels,
            isLoggedIn: true,
            userName: req.session.userName,
            userEmail: req.session.userEmail
          });
        }
      );
    }
  );
});

// Cancel Booking Route
router.post("/cancel-booking/:id", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Please login to cancel bookings" });
  }
  
  const bookingId = req.params.id;
  const userEmail = req.session.userEmail;
  const connection = req.app.locals.connection;
  
  connection.query(
    "UPDATE Booking SET Status = 'Cancelled' WHERE BookingID = ? AND UserEmail = ? AND Status = 'Pending'",
    [bookingId, userEmail],
    (err, result) => {
      if (err) {
        console.error("Error cancelling booking:", err);
        return res.status(500).json({ success: false, message: "Error cancelling booking" });
      }
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Booking not found or already confirmed/cancelled" 
        });
      }
      
      res.json({ success: true, message: "Booking cancelled successfully" });
    }
  );
});

// API route to get user bookings (for refresh functionality)
router.get("/api/bookings", (req, res) => {
  if (!req.session.userId) {
    return res.json({ success: false, message: "Not logged in" });
  }
  
  const userEmail = req.session.userEmail;
  const connection = req.app.locals.connection;
  
  // Get bookings with package details
  connection.query(
    `SELECT b.*, p.PackageName, p.PackageLocation 
     FROM Booking b
     JOIN Packages p ON b.PackageID = p.PackageId
     WHERE b.UserEmail = ?
     ORDER BY b.FromDate ASC`,
    [userEmail],
    (err, results) => {
      if (err) {
        console.error("Error fetching bookings:", err);
        return res.json({ success: false, message: "Database error" });
      }
      
      return res.json({ success: true, bookings: results });
    }
  );
});

module.exports = router; 