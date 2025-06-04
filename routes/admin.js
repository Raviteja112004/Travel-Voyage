const express = require("express");
const router = express.Router();

// Middleware to check admin authentication
const checkAdminAuth = (req, res, next) => {
    if (req.session && req.session.adminId) {
        // Admin is logged in, proceed to next middleware
        next();
    } else {
        // Admin is not logged in, redirect to login page
        res.redirect('/admin/login');
    }
};

// Admin Login Page
router.get("/login", (req, res) => {
    if (req.session.adminId) {
        // If already logged in, redirect to dashboard
        res.redirect('/admin/dashboard');
    } else {
        res.render("admin-login", { layout: false });
    }
});

// Admin Login Process
router.post("/login", (req, res) => {
    const { username, password } = req.body;
    const connection = req.app.locals.connection;

    if (!username || !password) {
        return res.render("admin-login", {
            layout: false,
            error: "All fields are required"
        });
    }

    const query = "SELECT * FROM Admin WHERE Username = ? AND Password = ?";
    connection.query(query, [username, password], (err, results) => {
        if (err) {
            console.error("Database error:", err);
            return res.render("admin-login", {
                layout: false,
                error: "Database error occurred"
            });
        }

        if (results.length === 0) {
            return res.render("admin-login", {
                layout: false,
                error: "Invalid credentials"
            });
        }

        // Store admin info in session
        req.session.adminId = results[0].Admin_id;
        req.session.adminUsername = results[0].Username;
        
        // Redirect to dashboard
        res.redirect('/admin/dashboard');
    });
});

// Admin Dashboard
router.get("/dashboard", checkAdminAuth, function (req, res) {
    console.log("Admin dashboard request received");
    const connection = req.app.locals.connection;
    
    // Get customers
    connection.query("SELECT * FROM User", (error, customers) => {
        if (error) {
            console.error("Error fetching customers:", error);
            customers = [];
        }
        
        // Get packages
        connection.query("SELECT * FROM Packages", (packageError, packages) => {
            if (packageError) {
                console.error("Error fetching packages:", packageError);
                packages = [];
            }
            
            // Get hotels
            connection.query("SELECT * FROM Hotel", (hotelError, hotels) => {
                if (hotelError) {
                    console.error("Error fetching hotels:", hotelError);
                    hotels = [];
                }
                
                // Get bookings with related package and user info
                const bookingQuery = `
                    SELECT b.*, p.PackageName, p.PackageLocation, u.FirstName, u.LastName, u.Email
                    FROM Booking b
                    JOIN Packages p ON b.PackageID = p.PackageId
                    JOIN User u ON b.UserEmail = u.Email
                    ORDER BY b.BookingID DESC
                `;
                
                connection.query(bookingQuery, (bookingError, bookings) => {
                    if (bookingError) {
                        console.error("Error fetching bookings:", bookingError);
                        bookings = [];
                    }
                    
                    // Get stats
                    const statsQuery = `SELECT 
                        (SELECT COUNT(*) FROM User) AS userCount,
                        (SELECT COUNT(*) FROM Packages) AS packageCount,
                        (SELECT COUNT(*) FROM Booking) AS bookingCount,
                        (SELECT COUNT(*) FROM Hotel) AS hotelCount`;
                        
                    connection.query(statsQuery, (statsError, statsResults) => {
                        if (statsError) {
                            console.error("Error fetching stats:", statsError);
                            statsResults = [{ userCount: 0, packageCount: 0, bookingCount: 0, hotelCount: 0 }];
                        }
                        
                        // Get inquiries
                        connection.query("SELECT * FROM Enquiry ORDER BY EnquiryID DESC", (enquiryError, enquiries) => {
                            if (enquiryError) {
                                console.error("Error fetching enquiries:", enquiryError);
                                enquiries = [];
                            }
                            
                            res.render("admin", {
                                layout: false,
                                adminUsername: req.session.adminUsername,
                                customers: customers,
                                packages: packages,
                                hotels: hotels,
                                bookings: bookings,
                                enquiries: enquiries,
                                stats: statsResults[0]
                            });
                        });
                    });
                });
            });
        });
    });
});

// Admin Logout
router.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect('/');
    });
});

// Get Booking Details
router.get("/bookings/:id", checkAdminAuth, (req, res) => {
    const bookingId = req.params.id;
    const connection = req.app.locals.connection;
    
    // Get booking with joined package details
    connection.query(
      `SELECT b.*, p.*
       FROM Booking b
       JOIN Packages p ON b.PackageID = p.PackageId
       WHERE b.BookingID = ?`,
      [bookingId],
      (err, results) => {
        if (err) {
          console.error("Error fetching booking details:", err);
          return res.json({ success: false, message: "Database error" });
        }
        
        if (results.length === 0) {
          return res.json({ success: false, message: "Booking not found" });
        }
        
        const data = results[0];
        
        // Separate booking and package data
        const booking = {
          BookingID: data.BookingID,
          UserEmail: data.UserEmail,
          FromDate: data.FromDate,
          ToDate: data.ToDate,
          NumberOfPeople: data.NumberOfPeople,
          Status: data.Status
        };
        
        const package = {
          PackageId: data.PackageId,
          PackageName: data.PackageName,
          PackageLocation: data.PackageLocation,
          PackagePrice: data.PackagePrice,
          Duration: data.Duration,
          PackageImage: data.PackageImage
        };
        
        res.json({ success: true, booking, package });
      }
    );
});

// Delete Booking
router.delete("/bookings/:id", checkAdminAuth, (req, res) => {
    const bookingId = req.params.id;
    const connection = req.app.locals.connection;
    
    // Only delete cancelled bookings
    connection.query(
      "DELETE FROM Booking WHERE BookingID = ? AND Status = 'Cancelled'",
      [bookingId],
      (err, result) => {
        if (err) {
          console.error("Error deleting booking:", err);
          return res.json({ success: false, message: "Database error" });
        }
        
        if (result.affectedRows === 0) {
          return res.json({ 
            success: false, 
            message: "Booking not found or not cancelled. Only cancelled bookings can be deleted." 
          });
        }
        
        res.json({ success: true, message: "Booking deleted successfully" });
      }
    );
});

// Update Booking Status
router.put("/bookings/:id/status", checkAdminAuth, (req, res) => {
    const bookingId = req.params.id;
    const { status } = req.body;
    const connection = req.app.locals.connection;
    
    if (!['Pending', 'Confirmed', 'Cancelled'].includes(status)) {
        return res.json({ success: false, message: "Invalid status value" });
    }
    
    // Log the request to help with troubleshooting
    console.log(`Updating booking ${bookingId} to status: ${status}`);
    
    const query = "UPDATE Booking SET Status = ? WHERE BookingID = ?";
    
    connection.query(query, [status, bookingId], (err, results) => {
        if (err) {
            console.error("Error updating booking status:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        console.log("Update result:", results);
        res.json({ success: true, message: `Booking status updated to ${status}` });
    });
});

// Package Management Routes
router.post("/packages", checkAdminAuth, (req, res) => {
    const { packageName, packageLocation, packagePrice, packageDuration, packageDescription, packageImage } = req.body;
    const connection = req.app.locals.connection;
    
    const query = `INSERT INTO Packages 
                  (PackageName, PackageLocation, PackagePrice, Duration, PackageDetails, PackageImage) 
                  VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [packageName, packageLocation, packagePrice, packageDuration, packageDescription, packageImage];
    
    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Error adding package:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        res.json({ success: true, message: "Package added successfully" });
    });
});

router.put("/packages/:id", checkAdminAuth, (req, res) => {
    const packageId = req.params.id;
    const { packageName, packageLocation, packagePrice, packageDuration, packageDescription, packageImage } = req.body;
    const connection = req.app.locals.connection;
    
    const query = `UPDATE Packages
                  SET PackageName = ?, PackageLocation = ?, PackagePrice = ?, 
                      Duration = ?, PackageDetails = ?, PackageImage = ?
                  WHERE PackageId = ?`;
    const params = [packageName, packageLocation, packagePrice, packageDuration, packageDescription, packageImage, packageId];
    
    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Error updating package:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        res.json({ success: true, message: "Package updated successfully" });
    });
});

router.delete("/packages/:id", checkAdminAuth, (req, res) => {
    const packageId = req.params.id;
    const connection = req.app.locals.connection;
    
    // Temporarily disable foreign key checks
    connection.query("SET FOREIGN_KEY_CHECKS=0", (err) => {
        if (err) {
            console.error("Error disabling foreign key checks:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        // Delete the package directly
        connection.query("DELETE FROM Packages WHERE PackageId = ?", [packageId], (err, results) => {
            // Re-enable foreign key checks
            connection.query("SET FOREIGN_KEY_CHECKS=1", () => {
                if (err) {
                    console.error("Error deleting package:", err);
                    return res.json({ 
                        success: false, 
                        message: "Error deleting package: " + err.message
                    });
                }
                
                // Check if any rows were affected
                if (results.affectedRows === 0) {
                    return res.json({
                        success: false,
                        message: "Package not found or could not be deleted"
                    });
                }
                
                res.json({ 
                    success: true, 
                    message: "Package deleted successfully" 
                });
            });
        });
    });
});

// Hotel Management Routes
router.post("/hotels", checkAdminAuth, (req, res) => {
    const { hotelName, hotelLocation, pricePerNight, ratings, description, hotelImage, amenities } = req.body;
    const connection = req.app.locals.connection;
    
    const query = `INSERT INTO Hotel 
                  (HotelName, HotelLocation, PricePerNight, Ratings, Description, HotelImage, Amenities) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const params = [hotelName, hotelLocation, pricePerNight, ratings, description, hotelImage, amenities];
    
    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Error adding hotel:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        res.json({ success: true, message: "Hotel added successfully" });
    });
});

router.put("/hotels/:id", checkAdminAuth, (req, res) => {
    const hotelId = req.params.id;
    const { hotelName, hotelLocation, pricePerNight, ratings, description, hotelImage, amenities } = req.body;
    const connection = req.app.locals.connection;
    
    const query = `UPDATE Hotel
                  SET HotelName = ?, HotelLocation = ?, PricePerNight = ?, 
                      Ratings = ?, Description = ?, HotelImage = ?, Amenities = ?
                  WHERE Hotel_id = ?`;
    const params = [hotelName, hotelLocation, pricePerNight, ratings, description, hotelImage, amenities, hotelId];
    
    connection.query(query, params, (err, results) => {
        if (err) {
            console.error("Error updating hotel:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        res.json({ success: true, message: "Hotel updated successfully" });
    });
});

router.delete("/hotels/:id", checkAdminAuth, (req, res) => {
    const hotelId = req.params.id;
    const connection = req.app.locals.connection;
    
    // Temporarily disable foreign key checks
    connection.query("SET FOREIGN_KEY_CHECKS=0", (err) => {
        if (err) {
            console.error("Error disabling foreign key checks:", err);
            return res.json({ success: false, message: "Database error: " + err.message });
        }
        
        // Delete the hotel directly
        connection.query("DELETE FROM Hotel WHERE Hotel_id = ?", [hotelId], (err, results) => {
            // Re-enable foreign key checks
            connection.query("SET FOREIGN_KEY_CHECKS=1", () => {
                if (err) {
                    console.error("Error deleting hotel:", err);
                    return res.json({ 
                        success: false, 
                        message: "Error deleting hotel: " + err.message
                    });
                }
                
                // Check if any rows were affected
                if (results.affectedRows === 0) {
                    return res.json({
                        success: false,
                        message: "Hotel not found or could not be deleted"
                    });
                }
                
                res.json({ 
                    success: true, 
                    message: "Hotel deleted successfully" 
                });
            });
        });
    });
});

// Enquiries Managment
router.get("/enquiries", checkAdminAuth, (req, res) => {
    const connection = req.app.locals.connection;
    const query = `
        SELECT e.*, u.Name as UserName 
        FROM Enquiry e 
        LEFT JOIN User u ON e.User_id = u.User_id 
        ORDER BY e.EnquiryID DESC
    `;
    
    connection.query(query, (err, enquiries) => {
        if (err) {
            console.error("Error fetching enquiries:", err);
            enquiries = [];
        }
        
        res.render("admin-enquiries", {
            layout: false,
            enquiries: enquiries,
            adminUsername: req.session.adminUsername
        });
    });
});

// API to get enquiry details
router.get("/api/enquiry/:id", checkAdminAuth, (req, res) => {
    const enquiryId = req.params.id;
    const connection = req.app.locals.connection;
    
    // Simple query to get just the enquiry data
    const query = "SELECT * FROM Enquiry WHERE EnquiryID = ?";
    
    connection.query(query, [enquiryId], (err, results) => {
        if (err) {
            console.error("Error fetching enquiry:", err);
            return res.status(500).json({ success: false, message: "Database error: " + err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, message: "Enquiry not found" });
        }
        
        res.json({ 
            success: true, 
            enquiry: results[0]
        });
    });
});

// API to reply to an enquiry
router.post("/api/enquiry/:id/reply", checkAdminAuth, (req, res) => {
    const enquiryId = req.params.id;
    const { reply } = req.body;
    const connection = req.app.locals.connection;
    
    if (!reply) {
        return res.status(400).json({ success: false, message: "Reply is required" });
    }
    
    // Update the enquiry with the reply
    connection.query(
        "UPDATE Enquiry SET AdminReply = ?, Status = 'Replied' WHERE EnquiryID = ?",
        [reply, enquiryId],
        (err, result) => {
            if (err) {
                console.error("Error updating enquiry with reply:", err);
                return res.status(500).json({ success: false, message: "Database error: " + err.message });
            }
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Enquiry not found" });
            }
            
            res.json({ success: true, message: "Reply sent successfully" });
        }
    );
});

// API to get enquiries for a specific customer
router.get("/api/customer/:userId/enquiries", checkAdminAuth, (req, res) => {
    const userId = req.params.userId;
    const connection = req.app.locals.connection;
    
    // Simple query to get all enquiries for a user
    const query = "SELECT * FROM Enquiry WHERE User_id = ? ORDER BY EnquiryID DESC";
    
    connection.query(query, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching customer enquiries:", err);
            return res.status(500).json({ success: false, message: "Database error: " + err.message });
        }
        
        res.json({ 
            success: true, 
            enquiries: results
        });
    });
});

// Add Hotel Form Handler
router.post("/add-hotel", checkAdminAuth, (req, res) => {
    const { 
        hotelName, hotelLocation, price, ratings, amenities, image
    } = req.body;
    const connection = req.app.locals.connection;
    
    // Basic validation
    if (!hotelName || !hotelLocation || !price) {
        return res.render("admin-add-hotel", {
            layout: false,
            adminUsername: req.session.adminUsername,
            error: "Hotel name, location, and price are required"
        });
    }
    
    // Insert hotel into database - removing Description field
    connection.query(
        "INSERT INTO Hotel (HotelName, HotelLocation, PricePerNight, Ratings, Amenities, HotelImage) VALUES (?, ?, ?, ?, ?, ?)",
        [hotelName, hotelLocation, price, ratings, amenities, image],
        (err, result) => {
            if (err) {
                console.error("Error adding hotel:", err);
                return res.render("admin-add-hotel", {
                    layout: false,
                    adminUsername: req.session.adminUsername,
                    error: "Database error: " + err.message
                });
            }
            
            // Redirect back to hotels list
            res.redirect("/admin/hotels?success=Hotel added successfully");
        }
    );
});

// Update Hotel Form Handler
router.post("/update-hotel/:id", checkAdminAuth, (req, res) => {
    const hotelId = req.params.id;
    const { 
        hotelName, hotelLocation, price, ratings, amenities, image
    } = req.body;
    const connection = req.app.locals.connection;
    
    // Basic validation
    if (!hotelName || !hotelLocation || !price) {
        return res.redirect(`/admin/edit-hotel/${hotelId}?error=Hotel name, location, and price are required`);
    }
    
    // Update hotel in database - removing Description field
    connection.query(
        "UPDATE Hotel SET HotelName = ?, HotelLocation = ?, PricePerNight = ?, Ratings = ?, Amenities = ?, HotelImage = ? WHERE HotelId = ?",
        [hotelName, hotelLocation, price, ratings, amenities, image, hotelId],
        (err, result) => {
            if (err) {
                console.error("Error updating hotel:", err);
                return res.redirect(`/admin/edit-hotel/${hotelId}?error=Database error: ${err.message}`);
            }
            
            // Redirect back to hotels list
            res.redirect("/admin/hotels?success=Hotel updated successfully");
        }
    );
});

module.exports = router; 