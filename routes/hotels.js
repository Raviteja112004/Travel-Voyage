const express = require("express");
const router = express.Router();

// Hotel search API endpoint
router.get("/api", function(req, res) {
    const location = req.query.location || '';
    const ratings = req.query.ratings || '';
    const connection = req.app.locals.connection;
    
    let query = "SELECT * FROM Hotel WHERE 1=1";
    let params = [];
    
    if (location) {
        query += " AND HotelLocation LIKE ?";
        params.push(`%${location}%`);
    }
    
    if (ratings) {
        query += " AND Ratings >= ?";
        params.push(ratings);
    }
    
    query += " ORDER BY Ratings DESC";
    
    connection.query(query, params, function(err, results) {
        if (err) {
            console.error("Error fetching hotels:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        res.json(results);
    });
});

// Hotel listings page (if it exists)
router.get("/", function(req, res) {
    const connection = req.app.locals.connection;
    
    // Get all hotels
    connection.query("SELECT * FROM Hotel ORDER BY Ratings DESC", function(err, results) {
        if (err) {
            console.error("Error fetching hotels:", err);
            return res.redirect("/?error=Could not fetch hotels");
        }
        
        // Process hotel data
        const hotels = results.map(hotel => {
            return {
                ...hotel,
                AmenitiesArray: hotel.Amenities ? hotel.Amenities.split(',').map(a => a.trim()) : []
            };
        });
        
        res.render("hotels", {
            hotels: hotels,
            title: "Hotel Listings",
            isLoggedIn: req.session.userId ? true : false,
            userName: req.session.userName || null,
            userEmail: req.session.userEmail || null
        });
    });
});

// Hotel details page
router.get("/details/:id", function(req, res) {
    const hotelId = req.params.id;
    const connection = req.app.locals.connection;
    
    connection.query("SELECT * FROM Hotel WHERE Hotel_id = ?", [hotelId], function(err, results) {
        if (err || results.length === 0) {
            console.error("Error fetching hotel details:", err);
            return res.redirect("/hotels?error=Hotel not found");
        }
        
        const hotel = results[0];
        hotel.AmenitiesArray = hotel.Amenities ? hotel.Amenities.split(',').map(a => a.trim()) : [];
        
        // Find packages that might include this hotel's location
        const location = hotel.HotelLocation.split(',')[0].trim();
        
        connection.query(
            "SELECT * FROM Packages WHERE PackageLocation LIKE ? LIMIT 3",
            [`%${location}%`],
            function(packageErr, packageResults) {
                if (packageErr) {
                    console.error("Error fetching related packages:", packageErr);
                    packageResults = [];
                }
                
                res.render("hotel-details", {
                    hotel: hotel,
                    relatedPackages: packageResults,
                    isLoggedIn: req.session.userId ? true : false,
                    userName: req.session.userName || null,
                    userEmail: req.session.userEmail || null
                });
            }
        );
    });
});

module.exports = router; 